import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const loaderSource=await readFile('src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.fwloader.tlpp','utf8');
const exampleSource=await readFile('src/fw.webex/tests/fw.webex.examples/000/fw.webex.example.async.tables.tlpp','utf8');
const block=(source,name)=>source.match(new RegExp('BeginContent var '+name+'\\s*([\\s\\S]*?)\\s*EndContent','i'))[1];

class Element {
    constructor(tag='div'){this.tag=tag;this.children=[];this.attrs={};this.events={};this.textContent='';this.hidden=false;this.disabled=false;}
    setAttribute(name,value){this.attrs[name]=value;}
    getAttribute(name){return this.attrs[name];}
    appendChild(child){child.parent=this;this.children.push(child);return child;}
    replaceChildren(...children){this.children=[];children.forEach(child=>this.appendChild(child));}
    addEventListener(name,fn){this.events[name]=fn;}
    createCaption(){return this.appendChild(new Element('caption'));}
    createTHead(){return this.appendChild(new Element('thead'));}
    createTBody(){return this.appendChild(new Element('tbody'));}
    insertRow(){return this.appendChild(new Element('tr'));}
    insertCell(){return this.appendChild(new Element('td'));}
    get rows(){return this.children.filter(child=>child.tag==='tr');}
    remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    querySelectorAll(selector){
        const found=[];
        const visit=node=>node.children.forEach(child=>{
            if(selector==='input[type="checkbox"]'?child.tag==='input'&&child.type==='checkbox':
                selector.startsWith('[')?Object.hasOwn(child.attrs,selector.slice(1,-1)):child.tag===selector)found.push(child);
            visit(child);
        });
        visit(this);return found;
    }
}
function host(){
    const root=new Element();
    for(const key of ['loader','status','retry','result']){
        const el=root.appendChild(new Element());el.setAttribute('data-fw-'+key,'');
    }
    return root;
}
function harness(){
    const frames=[],receivers=new Set(),sent=[],timers=new Map();let nextTimer=0;
    const bridge={onAdvplToJs(fn){receivers.add(fn);return()=>receivers.delete(fn);},
        async send(type,content){sent.push({type,...JSON.parse(content)});}};
    const window={FWWebEx:{TWebChannel:bridge},confirm:()=>true};
    const document={head:new Element('head'),readyState:'loading',addEventListener(){},createElement:tag=>new Element(tag)};
    const context=vm.createContext({window,document,requestAnimationFrame:fn=>frames.push(fn),
        setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
    vm.runInContext(block(loaderSource,'cRuntime'),context);
    vm.runInContext(block(exampleSource,'cScript'),context);
    const respond=data=>[...receivers].forEach(fn=>fn('FWWEBEX_ASYNC_TABLE_RESULT',JSON.stringify(data)));
    const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
    const paint=async()=>{frames.shift()();frames.shift()();await flush();};
    return {window,document,api:window.FWWebEx,bridge,frames,receivers,sent,timers,respond,flush,paint,context};
}

test('loader paints before fetching and coalesces repeated loads of the same host',async()=>{
    const h=harness(),el=host();let calls=0,release;
    const pending=h.api.Loader.run(el,()=>{calls++;return new Promise(resolve=>release=resolve);},()=>{});
    assert.equal(h.api.Loader.run(el,()=>assert.fail(),()=>{}),pending);
    assert.equal(calls,0);assert.equal(el.attrs['aria-busy'],'true');
    h.frames.shift()();assert.equal(calls,0);h.frames.shift()();await h.flush();assert.equal(calls,1);
    release({});assert.equal(await pending,true);
    assert.equal(el.attrs['aria-busy'],'false');assert.equal(el.querySelector('[data-fw-loader]').hidden,true);
    assert.equal(el.querySelector('[data-fw-retry]').disabled,false);
});

test('task and render failures clear the loader, expose text, and allow retry',async()=>{
    const h=harness(),el=host();
    for(const rendering of [false,true]){
        const pending=h.api.Loader.run(el,()=>{if(!rendering)throw new Error('<b>failure</b>');return {};},()=>{throw new Error('<b>failure</b>');});
        await h.paint();assert.equal(await pending,false);
        assert.equal(el.querySelector('[data-fw-status]').textContent,'Falha: <b>failure</b>');
        assert.equal(el.querySelector('[data-fw-loader]').hidden,true);
        assert.equal(el.attrs['aria-busy'],'false');
    }
    const retry=h.api.Loader.run(el,()=>({}),()=>{});await h.paint();assert.equal(await retry,true);
});

test('out-of-order replies are correlated and unrelated messages do not resolve a request',async()=>{
    const h=harness(),a=h.api.ExampleAsyncTables.request('32'),b=h.api.ExampleAsyncTables.request('35');
    await h.flush();assert.equal(h.sent.length,2);assert.equal(h.receivers.size,2);
    assert.equal([...h.receivers][0]('OTHER','{}'),false);
    h.respond({id:'old',table:'32',ok:true,columns:[],rows:[]});assert.equal(h.receivers.size,2);
    h.respond({...h.sent[1],ok:true,columns:['Code'],rows:[['B']]});assert.equal((await b).rows[0][0],'B');
    h.respond({...h.sent[0],ok:true,columns:['Code'],rows:[['A']]});assert.equal((await a).rows[0][0],'A');
    assert.equal(h.receivers.size,0);assert.equal(h.timers.size,0);
});

test('timeout cleans listeners; a late response cannot satisfy a new attempt',async()=>{
    const h=harness(),first=h.api.ExampleAsyncTables.request('32');await h.flush();
    const failed=assert.rejects(first,/Tempo esgotado/);[...h.timers.values()][0]();await failed;
    assert.equal(h.receivers.size,0);assert.equal(h.timers.size,0);
    const second=h.api.ExampleAsyncTables.request('32');await h.flush();
    h.respond({...h.sent[0],ok:true,columns:[],rows:[]});assert.equal(h.receivers.size,1);
    h.respond({...h.sent[1],ok:true,columns:[],rows:[]});await second;
    assert.equal(h.receivers.size,0);
});

test('transport errors and invalid responses reject and release resources',async()=>{
    for(const mode of ['transport','server','shape','table']){
        const h=harness();if(mode==='transport')h.bridge.send=()=>{throw new Error('offline');};
        const pending=h.api.ExampleAsyncTables.request('32');
        const failed=assert.rejects(pending);await h.flush();
        if(mode!=='transport')h.respond({...h.sent[0],ok:mode!=='server',error:'SQL failed',
            table:mode==='table'?'35':'32',columns:['A'],rows:mode==='shape'?[[]]:[['value']]});
        await failed;assert.equal(h.receivers.size,0);assert.equal(h.timers.size,0);
    }
});

test('client renders literal cell values, selection, and local-only deletion',()=>{
    const h=harness(),el=host(),value='<img src=x onerror=alert(1)>';
    h.api.ExampleAsyncTables.render(el,{table:'32',columns:['Code'],rows:[[value],['other']]});
    const table=el.querySelector('table'),body=table.querySelector('tbody');
    assert.equal(body.rows[0].children[1].textContent,value);
    assert.equal(body.rows[0].children[1].children.length,0);
    const master=table.querySelector('input[type="checkbox"]');master.checked=true;master.events.change();
    assert.ok(body.querySelectorAll('input[type="checkbox"]').every(input=>input.checked));
    body.rows[0].querySelector('button').events.click();assert.equal(body.rows.length,1);
    assert.equal(h.sent.length,0);
    h.api.ExampleAsyncTables.render(el,{table:'35',columns:['Code'],rows:[]});
    assert.equal(el.querySelector('tbody').rows[0].children[0].textContent,'Nenhum registro encontrado.');
    assert.equal(el.querySelector('input[type="checkbox"]').disabled,true);
});

test('online page contains placeholders only; SQL is restricted to two tables; SVG supports reduced motion',()=>{
    const page=exampleSource.split('static method Page(cHTML)')[1].split('static method Callback(')[0];
    assert.doesNotMatch(page,/beginSQL|FromSQL|SELECT\s+\*/i);
    assert.match(exampleSource,/cTable!="32"\.and\.cTable!="35"/);
    assert.match(exampleSource,/FWRestArea\(aArea\)/);
    assert.match(loaderSource,/prefers-reduced-motion:reduce/);
    assert.match(block(loaderSource,'cSVG'),/stroke-dasharray="24 76"/);
});

test('offline data loads only after paint and both tables share one local script without a channel',async()=>{
    const h=harness(),el=host();h.window.FWWebExOfflineSource='fwwebex-test.data.js';
    delete h.api.TWebChannel;
    const pending=h.api.Loader.run(el,()=>h.api.ExampleAsyncTables.request('32'),data=>h.api.ExampleAsyncTables.render(el,data));
    assert.equal(h.document.head.children.length,0);await h.paint();
    const second=h.api.ExampleAsyncTables.request('35');
    assert.equal(h.document.head.children.length,1);
    const script=h.document.head.children[0];assert.equal(script.src,'./fwwebex-test.data.js');
    h.window.FWWebExOfflineTables={
        '32':{table:'32',ok:true,columns:['Descricao'],rows:[['Ação <b>literal</b>']]},
        '35':{table:'35',ok:true,columns:[],rows:[]}
    };
    script.onload();assert.equal(await pending,true);assert.equal((await second).table,'35');
    assert.equal(el.querySelector('tbody').rows[0].children[1].textContent,'Ação <b>literal</b>');
    assert.equal(h.sent.length,0);assert.equal(h.timers.size,0);assert.equal(h.receivers.size,0);
    await h.api.ExampleAsyncTables.request('32');assert.equal(h.document.head.children.length,0);
});

test('missing offline file and timeout allow another attempt without contacting the server',async()=>{
    for(const mode of ['missing','timeout']){
        const h=harness();h.window.FWWebExOfflineSource='fwwebex-test.data.js';delete h.api.TWebChannel;
        const first=h.api.ExampleAsyncTables.request('32'),failed=assert.rejects(first);
        if(mode==='missing')h.document.head.children[0].onerror();else [...h.timers.values()][0]();
        await failed;assert.equal(h.document.head.children.length,0);assert.equal(h.timers.size,0);
        const next=h.api.ExampleAsyncTables.request('32');
        h.window.FWWebExOfflineTables={'32':{table:'32',ok:true,columns:[],rows:[]}};
        h.document.head.children[0].onload();await next;assert.equal(h.sent.length,0);
    }
});

test('offline mode rejects remote sources and malformed snapshots',async()=>{
    const h=harness();delete h.api.TWebChannel;
    h.window.FWWebExOfflineSource='https://example.org/data.js';
    await assert.rejects(h.api.ExampleAsyncTables.request('32'),/Arquivo local/);
    assert.equal(h.document.head.children.length,0);
    h.window.FWWebExOfflineSource='fwwebex-test.data.js';
    const pending=h.api.ExampleAsyncTables.request('32'),failed=assert.rejects(pending,/Dados de tabela invalidos/);
    h.window.FWWebExOfflineTables={'32':{table:'32',ok:true,columns:['A'],rows:[[]]}};
    h.document.head.children[0].onload();await failed;assert.equal(h.sent.length,0);
});

test('offline shell has embedded assets and export copies both files before opening the local HTML',()=>{
    const shell=block(exampleSource,'cHTML');
    assert.doesNotMatch(shell,/<link|https?:|<table[\s>]/i);
    const exporting=exampleSource.split('static method ExportOffline() class')[1].split('static method OfflineHTML(')[0];
    assert.match(exporting,/CopyFile\(cServerData,cLocalData\)/);
    assert.match(exporting,/CopyFile\(cServerHTML,cLocalHTML\)/);
    assert.match(exporting,/ShellExecute\("open",cLocalHTML/);
    assert.doesNotMatch(exporting,/CpyF2Web\(|GetTWebChannel\(|ObliterateFWWebExTmpFiles\(/);
    assert.ok(exporting.indexOf('CopyFile(cServerData,cLocalData)')<exporting.indexOf('ShellExecute('));
});

test('optional RPO SVG matches the embedded default',async()=>{
    const svg=await readFile('src/resource/fwwebex_loader.svg','utf8');
    assert.equal(svg.trim().replace(/\r\n/g,'\n'),block(loaderSource,'cSVG').trim().replace(/\r\n/g,'\n'));
});
