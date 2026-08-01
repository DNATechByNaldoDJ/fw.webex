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
        problems: new FakeNode("div"),
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
    let confirmResult = false;
    let confirmCalls = 0;
    let fileText = "";

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
            async generate(layout) {
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
        prompt: () => null,
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
        setRendererReport(report) {
            rendererReport = plain(report);
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
