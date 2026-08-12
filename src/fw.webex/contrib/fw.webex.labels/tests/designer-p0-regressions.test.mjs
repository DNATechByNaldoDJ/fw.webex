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

const designerSource = scripts.find((script) => script.includes(
    "root.__labelDesigner={addText:function"
));
const generatorSource = scripts.find((script) => script.includes(
    "function elementRotationMatrix"
));

assert.ok(designerSource, "embedded Labels designer runtime was not found");
assert.ok(generatorSource, "embedded Labels renderer runtime was not found");

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function canonicalLayout(name = "original") {
    return {
        schema: "fwwebex.labels",
        version: 2,
        name,
        unit: "mm",
        page: {
            width: 100,
            height: 60,
            rotation: 0,
            margins: {top: 0, right: 0, bottom: 0, left: 0},
            safeArea: 0,
            bleed: 0
        },
        background: null,
        editor: {
            grid: {enabled: false, step: 1},
            snap: {
                enabled: false,
                tolerancePx: 8,
                referenceElementId: null,
                chainMode: false
            },
            guides: []
        },
        variables: [{
            name: "produto",
            label: "Produto",
            type: "string",
            required: false,
            default: ""
        }],
        barcodeAutoRules: [],
        barcodeFallbackFormat: "CODE128",
        elements: [{
            id: "produto",
            name: "Produto",
            type: "text",
            template: "{{produto}}",
            box: {x: 10, y: 10, width: 30, height: 8},
            rotation: 30,
            zIndex: 1,
            locked: false,
            hidden: false,
            containerId: null,
            style: {
                fontFamily: "helvetica",
                fontSize: 10,
                minFontSize: 5,
                fontStyle: "normal",
                color: "#000000",
                lineHeightFactor: 1.15,
                letterSpacing: 0,
                align: "left",
                verticalAlign: "top",
                padding: {top: 0, right: 0, bottom: 0, left: 0},
                margin: {top: 0, right: 0, bottom: 0, left: 0}
            },
            fit: {mode: "shrink", maxLines: 1, overflow: "error"},
            textOptions: {}
        }]
    };
}

class FakeClassList {
    constructor(node) {
        this.node = node;
    }

    contains(name) {
        return this.node.className.split(/\s+/).filter(Boolean).includes(name);
    }

    toggle(name, force) {
        const names = new Set(this.node.className.split(/\s+/).filter(Boolean));
        const enabled = force === undefined ? !names.has(name) : force === true;
        if (enabled) names.add(name);
        else names.delete(name);
        this.node.className = [...names].join(" ");
        return enabled;
    }

    add(...names) {
        const current = new Set(
            this.node.className.split(/\s+/).filter(Boolean)
        );
        names.forEach((name) => current.add(name));
        this.node.className = [...current].join(" ");
    }

    remove(...names) {
        const current = new Set(
            this.node.className.split(/\s+/).filter(Boolean)
        );
        names.forEach((name) => current.delete(name));
        this.node.className = [...current].join(" ");
    }
}

class FakeNode {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentElement = null;
        this.style = {
            setProperty(name, value) {
                this[name] = value;
            }
        };
        this.dataset = {};
        this.attributes = new Map();
        this.className = "";
        this.classList = new FakeClassList(this);
        this.textContent = "";
        this.value = "";
        this.hidden = false;
        this.disabled = false;
        this.readOnly = false;
        this.files = [];
        this.options = [];
        this.clientWidth = 1000;
        this.clientHeight = 600;
        this.scrollWidth = 0;
        this.scrollHeight = 0;
        this.listeners = new Map();
        this.dispatched = [];
        this._src = "";
    }

    set src(value) {
        this._src = String(value ?? "");
    }

    get src() {
        return this._src;
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        if (this.tagName === "SELECT" && child.tagName === "OPTION") {
            this.options.push(child);
        }
        return child;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
        if (name === "src") this._src = "";
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatch(type, event = {}) {
        const payload = {
            type,
            target: this,
            currentTarget: this,
            preventDefault() {},
            stopPropagation() {},
            shiftKey: false,
            altKey: false,
            ctrlKey: false,
            metaKey: false,
            pointerId: 1,
            clientX: 0,
            clientY: 0,
            ...event
        };
        for (const listener of this.listeners.get(type) || []) {
            listener(payload);
        }
        return payload;
    }

    dispatchEvent(event) {
        this.dispatched.push(event);
        for (const listener of this.listeners.get(event.type) || []) {
            listener(event);
        }
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

    querySelectorAll() {
        return [];
    }

    closest(selector) {
        if (selector === "[data-action]" && this.dataset.action) return this;
        if (selector === ".fwwebex-label-pane" &&
            this.classList.contains("fwwebex-label-pane")) {
            return this;
        }
        if (selector === ".fwwebex-label-field" &&
            this.classList.contains("fwwebex-label-field")) {
            return this;
        }
        return this.parentElement ? this.parentElement.closest(selector) : null;
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
            this.children.forEach((child) => {
                child.parentElement = null;
            });
            this.children = [];
            this.options = [];
        }
    }

    get innerHTML() {
        return "";
    }
}

function createHarness() {
    const root = new FakeNode("section");
    root.id = "designer-p0";

    const stage = new FakeNode("div");
    const background = new FakeNode("img");
    const fields = new FakeNode("div");
    stage.appendChild(background);
    stage.appendChild(fields);

    const layersPanel = new FakeNode("aside");
    layersPanel.className = "fwwebex-label-pane fwwebex-label-layers";
    const layers = new FakeNode("ul");
    layersPanel.appendChild(layers);

    const inspectorPanel = new FakeNode("aside");
    inspectorPanel.className = "fwwebex-label-pane fwwebex-label-inspector";
    const inspector = new FakeNode("div");
    inspectorPanel.appendChild(inspector);

    const roles = {
        stage,
        background,
        fields,
        toolbar: new FakeNode("div"),
        layers,
        "layers-panel": layersPanel,
        inspector,
        "inspector-panel": inspectorPanel,
        drawers: new FakeNode("div"),
        "contract-editor": new FakeNode("textarea"),
        "records-editor": new FakeNode("textarea"),
        "record-index": new FakeNode("select"),
        problems: new FakeNode("div"),
        "resolved-value": new FakeNode("div"),
        status: new FakeNode("div"),
        "status-message": new FakeNode("span"),
        "contract-state": new FakeNode("span"),
        "preview-canvas": new FakeNode("canvas")
    };

    root.querySelector = (selector) => {
        const roleMatch = /^\[data-role=(?:"([^"]+)"|([^\]]+))\]$/.exec(
            selector
        );
        if (roleMatch) return roles[roleMatch[1] || roleMatch[2]] || null;
        return null;
    };
    root.querySelectorAll = () => [];

    let rendererReport = {
        valid: true,
        issues: [],
        errors: [],
        warnings: [],
        metrics: {records: []}
    };
    let rendererErrorReport = null;
    let confirmResult = false;
    let confirmCalls = 0;
    let fileText = "";
    let promptResult = null;
    const rendererCalls = [];

    class FakeFileReader {
        readAsText() {
            this.result = fileText;
            if (typeof this.onload === "function") this.onload();
        }

        readAsDataURL() {
            if (typeof this.onerror === "function") {
                this.onerror(new Error("not implemented by this harness"));
            }
        }
    }

    const labels = {
        contract: {
            normalize(layout) {
                return plain(layout);
            }
        },
        layout: {
            resolve(layout) {
                return {
                    layout: plain(layout),
                    report: {
                        valid: true,
                        issues: [],
                        errors: [],
                        warnings: [],
                        metrics: {records: []}
                    }
                };
            }
        },
        renderer: {
            async generate(layout, records, options) {
                rendererCalls.push({
                    layout: plain(layout),
                    records: plain(records),
                    options: plain(options || {})
                });
                if (rendererErrorReport) {
                    const error = new Error("Validation failed");
                    error.report = plain(rendererErrorReport);
                    throw error;
                }
                return {
                    output: null,
                    layout: plain(layout),
                    report: plain(rendererReport)
                };
            }
        }
    };
    const frameQueue = [];
    const document = {
        activeElement: null,
        createElement: (tagName) => new FakeNode(tagName),
        getElementById: (id) => id === root.id ? root : null
    };
    const window = {
        FWWebExLabels: labels,
        confirm() {
            confirmCalls += 1;
            return confirmResult;
        },
        prompt: () => promptResult,
        requestAnimationFrame(callback) {
            frameQueue.push(callback);
            return frameQueue.length;
        },
        cancelAnimationFrame() {},
        setTimeout(callback) {
            callback();
            return 1;
        },
        URL: {
            createObjectURL: () => "blob:test",
            revokeObjectURL() {}
        },
        open: () => null
    };
    const context = vm.createContext({
        console,
        CustomEvent: class {
            constructor(type, options) {
                this.type = type;
                this.detail = options && options.detail;
                this.bubbles = options && options.bubbles === true;
            }
        },
        Blob: class {},
        FileReader: FakeFileReader,
        document,
        window,
        requestAnimationFrame: window.requestAnimationFrame,
        cancelAnimationFrame: window.cancelAnimationFrame,
        Map,
        Set,
        Promise
    });

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

    return {
        root,
        roles,
        layersPanel,
        inspectorPanel,
        fields,
        api: root.__labelDesigner,
        flushFrames() {
            const pending = frameQueue.splice(0);
            pending.forEach((callback) => callback(0));
        },
        setConfirmResult(value) {
            confirmResult = value === true;
        },
        getConfirmCalls() {
            return confirmCalls;
        },
        setFileText(value) {
            fileText = value;
        },
        setPromptResult(value) {
            promptResult = value;
        },
        getRendererCalls() {
            return rendererCalls;
        },
        clearRendererCalls() {
            rendererCalls.length = 0;
        },
        setRendererReport(report) {
            rendererReport = plain(report);
            rendererErrorReport = null;
        },
        setRendererErrorReport(report) {
            rendererErrorReport = plain(report);
        }
    };
}

test("designer and PDF rotate elements around the same box pivot", () => {
    const fieldCSS = labelsSource.match(
        /\.fwwebex-label-field\s*\{([\s\S]*?)\}/
    )?.[1] || "";
    const declaredOrigin = /transform-origin\s*:\s*([^;}\n]+)/i.exec(
        fieldCSS
    )?.[1].trim().toLowerCase() || "50% 50%";
    const designerPivot = /(?:center|50%)/.test(declaredOrigin)
        ? "center"
        : /(?:top\s+left|left\s+top|0(?:px|%)?\s+0(?:px|%)?)/.test(
            declaredOrigin
        )
            ? "top-left"
            : declaredOrigin;

    const matrixSource = /function elementRotationMatrix\([\s\S]*?\n    \}/
        .exec(generatorSource)?.[0] || "";
    const pdfPivot = /box\.width\s*\/\s*2/.test(matrixSource) &&
        /box\.height\s*\/\s*2/.test(matrixSource)
        ? "center"
        : /\bbox\.x\b/.test(matrixSource) && /\bbox\.y\b/.test(matrixSource)
            ? "top-left"
            : "unknown";

    assert.notEqual(pdfPivot, "unknown", "PDF element pivot must be explicit");
    assert.equal(
        designerPivot,
        pdfPivot,
        `designer uses ${designerPivot}, PDF uses ${pdfPivot}`
    );
});

test("dirty contract import requires confirmation and preserves the draft when declined", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.load(canonicalLayout("original"));

    const draft = JSON.stringify(canonicalLayout("draft"), null, 2);
    harness.roles["contract-editor"].value = draft;
    harness.root.dispatch("input", {
        target: harness.roles["contract-editor"]
    });

    harness.setConfirmResult(false);
    harness.setFileText(JSON.stringify(canonicalLayout("imported")));
    harness.roles["layout-file"] = harness.roles["layout-file"] ||
        new FakeNode("input");
    harness.roles["layout-file"].files = [{name: "imported.json"}];
    harness.root.dispatch("change", {
        target: harness.roles["layout-file"]
    });

    assert.equal(harness.getConfirmCalls(), 1);
    assert.equal(harness.api.exportLayout().name, "original");
    assert.equal(harness.roles["contract-editor"].value, draft);
    assert.equal(harness.roles["contract-state"].dataset.state, "dirty");
});

test("showLayers and showInspector hide their complete panels", async () => {
    const harness = createHarness();
    await Promise.resolve();

    harness.api.setOptions({
        showLayers: false,
        showInspector: false
    });

    assert.equal(harness.layersPanel.hidden, true);
    assert.equal(harness.inspectorPanel.hidden, true);

    harness.api.setOptions({
        showLayers: true,
        showInspector: true
    });
    assert.equal(harness.layersPanel.hidden, false);
    assert.equal(harness.inspectorPanel.hidden, false);
});

test("structured element issues are reflected on their canvas boxes", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.load(canonicalLayout());

    const issue = {
        code: "TEXT_OVERFLOW",
        severity: "error",
        path: "/elements/0/fit/overflow",
        elementId: "produto",
        recordIndex: 0,
        phase: "renderer",
        message: "Texto nao cabe.",
        suggestion: "Aumente a caixa.",
        details: null
    };
    harness.setRendererReport({
        valid: false,
        issues: [issue],
        errors: [issue],
        warnings: [],
        metrics: {records: []}
    });

    try {
        await harness.api.validate();
    } catch {
        /*
          Some renderers resolve with an invalid report while others reject.
          Both paths are valid here: this regression checks the canvas state.
        */
    }

    const field = harness.fields.children.find(
        (child) => child.dataset.id === "produto"
    );
    assert.ok(field, "produto field must exist on the canvas");
    const visualClass = /(?:has-(?:validation-)?error|has-issue|is-invalid)/
        .test(field.className);
    const visualData = ["error", "invalid"].includes(
        String(
            field.dataset.issueSeverity ||
            field.dataset.severity ||
            field.dataset.validationState ||
            ""
        ).toLowerCase()
    );
    const accessibleState = field.getAttribute("aria-invalid") === "true";
    assert.ok(
        visualClass || visualData || accessibleState,
        "TEXT_OVERFLOW must mark the produto canvas box"
    );
});

test("pointer resize synchronizes basisBox and does not restore the old size", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: false});
    harness.api.load(canonicalLayout());

    const field = harness.fields.children.find(
        (child) => child.dataset.id === "produto"
    );
    const grip = field.children.find((child) => child.dataset.resize === "1");
    assert.ok(grip, "produto resize grip must exist");

    harness.roles.stage.dispatch("pointerdown", {
        target: grip,
        clientX: 400,
        clientY: 180,
        pointerId: 7
    });
    harness.roles.stage.dispatch("pointermove", {
        target: grip,
        clientX: 450,
        clientY: 210,
        pointerId: 7
    });
    harness.flushFrames();
    harness.roles.stage.dispatch("pointerup", {
        target: grip,
        clientX: 450,
        clientY: 210,
        pointerId: 7
    });

    const produto = harness.api.exportLayout().elements.find(
        (item) => item.id === "produto"
    );
    assert.deepEqual(plain(produto.box), {
        x: 10, y: 10, width: 35, height: 11
    });
    assert.deepEqual(plain(produto.basisBox), {width: 35, height: 11});
});

test("pointer resize preserves the structural content minimum", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: false});
    const layout = canonicalLayout();
    layout.elements[0].style.padding = {top: 1, right: 2, bottom: 1, left: 2};
    harness.api.load(layout);

    const field = harness.fields.children.find(
        (child) => child.dataset.id === "produto"
    );
    const grip = field.children.find((child) => child.dataset.resize === "1");
    harness.roles.stage.dispatch("pointerdown", {
        target: grip,
        clientX: 400,
        clientY: 180,
        pointerId: 8
    });
    harness.roles.stage.dispatch("pointermove", {
        target: grip,
        clientX: 0,
        clientY: 0,
        pointerId: 8
    });
    harness.roles.stage.dispatch("pointerup", {target: grip, pointerId: 8});

    const produto = harness.api.exportLayout().elements.find(
        (item) => item.id === "produto"
    );
    const minimumHeight = 2 + 5 * 0.352778 * 1.15;
    assert.equal(produto.box.width, 4.1);
    assert.ok(Math.abs(produto.box.height - minimumHeight) < 0.000001);
    assert.deepEqual(plain(produto.basisBox), plain({
        width: produto.box.width,
        height: produto.box.height
    }));
    assert.match(harness.roles["resolved-value"].textContent, /Mínimo estrutural/);
    assert.match(harness.roles["resolved-value"].textContent, /Política: shrink \/ error/);
});

test("a simple click keeps the report while a real resize invalidates it", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: false});
    harness.api.load(canonicalLayout());
    const issue = {
        code: "TEXT_OVERFLOW",
        severity: "error",
        path: "/elements/0/fit/overflow",
        elementId: "produto",
        recordIndex: 0,
        phase: "renderer",
        message: "Texto nao cabe.",
        suggestion: "Aumente a caixa.",
        details: {requiredWidth: 42, availableWidth: 30}
    };
    harness.setRendererReport({
        valid: false,
        issues: [issue],
        errors: [issue],
        warnings: [],
        metrics: {records: []}
    });
    await harness.api.validate();

    const previousCause = harness.roles.problems.children[0];
    const previousDetails = previousCause.children.find((child) =>
        child.className === "fwwebex-label-problem-details"
    );
    assert.ok(previousDetails, "the current diagnostic must expose measurements");
    assert.match(
        previousDetails.children[0].children[0].textContent,
        /requiredWidth.*42/
    );

    let field = harness.fields.children.find(
        (child) => child.dataset.id === "produto"
    );
    harness.roles.stage.dispatch("pointerdown", {
        target: field,
        clientX: 100,
        clientY: 100
    });
    harness.roles.stage.dispatch("pointerup", {target: field});
    field = harness.fields.children.find((child) => child.dataset.id === "produto");
    assert.match(field.className, /has-issue-error/);

    const grip = field.children.find((child) => child.dataset.resize === "1");
    harness.roles.stage.dispatch("pointerdown", {
        target: grip,
        clientX: 400,
        clientY: 180
    });
    harness.roles.stage.dispatch("pointermove", {
        target: grip,
        clientX: 420,
        clientY: 190
    });
    harness.flushFrames();
    harness.roles.stage.dispatch("pointerup", {target: grip});

    field = harness.fields.children.find((child) => child.dataset.id === "produto");
    assert.doesNotMatch(field.className, /has-issue-error/);
    assert.equal(harness.roles.problems.dataset.stale, "true");
    assert.equal(
        harness.roles.problems.children.length,
        1,
        "the previous expandable diagnosis must remain available while stale"
    );
    assert.equal(
        harness.roles.problems.children[0],
        previousCause,
        "invalidation must preserve the expanded diagnostic DOM"
    );
    assert.equal(
        previousDetails.children[0].children[0].textContent,
        JSON.stringify(issue.details),
        "stale diagnostics must retain their measurement details"
    );
});

test("designer renders repeated record diagnostics as one expandable cause", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.load(canonicalLayout());
    const issues = [0, 1].map((recordIndex) => ({
        code: "TEXT_OVERFLOW",
        severity: "error",
        path: "/elements/0/fit/overflow",
        elementId: "produto",
        recordIndex,
        phase: "renderer",
        message: "Texto nao cabe.",
        suggestion: "Aumente a caixa."
    }));
    harness.setRendererReport({
        valid: false,
        issues,
        errors: issues,
        warnings: [],
        metrics: {records: []}
    });

    await harness.api.validate();
    assert.equal(harness.roles.problems.children.length, 1);
    const cause = harness.roles.problems.children[0];
    assert.equal(cause.tagName, "DETAILS");
    assert.equal(cause.dataset.code, "TEXT_OVERFLOW");
    assert.match(
        cause.children.map((child) => child.textContent).join(" "),
        /2 ocorr.ncias|registros 1, 2/i
    );
});

test("designer caps occurrence rows while retaining the raw diagnostic count", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: false});
    harness.api.load(canonicalLayout());
    const issues = Array.from({length: 100}, (_, recordIndex) => ({
        code: "TEXT_OVERFLOW",
        severity: "error",
        path: "/elements/0/fit/overflow",
        elementId: "produto",
        recordIndex,
        phase: "renderer",
        message: "Texto nao cabe.",
        suggestion: "Aumente a caixa."
    }));
    harness.setRendererReport({
        valid: false,
        issues,
        errors: issues,
        warnings: [],
        metrics: {records: []}
    });

    await harness.api.validate();
    assert.equal(harness.roles.problems.children.length, 1);
    const cause = harness.roles.problems.children[0];
    const occurrenceList = cause.children.find((child) =>
        child.className === "fwwebex-label-problem-details"
    );
    assert.ok(occurrenceList);
    assert.equal(
        occurrenceList.children.length,
        26,
        "only 25 occurrences plus one continuation row should enter the DOM"
    );
    assert.match(occurrenceList.children[25].textContent, /75 ocorr[eê]ncias adicionais/);
    assert.match(cause.children[0].textContent, /100 ocorr[eê]ncias/);
});

test("double-click editing invalidates diagnostics and creates an undo checkpoint", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: false});
    harness.api.load(canonicalLayout());
    const issue = {
        code: "TEXT_OVERFLOW",
        severity: "error",
        path: "/elements/0/fit/overflow",
        elementId: "produto",
        recordIndex: 0,
        phase: "renderer",
        message: "Texto nao cabe.",
        suggestion: "Aumente a caixa.",
        details: {requiredWidth: 42}
    };
    harness.setRendererReport({
        valid: false,
        issues: [issue],
        errors: [issue],
        warnings: [],
        metrics: {records: []}
    });
    await harness.api.validate();

    const field = harness.fields.children.find(
        (child) => child.dataset.id === "produto"
    );
    harness.setPromptResult("Produto: {{produto}}");
    harness.roles.stage.dispatch("dblclick", {target: field});

    assert.equal(
        harness.api.exportLayout().elements[0].template,
        "Produto: {{produto}}"
    );
    assert.equal(harness.roles.problems.dataset.stale, "true");
    assert.equal(harness.roles.problems.children.length, 1);
    assert.equal(harness.api.undo(), true);
    assert.equal(harness.api.exportLayout().elements[0].template, "{{produto}}");
});

test("public add mutator invalidates diagnostics and participates in history", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: false});
    harness.api.load(canonicalLayout());
    await harness.api.validate();

    harness.api.addText({id: "lote", template: "{{lote}}"});
    assert.equal(harness.roles.problems.dataset.stale, "true");
    assert.ok(harness.api.exportLayout().elements.some((item) => item.id === "lote"));
    assert.equal(harness.api.undo(), true);
    assert.equal(
        harness.api.exportLayout().elements.some((item) => item.id === "lote"),
        false
    );
});

test("automatic validation uses the active record and remaps its report", async () => {
    const harness = createHarness();
    await Promise.resolve();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: false});
    harness.api.load(canonicalLayout());
    const records = [
        {produto: "PRIMEIRO"},
        {produto: "REGISTRO ATIVO"},
        {produto: "TERCEIRO"}
    ];
    harness.api.setRecords(records);
    harness.roles["record-index"].value = "1";
    harness.root.dispatch("change", {
        target: harness.roles["record-index"]
    });

    const issues = [{
        code: "TEXT_OVERFLOW",
        severity: "error",
        path: "/0/produto",
        elementId: "produto",
        recordIndex: 0,
        phase: "renderer",
        message: "Texto nao cabe."
    }, {
        code: "DATA_REQUIRED",
        severity: "error",
        path: "/records/0/produto",
        elementId: "produto",
        recordIndex: 0,
        phase: "data",
        message: "Valor obrigatorio."
    }];
    harness.setRendererReport({
        valid: false,
        issues,
        errors: [],
        warnings: [],
        metrics: {records: [{elements: {produto: {fontSize: 7}}}]}
    });
    harness.clearRendererCalls();

    const validation = await harness.api.validate({automatic: true});

    const calls = harness.getRendererCalls();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].records, [records[1]]);
    assert.deepEqual(calls[0].options, {
        output: "none",
        returnResult: true,
        validateOnly: true
    });

    assert.deepEqual(
        plain(validation.issues.map((issue) => ({
            recordIndex: issue.recordIndex,
            path: issue.path
        }))),
        [
            {recordIndex: 1, path: "/1/produto"},
            {recordIndex: 1, path: "/records/1/produto"}
        ]
    );
    assert.deepEqual(plain(validation.validationScope), {
        mode: "active-record",
        recordIndex: 1,
        sourceRecordCount: 3
    });
    assert.equal(harness.roles.problems.dataset.validationScope, "active-record");
    assert.match(harness.roles.problems.dataset.scopeMessage, /registro 2 de 3/i);
    assert.equal(validation.metrics.records[0], undefined);
    assert.deepEqual(
        plain(validation.metrics.records[1]),
        {elements: {produto: {fontSize: 7}}}
    );
});

test("manual validation keeps the complete record batch", async () => {
    const harness = createHarness();
    await Promise.resolve();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: false});
    harness.api.load(canonicalLayout());
    const records = [
        {produto: "A"},
        {produto: "B"},
        {produto: "C"}
    ];
    harness.api.setRecords(records);
    harness.clearRendererCalls();

    const report = await harness.api.validate();
    const calls = harness.getRendererCalls();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].records, records);
    assert.equal(calls[0].options.validateOnly, false);
    assert.deepEqual(plain(report.validationScope), {
        mode: "all-records",
        sourceRecordCount: 3
    });
});

test("records editor clamps the active index before automatic validation", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: false});
    harness.api.load(canonicalLayout());
    harness.api.setRecords([
        {produto: "A"},
        {produto: "B"},
        {produto: "C"}
    ]);
    harness.roles["record-index"].value = "2";
    harness.root.dispatch("change", {target: harness.roles["record-index"]});

    harness.roles["records-editor"].value = '[{"produto":"UNICO"}]';
    harness.root.dispatch("input", {target: harness.roles["records-editor"]});
    const report = await harness.api.validate({automatic: true});

    assert.deepEqual(plain(report.validationScope), {
        mode: "active-record",
        recordIndex: 0,
        sourceRecordCount: 1
    });
    assert.match(harness.roles.problems.dataset.scopeMessage, /registro 1 de 1/i);
});

test("automatic validation remaps reports rejected by the renderer", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: false});
    harness.api.load(canonicalLayout());
    harness.api.setRecords([{produto: "A"}, {produto: "B"}]);
    harness.roles["record-index"].value = "1";
    harness.root.dispatch("change", {target: harness.roles["record-index"]});
    const issue = {
        code: "TEXT_OVERFLOW",
        severity: "error",
        path: "/0/produto",
        elementId: "produto",
        recordIndex: 0,
        message: "Texto nao cabe."
    };
    harness.setRendererErrorReport({
        valid: false,
        issues: [issue],
        errors: [issue],
        warnings: [],
        metrics: {records: [{elements: {produto: {lineCount: 2}}}]}
    });

    await assert.rejects(
        harness.api.validate({automatic: true}),
        (error) => {
            assert.equal(error.report.issues[0].recordIndex, 1);
            assert.equal(error.report.issues[0].path, "/1/produto");
            assert.equal(error.report.errors[0].recordIndex, 1);
            assert.equal(error.report.errors[0].path, "/1/produto");
            assert.equal(error.report.metrics.records[0], undefined);
            assert.equal(error.report.metrics.records[1].elements.produto.lineCount, 2);
            assert.deepEqual(plain(error.report.validationScope), {
                mode: "active-record",
                recordIndex: 1,
                sourceRecordCount: 2
            });
            return true;
        }
    );
});

test("pending contract JSON blocks automatic validation", async () => {
    const harness = createHarness();
    await Promise.resolve();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: true});
    harness.api.load(canonicalLayout());
    await Promise.resolve();
    await Promise.resolve();
    harness.clearRendererCalls();

    const editor = harness.roles["contract-editor"];
    editor.value = JSON.stringify(canonicalLayout("rascunho"));
    harness.root.dispatch("input", {target: editor});
    const report = await harness.api.validate({automatic: true});
    harness.api.setRecords([{produto: "ALTERADO"}]);
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(report, null);
    assert.equal(harness.getRendererCalls().length, 0);
    assert.equal(harness.roles["contract-state"].dataset.state, "dirty");
});

test("discarding a pending contract resumes automatic validation", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.setOptions({autoValidate: true});
    harness.api.load(canonicalLayout());
    await Promise.resolve();
    harness.clearRendererCalls();

    harness.roles["contract-editor"].value = "{";
    harness.root.dispatch("input", {target: harness.roles["contract-editor"]});
    assert.equal(harness.getRendererCalls().length, 0);

    const discard = new FakeNode("button");
    discard.dataset.action = "discard-json";
    harness.root.dispatch("click", {target: discard});
    await Promise.resolve();

    assert.equal(harness.roles["contract-state"].dataset.state, "clean");
    assert.equal(harness.getRendererCalls().length, 1);
    assert.equal(harness.getRendererCalls()[0].options.validateOnly, true);
});
