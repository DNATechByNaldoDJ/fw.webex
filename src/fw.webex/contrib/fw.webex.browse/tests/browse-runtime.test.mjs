import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const browseTlppPath = resolve(__dirname, "../fw.webex.browse.tlpp");
const browseSource = await readFile(browseTlppPath, "utf8");

function extractRuntime(source) {
    const startMarker = "/* FWWebEx.Browse.Runtime.Start */";
    const endMarker = "/* FWWebEx.Browse.Runtime.End */";
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, "Marcador inicial do runtime ausente");
    const end = source.indexOf(endMarker, start);
    assert.notEqual(end, -1, "Marcador final do runtime ausente");
    return source.slice(start + startMarker.length, end).trim();
}

const runtimeCode = extractRuntime(browseSource);

function createRuntimeContext(handler) {
    const listeners = new Set();
    const sent = [];

    const bridge = {
        onAdvplToJs(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        send(type, content) {
            sent.push({type, content});
            const parsed = JSON.parse(content);
            if (typeof handler === "function") {
                queueMicrotask(() => {
                    const reply = handler(type, parsed);
                    if (reply) {
                        for (const fn of [...listeners]) {
                            fn(reply.type, JSON.stringify(reply.payload));
                        }
                    }
                });
            }
            return Promise.resolve();
        }
    };

    const windowObj = {
        FWWebEx: {
            TWebChannel: bridge
        },
        document: {
            querySelector() {
                return null;
            },
            querySelectorAll() {
                return [];
            }
        }
    };

    const sandbox = {
        window: windowObj,
        globalThis: windowObj,
        setTimeout,
        clearTimeout,
        Promise,
        Date,
        Map,
        Object,
        Array,
        String,
        Number,
        Error,
        JSON
    };

    vm.runInNewContext(runtimeCode, sandbox);
    return {
        Browse: windowObj.FWWebEx.Browse,
        sent,
        listeners
    };
}

test("renderLegend gera badge seguro escapando HTML no titulo", () => {
    const {Browse} = createRuntimeContext();
    const html = Browse.renderLegend({color: "GREEN", title: 'Ativo "VIP" <ok>'});
    assert.match(html, /bg-success/);
    assert.match(html, /title="Ativo &quot;VIP&quot; &lt;ok&gt;"/);
    assert.equal(Browse.renderLegend(null), "");
});

test("createAjaxAdapter pagina dados via TWebChannel e entrega formato DataTables", async () => {
    const {Browse, sent} = createRuntimeContext((type, req) => {
        assert.equal(type, "FWWEBEX_BROWSE_PAGE");
        assert.equal(req.browseId, "brw_01");
        assert.equal(req.start, 10);
        assert.equal(req.length, 5);
        assert.equal(req.search, "TOTVS");
        assert.deepEqual(req.order, {column: 2, dir: "desc"});
        return {
            type: "FWWEBEX_BROWSE_PAGE_RESULT",
            payload: {
                id: req.id,
                browseId: req.browseId,
                draw: req.draw,
                ok: true,
                recordsTotal: 42,
                recordsFiltered: 7,
                data: [{__key: 11, col_1: "000011", col_2: "TOTVS SA"}]
            }
        };
    });

    const adapter = Browse.createAjaxAdapter("brw_01");
    const result = await new Promise((resolveResult) => {
        adapter(
            {
                draw: 3,
                start: 10,
                length: 5,
                search: {value: "TOTVS"},
                order: [{column: 2, dir: "desc"}]
            },
            resolveResult
        );
    });

    assert.equal(sent.length, 1);
    assert.equal(result.draw, 3);
    assert.equal(result.recordsTotal, 42);
    assert.equal(result.recordsFiltered, 7);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].col_2, "TOTVS SA");
});

test("createAjaxAdapter reporta erro do servidor no callback de status sem quebrar DataTables", async () => {
    let statusMessage = "";
    const {Browse} = createRuntimeContext((type, req) => ({
        type: "FWWEBEX_BROWSE_PAGE_RESULT",
        payload: {
            id: req.id,
            browseId: req.browseId,
            ok: false,
            error: "Alias SA1 nao disponivel"
        }
    }));

    const adapter = Browse.createAjaxAdapter("brw_err", (msg) => {
        statusMessage = msg;
    });

    const result = await new Promise((resolveResult) => {
        adapter({draw: 1, start: 0, length: 10}, resolveResult);
    });

    assert.equal(statusMessage, "Alias SA1 nao disponivel");
    assert.equal(result.data.length, 0);
    assert.equal(result.recordsTotal, 0);
});

test("sendEvent correlaciona respostas concorrentes por id e limpa listeners", async () => {
    const {Browse, listeners} = createRuntimeContext((type, req) => ({
        type: "FWWEBEX_BROWSE_ACTION_RESULT",
        payload: {
            id: req.id,
            ok: true,
            refresh: req.actionId === "act_1",
            message: "Executado " + req.actionId
        }
    }));

    const [r1, r2] = await Promise.all([
        Browse.sendEvent("FWWEBEX_BROWSE_ACTION", "FWWEBEX_BROWSE_ACTION_RESULT", {
            browseId: "brw_01",
            actionId: "act_1",
            key: 1
        }),
        Browse.sendEvent("FWWEBEX_BROWSE_ACTION", "FWWEBEX_BROWSE_ACTION_RESULT", {
            browseId: "brw_01",
            actionId: "act_2",
            key: 2
        })
    ]);

    assert.equal(r1.message, "Executado act_1");
    assert.equal(r1.refresh, true);
    assert.equal(r2.message, "Executado act_2");
    assert.equal(r2.refresh, false);
    assert.equal(listeners.size, 0);
});

test("applyFilterState atualiza badge de filtros ativos e recarrega o DataTables", async () => {
    let reloadCount = 0;
    const classes = new Set(["d-none"]);
    const badgeEl = {
        textContent: "",
        classList: {
            add(c) { classes.add(c); },
            remove(c) { classes.delete(c); }
        }
    };
    const fakeTable = {
        ajax: {
            reload() { reloadCount += 1; }
        }
    };

    const {Browse} = createRuntimeContext((type, req) => {
        assert.equal(type, "FWWEBEX_BROWSE_FILTER");
        return {
            type: "FWWEBEX_BROWSE_FILTER_RESULT",
            payload: {
                id: req.id,
                ok: true,
                active: !req.clear,
                summary: req.clear ? "" : "Somente Ativos | col_4 > 30000"
            }
        };
    });

    await Browse.applyFilterState(
        "brw_f2",
        {clear: false, activeIds: ["flt_1"], dynamic: {field: "col_4", operator: ">", value: "30000"}},
        fakeTable,
        badgeEl
    );

    assert.equal(reloadCount, 1);
    assert.equal(classes.has("d-none"), false);
    assert.match(badgeEl.textContent, /Somente Ativos/);

    await Browse.applyFilterState("brw_f2", {clear: true}, fakeTable, badgeEl);
    assert.equal(reloadCount, 2);
    assert.equal(classes.has("d-none"), true);
    assert.equal(badgeEl.textContent, "");
});

test("applySeekState envia pesquisa direcionada e aciona reload do DataTables", async () => {
    let reloadCount = 0;
    const fakeTable = {
        ajax: {
            reload() { reloadCount += 1; }
        }
    };

    const {Browse, sent} = createRuntimeContext((type, req) => {
        assert.equal(type, "FWWEBEX_BROWSE_SEEK");
        assert.equal(req.field, "col_3");
        assert.equal(req.term, "DNATech");
        assert.equal(req.order, 2);
        return {
            type: "FWWEBEX_BROWSE_SEEK_RESULT",
            payload: {
                id: req.id,
                ok: true,
                active: true
            }
        };
    });

    const res = await Browse.applySeekState(
        "brw_f2",
        {clear: false, field: "col_3", term: "DNATech", order: 2},
        fakeTable
    );

    assert.equal(sent.length, 1);
    assert.equal(res.active, true);
    assert.equal(reloadCount, 1);
});

test("renderMark gera checkbox com atributos de marcacao seguros", () => {
    const {Browse} = createRuntimeContext();
    const html = Browse.renderMark("brw_m1", 42, true);
    assert.match(html, /data-fwwebex-browse-mark="brw_m1"/);
    assert.match(html, /data-key="42"/);
    assert.match(html, /checked/);
});

test("toggleMark envia evento FWWEBEX_BROWSE_MARK e atualiza contador no status", async () => {
    let statusMsg = "";
    const {Browse} = createRuntimeContext((type, req) => {
        assert.equal(type, "FWWEBEX_BROWSE_MARK");
        assert.equal(req.key, 7);
        assert.equal(req.checked, true);
        return {
            type: "FWWEBEX_BROWSE_MARK_RESULT",
            payload: {
                id: req.id,
                ok: true,
                markedCount: 3,
                markedKeys: ["1", "4", "7"]
            }
        };
    });

    const res = await Browse.toggleMark(
        "brw_m1",
        {all: false, key: 7, checked: true},
        (msg) => { statusMsg = msg; }
    );

    assert.equal(res.markedCount, 3);
    assert.equal(statusMsg, "3 registro(s) marcado(s).");
});

test("reloadTargets recarrega instancias filhas registradas (Master-Detail)", () => {
    const {Browse} = createRuntimeContext();
    let childReloads = 0;
    const fakeChildTable = {
        ajax: {
            reload() { childReloads += 1; }
        }
    };
    Browse.bindEvents("brw_child_1", fakeChildTable, null, null);
    const count = Browse.reloadTargets(["brw_child_1", "brw_inexistente"]);
    assert.equal(count, 1);
    assert.equal(childReloads, 1);
});

test("WebExMarkBrowse nao injeta HTML com aspas duplas em jMarkCol[title]", async () => {
    const markSrc = await readFile(resolve(__dirname, "../fw.webex.mark.browse.tlpp"), "utf8");
    assert.equal(markSrc.includes('type="checkbox"'), false);
    assert.match(markSrc, /data-fwwebex-browse-mark-enabled/);
});

test("openModal atualiza titulo e exibe instancia Bootstrap Modal", () => {
    let shown = false;
    const titleEl = { textContent: "" };
    const modalEl = { classList: { add() {} }, style: {} };
    const windowObj = {
        FWWebEx: {},
        bootstrap: {
            Modal: {
                getOrCreateInstance(el) {
                    assert.equal(el, modalEl);
                    return { show() { shown = true; } };
                }
            }
        },
        document: {
            getElementById(id) { return id === "modal_itens" ? modalEl : null; },
            querySelector(sel) { return sel === '[data-fwwebex-modal-title="modal_itens"]' ? titleEl : null; }
        }
    };
    vm.runInNewContext(runtimeCode, {
        window: windowObj, globalThis: windowObj, setTimeout, clearTimeout,
        Promise, Date, Map, Object, Array, String, Number, Error, JSON
    });
    const ok = windowObj.FWWebEx.Browse.openModal("modal_itens", "Itens do Pedido PV0002");
    assert.equal(ok, true);
    assert.equal(shown, true);
    assert.equal(titleEl.textContent, "Itens do Pedido PV0002");
});

test("renderRowActions gera botoes vinculados a linha com data-key", () => {
    const payload = JSON.stringify({
        items: [{ id: "rowact_1", label: "Ver Itens", cls: "btn btn-sm btn-primary" }]
    });
    const windowObj = {
        FWWebEx: {},
        document: {
            getElementById(id) {
                return id === "brw_043" ? { getAttribute(a) { return a === "data-fwwebex-row-actions" ? payload : null; } } : null;
            }
        }
    };
    vm.runInNewContext(runtimeCode, {
        window: windowObj, globalThis: windowObj, setTimeout, clearTimeout,
        Promise, Date, Map, Object, Array, String, Number, Error, JSON
    });
    const html = windowObj.FWWebEx.Browse.renderRowActions("brw_043", 2);
    assert.match(html, /data-fwwebex-browse-row-action="rowact_1"/);
    assert.match(html, /data-key="2"/);
    assert.match(html, /Ver Itens/);
});

test("toggleMark com mode invert recarrega DataTables e atualiza contador", async () => {
    let reloadCount = 0;
    let statusMsg = "";
    const fakeTable = {
        ajax: { reload() { reloadCount += 1; } }
    };
    const {Browse} = createRuntimeContext((type, req) => {
        assert.equal(type, "FWWEBEX_BROWSE_MARK");
        assert.equal(req.mode, "invert");
        return {
            type: "FWWEBEX_BROWSE_MARK_RESULT",
            payload: {
                id: req.id,
                ok: true,
                refresh: true,
                markedCount: 5,
                markedKeys: ["2", "3", "5", "6", "8"]
            }
        };
    });
    const res = await Browse.toggleMark("brw_m1", {mode: "invert"}, (m) => { statusMsg = m; }, fakeTable);
    assert.equal(res.markedCount, 5);
    assert.equal(reloadCount, 1);
    assert.equal(statusMsg, "5 registro(s) marcado(s).");
});

test("showFeedback renderiza alerta contextual no slot HEADER/FOOTER", () => {
    const slot = { className: "alert d-none", textContent: "" };
    const windowObj = {
        FWWebEx: {},
        document: {
            getElementById(id) {
                return id === "brw_fb" ? { getAttribute(a) { return a === "data-fwwebex-browse-feedback-mode" ? "HEADER" : null; } } : null;
            },
            querySelector(sel) {
                return sel === '[data-fwwebex-browse-feedback="brw_fb"]' ? slot : null;
            }
        }
    };
    vm.runInNewContext(runtimeCode, {
        window: windowObj, globalThis: windowObj, setTimeout, clearTimeout,
        Promise, Date, Map, Object, Array, String, Number, Error, JSON
    });
    const ok = windowObj.FWWebEx.Browse.showFeedback("brw_fb", "Titulos ja baixados nao podem ser marcados.", "warning");
    assert.equal(ok, true);
    assert.match(slot.className, /alert-warning/);
    assert.equal(slot.textContent, "Titulos ja baixados nao podem ser marcados.");
});

test("showFeedback delega para FWWebExAlert quando modo e POPUP", () => {
    let called = null;
    const windowObj = {
        FWWebEx: {},
        FWWebExAlert(msg, title, type) {
            called = { msg, title, type };
        },
        document: {
            getElementById(id) {
                return id === "brw_pop" ? { getAttribute(a) { return a === "data-fwwebex-browse-feedback-mode" ? "POPUP" : null; } } : null;
            }
        }
    };
    vm.runInNewContext(runtimeCode, {
        window: windowObj, globalThis: windowObj, setTimeout, clearTimeout,
        Promise, Date, Map, Object, Array, String, Number, Error, JSON
    });
    const ok = windowObj.FWWebEx.Browse.showFeedback("brw_pop", "Acao bloqueada.", "warning");
    assert.equal(ok, true);
    assert.equal(called.msg, "Acao bloqueada.");
    assert.equal(called.type, "warning");
});

test("syncSelectionHighlight reaplica classe fwwebex-row-selected apos draw/reload", () => {
    const row1Classes = new Set();
    const row2Classes = new Set();
    const attrs = new Map();
    const makeTr = (key, cls) => ({
        __key: key,
        classList: {
            add(c) { cls.add(c); },
            remove(c) { cls.delete(c); }
        },
        setAttribute(k, v) { attrs.set(key + ":" + k, v); },
        removeAttribute(k) { attrs.delete(key + ":" + k); }
    });
    const tr1 = makeTr(1, row1Classes);
    const tr2 = makeTr(2, row2Classes);
    const tbody = {
        addEventListener() {},
        querySelectorAll() { return [tr1, tr2]; }
    };
    const tableEl = {
        querySelector(sel) { return sel === "tbody" ? tbody : null; }
    };
    let drawCb = null;
    const fakeTable = {
        row(tr) { return { data() { return { __key: tr.__key }; } }; },
        on(evt, cb) { if (evt === "draw") drawCb = cb; }
    };

    const {Browse} = createRuntimeContext();
    const state = Browse.bindEvents("brw_sel", fakeTable, tableEl, null);
    state.selectedKey = 2;
    assert.equal(typeof drawCb, "function");
    const matched = drawCb();
    assert.equal(matched, 1);
    assert.equal(row1Classes.has("fwwebex-row-selected"), false);
    assert.equal(row2Classes.has("fwwebex-row-selected"), true);
    assert.equal(attrs.get("2:aria-selected"), "true");
});
