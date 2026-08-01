import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import vm from "node:vm";

const labelsSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.labels.tlpp"
), "utf8");

const scripts = [...labelsSource.matchAll(
    /beginContent var \w+\s*([\s\S]*?)\s*endContent/g
)].map((match) => match[1]);

const runtimeSource = scripts.find((script) =>
    script.includes("function createSampleRecords") &&
    script.includes("FWWebExLabels.contract.createSampleRecords=createSampleRecords")
);
const designerSource = scripts.find((script) => script.includes(
    "root.__labelDesigner={addText:function"
));

assert.ok(runtimeSource, "embedded Labels contract runtime was not found");
assert.ok(designerSource, "embedded Labels designer runtime was not found");

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function loadContractAPI() {
    const window = {};
    vm.runInNewContext(runtimeSource, {console, window});
    return window.FWWebExLabels.contract;
}

function element(id, type, format = undefined) {
    const result = {
        id,
        type,
        template: `{{${id}}}`,
        box: {x: 1, y: 1, width: 25, height: 8}
    };
    if (format !== undefined) result.format = format;
    return result;
}

test("sample records honor examples, defaults, types and nested mnemonic paths", () => {
    const contract = loadContractAPI();
    const layout = {
        variables: [
            {name: "produto.codigo", type: "string", default: "SKU-BASE"},
            {name: "quantidade", type: "integer"},
            {name: "preco", type: "number"},
            {name: "ativo", type: "boolean"},
            {name: "metadados", type: "object"},
            {name: "tags", type: "array"},
            {name: "descricao", label: "Descricao comercial", type: "string"},
            {name: "categoria", type: "string", example: "QUIMICOS"}
        ],
        elements: [{
            id: "cliente",
            type: "text",
            template: "Cliente: {{cliente.nome}}",
            box: {x: 1, y: 1, width: 25, height: 8}
        }]
    };
    const original = plain(layout);

    const result = plain(contract.createSampleRecords(layout, []));

    assert.deepEqual(result.records, [{
        produto: {codigo: "SKU-BASE"},
        quantidade: 0,
        preco: 0,
        ativo: false,
        metadados: {},
        tags: [],
        descricao: "DESCRICAO COMERCIAL",
        categoria: "QUIMICOS",
        cliente: {nome: "NOME"}
    }]);
    assert.equal(result.createdRecord, true);
    assert.equal(result.changed, true);
    assert.deepEqual(
        Object.fromEntries(result.added.map((entry) => [entry.path, entry.source])),
        {
            "produto.codigo": "default",
            quantidade: "type",
            preco: "type",
            ativo: "type",
            metadados: "type",
            tags: "type",
            descricao: "name",
            categoria: "example",
            "cliente.nome": "name"
        }
    );
    assert.deepEqual(layout, original, "sample generation must not mutate the layout");
});

test("sample merge preserves every existing value and reports nested conflicts", () => {
    const contract = loadContractAPI();
    const layout = {
        variables: [
            {name: "produto.codigo", default: "NOVO"},
            {name: "produto.descricao", default: "DESCRICAO"},
            {name: "quantidade", type: "integer", default: 99},
            {name: "ativo", type: "boolean", default: true},
            {name: "observacao", type: "string", default: "SUBSTITUIR"},
            {name: "cliente.codigo", default: "CLIENTE"},
            {name: "lote", default: "L260801"}
        ],
        elements: []
    };
    const input = [{
        produto: {codigo: "MANUAL"},
        quantidade: 0,
        ativo: false,
        observacao: "",
        cliente: "NAO SUBSTITUIR"
    }, {
        produto: {codigo: "SEGUNDO"},
        lote: "LOTE MANUAL"
    }];
    const original = plain(input);

    const result = plain(contract.createSampleRecords(layout, input));

    assert.deepEqual(input, original, "sample merge must not mutate caller records");
    assert.deepEqual(result.records[0], {
        produto: {codigo: "MANUAL", descricao: "DESCRICAO"},
        quantidade: 0,
        ativo: false,
        observacao: "",
        cliente: "NAO SUBSTITUIR",
        lote: "L260801"
    });
    assert.deepEqual(result.records[1], {
        produto: {codigo: "SEGUNDO", descricao: "DESCRICAO"},
        lote: "LOTE MANUAL",
        quantidade: 99,
        ativo: true,
        observacao: "SUBSTITUIR",
        cliente: {codigo: "CLIENTE"}
    });
    assert.ok(result.preserved.some((entry) =>
        entry.recordIndex === 0 && entry.path === "observacao" && entry.value === "SUBSTITUIR"
    ));
    assert.ok(result.conflicts.some((entry) =>
        entry.recordIndex === 0 && entry.path === "cliente.codigo" && entry.at === "cliente"
    ));
});

test("sample barcodes receive deterministic values for every designer format", () => {
    const contract = loadContractAPI();
    const expected = {
        CODE128: "1234567890",
        EAN13: "789123456789",
        EAN8: "1234567",
        UPC: "12345678901",
        CODE39: "EXEMPLO",
        ITF14: "1234567890123",
        MSI: "123456",
        pharmacode: "1234"
    };
    const variables = Object.keys(expected).map((format) => ({
        name: `codigo.${format.toLowerCase()}`,
        type: "string"
    }));
    const elements = Object.keys(expected).map((format) => ({
        id: `barcode-${format}`,
        type: "barcode",
        template: `{{codigo.${format.toLowerCase()}}}`,
        format,
        box: {x: 1, y: 1, width: 40, height: 12}
    }));
    variables.push({name: "codigo.auto", type: "string"});
    elements.push({
        id: "barcode-auto",
        type: "barcode",
        template: "{{codigo.auto}}",
        format: "AUTO",
        box: {x: 1, y: 1, width: 40, height: 12}
    });

    const result = plain(contract.createSampleRecords({
        variables,
        elements,
        barcodeFallbackFormat: "CODE39"
    }, []));

    const record = result.records[0].codigo;
    for (const [format, value] of Object.entries(expected)) {
        assert.equal(record[format.toLowerCase()], value, format);
    }
    assert.equal(record.auto, "EXEMPLO", "AUTO must use the layout fallback format");
});

class FakeClassList {
    constructor(node) {
        this.node = node;
    }

    values() {
        return new Set(this.node.className.split(/\s+/).filter(Boolean));
    }

    contains(name) {
        return this.values().has(name);
    }

    toggle(name, force) {
        const values = this.values();
        const enabled = force === undefined ? !values.has(name) : force === true;
        if (enabled) values.add(name);
        else values.delete(name);
        this.node.className = [...values].join(" ");
        return enabled;
    }

    add(...names) {
        const values = this.values();
        names.forEach((name) => values.add(name));
        this.node.className = [...values].join(" ");
    }

    remove(...names) {
        const values = this.values();
        names.forEach((name) => values.delete(name));
        this.node.className = [...values].join(" ");
    }
}

class FakeNode {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentElement = null;
        this.style = {setProperty(name, value) { this[name] = value; }};
        this.dataset = {};
        this.attributes = new Map();
        this.className = "";
        this.classList = new FakeClassList(this);
        this.textContent = "";
        this.value = "";
        this.hidden = false;
        this.disabled = false;
        this.files = [];
        this.options = [];
        this.clientWidth = 1000;
        this.clientHeight = 600;
        this.listeners = new Map();
        this.dispatched = [];
        this._src = "";
    }

    set src(value) { this._src = String(value ?? ""); }
    get src() { return this._src; }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        if (this.tagName === "SELECT" && child.tagName === "OPTION") {
            this.options.push(child);
        }
        return child;
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatch(type, event = {}) {
        const payload = {
            target: this,
            currentTarget: this,
            preventDefault() {},
            stopPropagation() {},
            shiftKey: false,
            altKey: false,
            ctrlKey: false,
            metaKey: false,
            ...event
        };
        for (const listener of this.listeners.get(type) || []) listener(payload);
        return payload;
    }

    dispatchEvent(event) {
        this.dispatched.push(event);
        for (const listener of this.listeners.get(event.type) || []) listener(event);
        return true;
    }

    querySelector(selector) {
        if (selector === ".fwwebex-label-field-content") {
            return this.children.find((child) =>
                child.classList.contains("fwwebex-label-field-content")
            ) || null;
        }
        return null;
    }

    querySelectorAll() { return []; }

    closest(selector) {
        if (selector === "[data-action]" && this.dataset.action) return this;
        if (selector === ".fwwebex-label-field" &&
            this.classList.contains("fwwebex-label-field")) return this;
        if (selector === ".fwwebex-label-pane" &&
            this.classList.contains("fwwebex-label-pane")) return this;
        return this.parentElement ? this.parentElement.closest(selector) : null;
    }

    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) {
        this.attributes.delete(name);
        if (name === "src") this._src = "";
    }

    getBoundingClientRect() {
        return {
            left: 0,
            top: 0,
            width: this.clientWidth,
            height: this.clientHeight,
            right: this.clientWidth,
            bottom: this.clientHeight
        };
    }

    setPointerCapture() {}
    releasePointerCapture() {}
    scrollIntoView() {}
    click() {}

    set innerHTML(value) {
        if (value === "") {
            this.children.forEach((child) => { child.parentElement = null; });
            this.children = [];
            this.options = [];
        }
    }

    get innerHTML() { return ""; }
}

function designerLayout() {
    return {
        schema: "fwwebex.labels",
        version: 2,
        name: "sample-designer",
        unit: "mm",
        page: {width: 100, height: 60, rotation: 0},
        editor: {},
        variables: [{name: "produto", type: "string"}],
        barcodeAutoRules: [],
        barcodeFallbackFormat: "CODE128",
        background: null,
        elements: [element("produto", "text")]
    };
}

async function createDesignerHarness() {
    const root = new FakeNode("section");
    root.id = "designer-sample-records";
    const stage = new FakeNode("div");
    const background = new FakeNode("img");
    const fields = new FakeNode("div");
    stage.appendChild(background);
    stage.appendChild(fields);
    const roles = {
        stage,
        background,
        fields,
        toolbar: new FakeNode("div"),
        "contract-editor": new FakeNode("textarea"),
        "records-editor": new FakeNode("textarea"),
        problems: new FakeNode("div"),
        "status-message": new FakeNode("span"),
        "status-selection": new FakeNode("span"),
        "contract-state": new FakeNode("span")
    };
    root.querySelector = (selector) => {
        const match = /^\[data-role=(?:"([^"]+)"|([^\]]+))\]$/.exec(selector);
        return match ? roles[match[1] || match[2]] || null : null;
    };
    root.querySelectorAll = () => [];

    const document = {
        activeElement: null,
        createElement: (tagName) => new FakeNode(tagName),
        getElementById: (id) => id === root.id ? root : null
    };
    const frameQueue = [];
    const window = {
        prompt: () => null,
        confirm: () => true,
        requestAnimationFrame(callback) {
            frameQueue.push(callback);
            return frameQueue.length;
        },
        cancelAnimationFrame() {},
        setTimeout(callback) {
            callback();
            return 1;
        },
        open: () => null
    };
    const context = vm.createContext({
        console,
        document,
        window,
        CustomEvent: class {
            constructor(type, options) {
                this.type = type;
                this.detail = options && options.detail;
                this.bubbles = options && options.bubbles === true;
            }
        },
        requestAnimationFrame: window.requestAnimationFrame,
        cancelAnimationFrame: window.cancelAnimationFrame,
        setTimeout: window.setTimeout,
        clearTimeout() {},
        Map,
        Set,
        Promise
    });

    vm.runInContext(runtimeSource, context);
    vm.runInContext(
        designerSource
            .replaceAll("__ID__", root.id)
            .replaceAll("__WIDTH__", "100")
            .replaceAll("__HEIGHT__", "60")
            .replaceAll("__LAYOUT_JSON__", "")
            .replaceAll("__RECORDS_JSON__", "[]")
            .replaceAll("__OPTIONS_JSON__", "{}"),
        context
    );
    await Promise.resolve();
    await Promise.resolve();
    return {root, roles, api: root.__labelDesigner};
}

test("designer auto-completes empty data but never overwrites a manual JSON draft", async () => {
    const harness = await createDesignerHarness();
    harness.api.load(designerLayout());

    assert.deepEqual(JSON.parse(harness.roles["records-editor"].value), [{
        produto: "PRODUTO"
    }]);

    harness.api.addText({id: "lote", template: "{{lote}}"});
    assert.deepEqual(JSON.parse(harness.roles["records-editor"].value), [{
        produto: "PRODUTO",
        lote: "LOTE"
    }], "automatic samples must follow new design mnemonics while data is untouched");

    const manualJSON = '[\n  {"produto": "EDITADO PELO USUARIO"}\n]';
    harness.roles["records-editor"].value = manualJSON;
    harness.root.dispatch("input", {target: harness.roles["records-editor"]});
    harness.api.addText({id: "validade", template: "{{validade}}"});

    assert.equal(
        harness.roles["records-editor"].value,
        manualJSON,
        "a design change must preserve manual JSON byte for byte"
    );

    const button = new FakeNode("button");
    button.dataset.action = "generate-sample-records";
    harness.root.dispatch("click", {target: button});

    assert.deepEqual(JSON.parse(harness.roles["records-editor"].value), [{
        produto: "EDITADO PELO USUARIO",
        lote: "LOTE",
        validade: "VALIDADE"
    }]);
    const buttonEvent = harness.root.dispatched.filter((event) =>
        event.type === "fwwebex:label-datachange"
    ).at(-1);
    assert.equal(buttonEvent?.detail.source, "button");
    assert.equal(buttonEvent?.detail.records[0].produto, "EDITADO PELO USUARIO");

    harness.api.addText({id: "peso", template: "{{peso}}"});
    assert.equal(
        JSON.parse(harness.roles["records-editor"].value)[0].peso,
        "PESO",
        "the explicit button may re-enable automatic completion for later design changes"
    );
});
