import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../fw.webex.example.037.tlpp', import.meta.url), 'utf8');
function block(name) {
    const match = source.match(new RegExp('beginContent var ' + name + '\\s*([\\s\\S]*?)\\s*endContent', 'i'));
    assert.ok(match, `Missing embedded JavaScript: ${name}`);
    return match[1];
}
const requestId = 'cep-request-test';
const lookupScript = block('cLookupScript').replaceAll('__REQUEST_ID__', requestId);
const resultScript = block('cResultScript');
const viaURL = 'https://viacep.com.br/ws/01001000/json/';
const brasilURL = 'https://brasilapi.com.br/api/cep/v1/01001000';
const viaData = { cep: '01001-000', logradouro: 'Praca da Se', bairro: 'Se', localidade: 'Sao Paulo', uf: 'SP' };
const brasilData = { cep: '01001000', street: 'Praca da Se', neighborhood: 'Se', city: 'Sao Paulo', state: 'SP', service: 'open-cep' };
const response = dados => ({ ok: true, async json() { return dados; } });
const plain = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

class Events {
    constructor() { this.events = new Map(); }
    addEventListener(type, callback, options) {
        const listeners = this.events.get(type) || [];
        listeners.push({ callback, once: !!options?.once });
        this.events.set(type, listeners);
    }
    emit(type, event = {}) {
        const listeners = [...(this.events.get(type) || [])];
        this.events.set(type, listeners.filter(listener => !listener.once));
        return listeners.map(listener => listener.callback(event));
    }
}

class Element extends Events {
    constructor(tag = 'div') {
        super();
        this.tag = tag;
        this.children = [];
        this.attrs = {};
        this.textContent = '';
        this.disabled = false;
    }
    setAttribute(name, value) { this.attrs[name] = value; }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = [...children]; }
    createTHead() { return this.appendChild(new Element('thead')); }
    createTBody() { return this.appendChild(new Element('tbody')); }
    insertRow() { return this.appendChild(new Element('tr')); }
    insertCell() { return this.appendChild(new Element('td')); }
    querySelector(selector) {
        for (const child of this.children) {
            if (child.tag === selector ||
                (selector === 'button[type="submit"]' && child.tag === 'button' && child.type === 'submit') ||
                (selector === 'input[name="cep"]' && child.tag === 'input' && child.name === 'cep')) return child;
            const found = child.querySelector(selector);
            if (found) return found;
        }
        return null;
    }
}

function documentFor(elements, readyState) {
    return Object.assign(new Events(), {
        readyState,
        getElementById: id => elements[id] || null,
        createElement: tag => new Element(tag)
    });
}

function lookupHarness(readyState = 'complete') {
    const form = new Element('form');
    const input = form.appendChild(new Element('input'));
    Object.assign(input, { name: 'cep', value: '01001-000' });
    const button = form.appendChild(new Element('button'));
    button.type = 'submit';
    const status = new Element();
    const document = documentFor({ consultaCEP: form, resultadoCEP: status }, readyState);
    const window = new Events();
    const h = { form, input, button, status, document, window, connects: [], fetches: [], sent: [], timers: new Map() };
    h.fetchImpl = () => response(viaData);
    const channel = {
        jsToAdvpl(type, content) {
            if (h.sendError) throw h.sendError;
            h.sent.push({ type, payload: JSON.parse(content) });
        }
    };
    window.FWWebEx = { TWebChannel: {
        connect(options) {
            h.connects.push(plain(options));
            return h.connectImpl ? h.connectImpl() : Promise.resolve(channel);
        }
    } };
    let timerId = 0;
    const context = vm.createContext({ window, document, FWWebEx: window.FWWebEx, AbortController,
        fetch(url, options) { h.fetches.push({ url, ...options }); return h.fetchImpl(url, options); },
        setTimeout(callback, delay) { const id = ++timerId; h.timers.set(id, { callback, delay }); return id; },
        clearTimeout(id) { h.timers.delete(id); }
    });
    vm.runInContext(lookupScript, context);
    h.submit = value => {
        if (value !== undefined) input.value = value;
        const event = { prevented: 0, preventDefault() { this.prevented++; } };
        const [done] = form.emit('submit', event);
        return { event, done };
    };
    h.fireTimeout = () => {
        const [id, timer] = h.timers.entries().next().value;
        assert.equal(timer.delay, 15000);
        h.timers.delete(id);
        timer.callback();
    };
    return h;
}

function assertReleased(h) {
    assert.equal(h.button.disabled, false);
    assert.equal(h.form.attrs['aria-busy'], 'false');
    assert.equal(h.timers.size, 0);
}

test('lookup initializes on DOMContentLoaded and invalid CEP prevents submit without contacting services', async () => {
    const h = lookupHarness('loading');
    assert.equal(h.form.events.has('submit'), false);
    h.document.readyState = 'complete';
    h.document.emit('DOMContentLoaded');
    for (const value of ['', '12345', '123456789', 'abc']) {
        const submit = h.submit(value);
        await submit.done;
        assert.equal(submit.event.prevented, 1);
        assert.match(h.status.textContent, /CEP invalido/);
        assert.match(h.status.className, /alert-danger/);
        assert.equal(h.button.disabled, false);
    }
    assert.equal(h.connects.length, 0);
    assert.equal(h.fetches.length, 0);
    assert.equal(h.sent.length, 0);
    assert.equal(h.timers.size, 0);
});

test('ViaCEP result is returned to Protheus through jsToAdvpl with the execution id and original fields', async () => {
    const h = lookupHarness();
    const submit = h.submit(' 01001-000 ');
    assert.equal(submit.event.prevented, 1);
    assert.equal(h.button.disabled, true);
    assert.equal(h.form.attrs['aria-busy'], 'true');
    await submit.done;
    assert.deepEqual(h.connects, [{ timeout: 10000 }]);
    assert.deepEqual(h.fetches.map(call => call.url), [viaURL]);
    assert.ok(h.fetches[0].signal instanceof AbortSignal);
    assert.deepEqual(h.sent, [{ type: 'FWWEBEX_CEP_RESULT', payload: { id: requestId, origem: 'ViaCEP', dados: viaData } }]);
    assertReleased(h);
});

test('invalid ViaCEP responses fall back to BrasilAPI and return its unchanged response', async t => {
    const failures = {
        HTTP: () => ({ ok: false, json() { assert.fail('HTTP failure must not parse JSON'); } }),
        JSON: () => ({ ok: true, async json() { throw new SyntaxError('Invalid JSON'); } }),
        'CEP missing': () => response({ erro: true }),
        'CEP mismatch': () => response({ ...viaData, cep: '20040-002' })
    };
    for (const [name, fail] of Object.entries(failures)) await t.test(name, async () => {
        const h = lookupHarness();
        h.fetchImpl = url => url === viaURL ? fail() : response(brasilData);
        await h.submit().done;
        assert.deepEqual(h.fetches.map(call => call.url), [viaURL, brasilURL]);
        assert.notEqual(h.fetches[0].signal, h.fetches[1].signal);
        assert.deepEqual(h.sent, [{ type: 'FWWEBEX_CEP_RESULT', payload: { id: requestId, origem: 'BrasilAPI', dados: brasilData } }]);
        assertReleased(h);
    });
});

test('failure of both services sends no data, releases resources, and allows a successful retry', async () => {
    const h = lookupHarness();
    h.fetchImpl = async () => { throw new Error('Network unavailable'); };
    await h.submit().done;
    assert.deepEqual(h.fetches.map(call => call.url), [viaURL, brasilURL]);
    assert.equal(h.sent.length, 0);
    assert.match(h.status.textContent, /Tente novamente/);
    assert.match(h.status.className, /alert-danger/);
    assertReleased(h);
    h.fetchImpl = () => response(viaData);
    await h.submit().done;
    assert.equal(h.sent.length, 1);
    assert.equal(h.sent[0].payload.origem, 'ViaCEP');
    assertReleased(h);
});

test('bridge connection and sending failures do not trigger API fallback', async t => {
    await t.test('connect', async () => {
        const h = lookupHarness();
        h.connectImpl = async () => { throw new Error('Channel offline'); };
        await h.submit().done;
        assert.equal(h.fetches.length, 0);
        assert.equal(h.sent.length, 0);
        assert.match(h.status.textContent, /Tente novamente/);
        assertReleased(h);
    });
    await t.test('jsToAdvpl', async () => {
        const h = lookupHarness();
        h.sendError = new Error('Transport failed');
        await h.submit().done;
        assert.deepEqual(h.fetches.map(call => call.url), [viaURL]);
        assert.equal(h.sent.length, 0);
        assert.match(h.status.textContent, /Tente novamente/);
        assertReleased(h);
    });
});

test('concurrent submits share one active lookup and prevent normal browser submission', async () => {
    const h = lookupHarness();
    const pending = deferred();
    h.fetchImpl = () => pending.promise;
    const first = h.submit();
    await flush();
    assert.equal(h.fetches.length, 1);
    const second = h.submit();
    await second.done;
    assert.equal(second.event.prevented, 1);
    assert.equal(h.connects.length, 1);
    assert.equal(h.fetches.length, 1);
    assert.equal(h.button.disabled, true);
    pending.resolve(response(viaData));
    await first.done;
    assert.equal(h.sent.length, 1);
    assertReleased(h);
});

test('pagehide during connection prevents a lookup and blocks further submits', async () => {
    const h = lookupHarness();
    const pending = deferred();
    h.connectImpl = () => pending.promise;
    const first = h.submit();
    h.window.emit('pagehide');
    pending.resolve({ jsToAdvpl() { assert.fail('Closed page must not send'); } });
    await first.done;
    const next = h.submit();
    await next.done;
    assert.equal(next.event.prevented, 1);
    assert.equal(h.connects.length, 1);
    assert.equal(h.fetches.length, 0);
    assert.equal(h.sent.length, 0);
    assertReleased(h);
});

test('pagehide aborts an active fetch, suppresses fallback, and clears its timer', async () => {
    const h = lookupHarness();
    h.fetchImpl = (url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    });
    const first = h.submit();
    await flush();
    assert.equal(h.timers.size, 1);
    h.window.emit('pagehide');
    await first.done;
    assert.equal(h.fetches[0].signal.aborted, true);
    assert.deepEqual(h.fetches.map(call => call.url), [viaURL]);
    assert.equal(h.sent.length, 0);
    assertReleased(h);
});

test('a late response after pagehide cannot be sent even when the fetch ignores abort', async () => {
    const h = lookupHarness();
    const pending = deferred();
    h.fetchImpl = () => pending.promise;
    const first = h.submit();
    await flush();
    h.window.emit('pagehide');
    assert.equal(h.fetches[0].signal.aborted, true);
    pending.resolve(response(viaData));
    await first.done;
    assert.equal(h.fetches.length, 1);
    assert.equal(h.sent.length, 0);
    assertReleased(h);
});

test('fetch timeout aborts ViaCEP and falls back with a fresh controller', async () => {
    const h = lookupHarness();
    h.fetchImpl = (url, { signal }) => url === brasilURL ? response(brasilData) :
        new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Timeout')), { once: true }));
    const first = h.submit();
    await flush();
    assert.equal(h.timers.size, 1);
    h.fireTimeout();
    await first.done;
    assert.deepEqual(h.fetches.map(call => call.url), [viaURL, brasilURL]);
    assert.equal(h.fetches[0].signal.aborted, true);
    assert.equal(h.fetches[1].signal.aborted, false);
    assert.equal(h.sent[0].payload.origem, 'BrasilAPI');
    assertReleased(h);
});

function resultHarness(payload, { plugin = 'available', readyState = 'complete' } = {}) {
    const island = new Element('script');
    island.textContent = JSON.stringify(payload).replaceAll('<', '\\u003c');
    const host = new Element();
    const status = new Element();
    const document = documentFor({ cepRecebido: island, tableResult: host, resultadoCEP: status }, readyState);
    const calls = [];
    const window = {};
    if (plugin !== 'missing') window.DataTable = function (table, options) {
        calls.push({ table, options: plain(options) });
        if (plugin === 'error') throw new Error('Plugin unavailable');
    };
    Object.defineProperty(window, 'FWWebEx', { get() { assert.fail('Result page must not use the bridge'); } });
    const context = vm.createContext({ window, document,
        fetch() { assert.fail('Result page must use its data island without fetching'); },
        FWWebEx: new Proxy({}, { get() { assert.fail('Result page must not use the bridge'); } })
    });
    vm.runInContext(resultScript, context);
    return { island, host, status, document, calls };
}

test('result page renders received fields and source literally and configures the DataTable', () => {
    const literal = '<img src=x onerror=alert(1)>';
    const payload = { id: requestId, origem: 'BrasilAPI', dados: {
        cep: '01001000', street: literal, [literal]: '<script>alert(1)</script>',
        location: { type: 'Point', coordinates: [-46.6, -23.5] }, blank: '', missing: null, number: 0, active: false
    } };
    const h = resultHarness(payload, { readyState: 'loading' });
    assert.equal(h.host.children.length, 0);
    h.document.emit('DOMContentLoaded');
    const [table] = h.host.children;
    assert.equal(table.id, 'cepRetornado');
    assert.equal(table.tag, 'table');
    assert.deepEqual(table.querySelector('thead').children[0].children.map(cell => [cell.textContent, cell.scope]),
        [['Campo', 'col'], ['Valor', 'col']]);
    const rows = table.querySelector('tbody').children;
    assert.deepEqual(rows.map(row => row.children.map(cell => cell.textContent)), [
        ['cep', '01001000'], ['street', literal], [literal, '<script>alert(1)</script>'],
        ['location', JSON.stringify(payload.dados.location)], ['blank', '-'], ['missing', '-'],
        ['number', '0'], ['active', 'false'], ['origem', 'BrasilAPI']
    ]);
    assert.ok(rows.every(row => row.children.every(cell => cell.children.length === 0)));
    assert.match(h.status.textContent, /Dados recebidos pelo Protheus via BrasilAPI/);
    assert.match(h.status.className, /alert-success/);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].table, table);
    const options = h.calls[0].options;
    assert.equal(options.pageLength, 4);
    assert.equal(options.dom, 'Blfrtip');
    assert.deepEqual(options.lengthMenu, [4, 8, 16, -1]);
    assert.deepEqual(options.order, []);
    assert.equal(options.responsive, false);
    assert.deepEqual(options.buttons, ['copy', 'csv', 'excel', 'print', 'pdf']);
    assert.equal(options.language.search, 'Pesquisar:');
    assert.equal(options.language.lengthLabels['-1'], 'Todos');
});

test('result table remains usable when the DataTable asset is missing or initialization throws', async t => {
    for (const plugin of ['missing', 'error']) await t.test(plugin, () => {
        const h = resultHarness({ id: requestId, origem: 'ViaCEP', dados: viaData }, { plugin });
        const table = h.host.children[0];
        assert.equal(table.querySelector('tbody').children.length, Object.keys(viaData).length + 1);
        assert.equal(table.querySelector('tbody').children[0].children[1].textContent, viaData.cep);
        assert.match(h.status.textContent, /via ViaCEP/);
        assert.match(h.status.className, /alert-success/);
        if (plugin === 'error') assert.match(h.status.textContent, /Exibindo tabela simples/);
        assert.equal(h.calls.length, plugin === 'error' ? 1 : 0);
    });
});
