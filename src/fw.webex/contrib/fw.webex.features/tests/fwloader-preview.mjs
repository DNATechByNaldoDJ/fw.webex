// Standalone visual preview using production scripts and a simulated transport.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import process from 'node:process';
const source=await readFile('src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.fwloader.tlpp','utf8');
const example=await readFile('src/fw.webex/tests/fw.webex.examples/000/fw.webex.example.async.tables.tlpp','utf8');
const block=(text,name)=>text.match(new RegExp('BeginContent var '+name+'\\s*([\\s\\S]*?)\\s*EndContent','i'))[1];
if(process.argv.includes('--offline')){
    const dataFile='fwwebex-preview.data.js';
    const panels=['32','35'].map(table=>block(example,'cPanel').replaceAll('__TABLE__',table).replace('__SVG__',block(source,'cSVG'))).join('');
    const page=block(example,'cHTML').replace('__EXPORTED__',new Date().toLocaleString('pt-BR'))
        .replace('__PANELS__',panels).replace('__DATA_FILE__',dataFile)
        .replace('__LOADER_RUNTIME__',block(source,'cRuntime')).replace('__TABLE_RUNTIME__',block(example,'cScript'));
    const data={
        '32':{table:'32',ok:true,columns:['Tabela','Descrição'],rows:[['32','Cópia local — demonstração']]},
        '35':{table:'35',ok:true,columns:['Tabela','Descrição'],rows:[['35','Sem conexão ao Protheus']]}
    };
    await writeFile(join(tmpdir(),dataFile),'window.FWWebExOfflineTables='+JSON.stringify(data)+';','utf8');
    const offlinePath=join(tmpdir(),'fwwebex-offline-preview.html');
    await writeFile(offlinePath,page,'utf8');console.log(offlinePath);
    process.exit(0);
}
const panel=table=>`<section data-fw-table="${table}" aria-busy="true"><h2>Tabela ${table}</h2>
<div data-fw-loader aria-hidden="true">${block(source,'cSVG')}</div>
<p data-fw-status role="status" aria-live="polite">Aguardando carregamento...</p>
<div data-fw-result class="table-responsive"></div>
<button type="button" data-fw-retry disabled>Recarregar / tentar novamente</button></section>`;
const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FWWebEx — prévia de carregamento</title><style>
*{box-sizing:border-box}body{margin:0;padding:40px;background:#101719;color:#e7ecec;font:16px system-ui}
main{max-width:1120px;margin:auto}h1{font-size:30px}h1 span{color:#17bdd0}h2{font-size:20px}
section{background:#192326;border:1px solid #304649;border-radius:14px;padding:24px;margin:24px 0}
[data-fw-loader]{text-align:center;padding:24px}button{background:#164b55;color:#e7ecec;border:1px solid #17bdd0;border-radius:6px;padding:9px 14px;cursor:pointer}
button:disabled{opacity:.5;cursor:wait}.table-responsive{overflow-x:auto}table{border-collapse:collapse;width:100%;margin:20px 0}
td,th{text-align:left;border-bottom:1px solid #304649;padding:12px}caption{text-align:left;margin:10px 0}
label{display:inline-block;margin:8px 20px 8px 0}input[type=number]{width:90px}p{color:#b4c6c8}
</style><main><h1>FW<span>WebEx</span> · Carregamento assíncrono</h1>
<p>Prévia local com dados simulados. Os exemplos 035/036 consultam a SX5 no Protheus.</p>
<label>Espera simulada (ms) <input id="delay" type="number" value="1800" min="0" max="40000"></label>
<label><input id="fail" type="checkbox"> Simular falha na tabela 35</label>
<label><input id="empty" type="checkbox"> Tabela 32 vazia</label>
${panel('32')}${panel('35')}</main>
<script>
window.FWWebEx={TWebChannel:(()=>{
    const receivers=new Set();
    return {onAdvplToJs(fn){receivers.add(fn);return()=>receivers.delete(fn);},async send(type,content){
        const request=JSON.parse(content),failed=document.getElementById('fail').checked&&request.table==='35';
        const empty=document.getElementById('empty').checked&&request.table==='32';
        const delay=Math.max(0,Math.min(40000,Number(document.getElementById('delay').value)||0));
        setTimeout(()=>{const data={...request,ok:!failed,error:'Falha simulada. Desmarque a opção e tente novamente.',
            columns:['Tabela','Chave','Descrição'],rows:empty?[]:[[request.table,'01','Primeiro registro'],[request.table,'02','Dados de demonstração']]};
            [...receivers].forEach(fn=>fn('FWWEBEX_ASYNC_TABLE_RESULT',JSON.stringify(data)));
        },delay);
    }};
})()};
</script><script>${block(source,'cRuntime')}</script><script>${block(example,'cScript')}</script></html>`;
const path=join(tmpdir(),'fwwebex-loader-preview.html');
await writeFile(path,html,'utf8');
console.log(path);
