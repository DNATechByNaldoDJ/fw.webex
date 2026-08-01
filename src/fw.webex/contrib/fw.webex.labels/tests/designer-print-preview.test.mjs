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

assert.ok(designerSource, "embedded Labels designer runtime was not found");

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function deferred() {
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });
    return {promise, resolve: resolvePromise, reject: rejectPromise};
}

function layoutAt(rotation = 0) {
    return {
        schema: "fwwebex.labels",
        version: 2,
        name: `preview-${rotation}`,
        unit: "mm",
        page: {
            width: 100,
            height: 60,
            rotation,
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
        variables: [],
        barcodeAutoRules: [],
        barcodeFallbackFormat: "CODE128",
        elements: [{
            id: "produto",
            name: "Produto",
            type: "text",
            template: "{{produto}}",
            box: {x: 10, y: 12, width: 20, height: 6},
            rotation: 15,
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

    toggle(name, force) {
        const names = new Set(this.node.className.split(/\s+/).filter(Boolean));
        const enabled = force === undefined ? !names.has(name) : force === true;
        if (enabled) names.add(name);
        else names.delete(name);
        this.node.className = [...names].join(" ");
        return enabled;
    }

    contains(name) {
        return this.node.className.split(/\s+/).filter(Boolean).includes(name);
    }
}

class FakeNode {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentElement = null;
        this.dataset = {};
        this.attributes = new Map();
        this.className = "";
        this.classList = new FakeClassList(this);
        this.textContent = "";
        this.value = "";
        this.hidden = false;
        this.disabled = false;
        this.readOnly = false;
        this.options = [];
        this.clientWidth = 1000;
        this.clientHeight = 600;
        this.listeners = new Map();
        this.dispatched = [];
        this.style = {
            setProperty(name, value) {
                this[name] = value;
            },
            removeProperty(name) {
                delete this[name];
            }
        };
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

    removeEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        this.listeners.set(type, listeners.filter((item) => item !== listener));
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
        for (const listener of this.listeners.get(type) || []) listener(payload);
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
        if (selector === ".fwwebex-label-field" &&
            this.classList.contains("fwwebex-label-field")) return this;
        if (selector === ".fwwebex-label-pane" &&
            this.classList.contains("fwwebex-label-pane")) return this;
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

class FakeCanvas extends FakeNode {
    constructor() {
        super("canvas");
        this.width = 0;
        this.height = 0;
        this.context = {
            canvas: this,
            clearRect() {},
            drawImage: (source) => {
                if (source && source.dataset && source.dataset.raster) {
                    this.dataset.raster = source.dataset.raster;
                }
            }
        };
    }

    getContext(kind) {
        assert.equal(kind, "2d");
        return this.context;
    }
}

function createHarness({generate, renderPage} = {}) {
    const root = new FakeNode("section");
    root.id = "designer-print-preview";
    const stage = new FakeNode("div");
    const background = new FakeNode("img");
    const previewCanvas = new FakeCanvas();
    const fields = new FakeNode("div");
    stage.appendChild(background);
    stage.appendChild(previewCanvas);
    stage.appendChild(fields);

    const roles = {
        stage,
        "stage-viewport": new FakeNode("div"),
        background,
        fields,
        toolbar: new FakeNode("div"),
        layers: new FakeNode("ul"),
        inspector: new FakeNode("div"),
        drawers: new FakeNode("div"),
        "contract-editor": new FakeNode("textarea"),
        "records-editor": new FakeNode("textarea"),
        problems: new FakeNode("div"),
        status: new FakeNode("div"),
        "status-message": new FakeNode("span"),
        "contract-state": new FakeNode("span"),
        "preview-canvas": previewCanvas
    };
    roles["stage-viewport"].clientWidth = 700;
    roles["stage-viewport"].clientHeight = 500;

    root.querySelector = (selector) => {
        const roleMatch = /^\[data-role=(?:"([^"]+)"|([^\]]+))\]$/.exec(
            selector
        );
        if (roleMatch) return roles[roleMatch[1] || roleMatch[2]] || null;
        return null;
    };
    root.querySelectorAll = () => [];

    const rendererCalls = [];
    const viewerCalls = [];
    let viewerImplementation = renderPage;
    let generateImplementation = generate;
    let nextTimerId = 0;
    const timers = new Map();
    const frameQueue = [];

    const report = {
        valid: true,
        issues: [],
        errors: [],
        warnings: [],
        metrics: {records: []}
    };
    const renderer = {
        generate(layout, records, options) {
            rendererCalls.push({layout: plain(layout), records: plain(records), options});
            if (generateImplementation) {
                return generateImplementation(layout, records, options, rendererCalls.length);
            }
            return Promise.resolve({
                output: new Uint8Array([rendererCalls.length]).buffer,
                layout: plain(layout),
                report: plain(report)
            });
        }
    };
    const viewer = {
        renderPage(source, options) {
            viewerCalls.push({source, options});
            if (viewerImplementation) {
                return viewerImplementation(source, options, viewerCalls.length);
            }
            const rotation = rendererCalls.at(-1)?.layout.page.rotation || 0;
            const swap = rotation === 90 || rotation === 270;
            const width = (swap ? 60 : 100) * 2;
            const height = (swap ? 100 : 60) * 2;
            options.canvas.width = width;
            options.canvas.height = height;
            return Promise.resolve({
                canvas: options.canvas,
                viewport: {width, height},
                width,
                height,
                scale: 2,
                destroy() {}
            });
        }
    };
    const document = {
        activeElement: null,
        createElement: (tagName) =>
            tagName.toLowerCase() === "canvas" ? new FakeCanvas() : new FakeNode(tagName),
        getElementById: (id) => id === root.id ? root : null
    };
    const window = {
        FWWebExLabels: {
            contract: {normalize: (layout) => plain(layout)},
            renderer
        },
        FWWebEx: {PDFViewer: viewer},
        confirm: () => true,
        prompt: () => null,
        requestAnimationFrame(callback) {
            frameQueue.push(callback);
            return frameQueue.length;
        },
        cancelAnimationFrame() {},
        setTimeout(callback, delay) {
            const id = ++nextTimerId;
            timers.set(id, {callback, delay});
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
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
        FileReader: class {},
        document,
        window,
        requestAnimationFrame: window.requestAnimationFrame,
        cancelAnimationFrame: window.cancelAnimationFrame,
        setTimeout: window.setTimeout,
        clearTimeout: window.clearTimeout,
        Map,
        Set,
        Promise,
        ArrayBuffer,
        Uint8Array,
        AbortController,
        DOMException
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
        stage,
        fields,
        previewCanvas,
        rendererCalls,
        viewerCalls,
        timers,
        api: root.__labelDesigner,
        setViewer(implementation) {
            viewerImplementation = implementation;
        },
        setGenerate(implementation) {
            generateImplementation = implementation;
        },
        flushFrames() {
            const pending = frameQueue.splice(0);
            pending.forEach((callback) => callback(0));
        },
        async flushTimers() {
            const pending = [...timers.values()];
            timers.clear();
            for (const timer of pending) await timer.callback();
            await Promise.resolve();
        }
    };
}

function matrixValues(value) {
    const match = /^matrix\(([^)]+)\)$/.exec(String(value || "").trim());
    assert.ok(match, `expected CSS matrix(), received ${JSON.stringify(value)}`);
    return match[1].split(",").map((part) => Number.parseFloat(part));
}

function assertClose(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < 1e-7,
        `${message}: expected ${expected}, received ${actual}`);
}

test("Designer print mode owns a canvas and no longer embeds a PDF iframe", () => {
    assert.ok(
        /<canvas\s+data-role="preview-canvas"/i.test(labelsSource),
        "Designer markup must contain data-role=preview-canvas"
    );
    assert.equal(
        /<iframe\s+data-role="preview-frame"|data-role="preview-frame"/i
            .test(labelsSource),
        false,
        "preview-frame iframe and its runtime references must be removed"
    );
    assert.ok(
        /WebExFeaturePDFJS\(\):Enable\(/i.test(labelsSource),
        "WebExLabelDesigner must enable the generic PDF.js feature"
    );
});

test("preview asks the canonical renderer for an ArrayBuffer and rasterizes it", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.load(layoutAt(0));
    harness.api.setRecords([{produto: "DETERGENTE"}]);

    const result = await harness.api.preview();

    assert.equal(harness.rendererCalls.length, 1);
    assert.equal(harness.rendererCalls[0].options.output, "arraybuffer");
    assert.equal(harness.rendererCalls[0].options.returnResult, true);
    assert.equal(harness.viewerCalls.length, 1);
    assert.ok(harness.viewerCalls[0].source instanceof ArrayBuffer);
    assert.equal(harness.viewerCalls[0].options.canvas, harness.previewCanvas);
    assert.equal(harness.root.dataset.mode, "print");
    assert.notEqual(harness.previewCanvas.style.display, "none");
    assert.ok(result, "preview() must resolve its renderer/preview result");
});

test("overlay uses the PDF page matrix at 0/90/180/270 without moving elements", async () => {
    const expected = {
        0: {viewport: [200, 120], matrix: [1, 0, 0, 1, 0, 0]},
        90: {viewport: [120, 200], matrix: [0, 1, -1, 0, 120, 0]},
        180: {viewport: [200, 120], matrix: [-1, 0, 0, -1, 200, 120]},
        270: {viewport: [120, 200], matrix: [0, -1, 1, 0, 0, 200]}
    };

    for (const rotation of [0, 90, 180, 270]) {
        const harness = createHarness();
        await Promise.resolve();
        harness.api.load(layoutAt(rotation));
        await harness.api.preview();

        const oracle = expected[rotation];
        assert.equal(harness.stage.style.width, `${oracle.viewport[0]}px`,
            `stage width at ${rotation}`);
        assert.equal(harness.stage.style.height, `${oracle.viewport[1]}px`,
            `stage height at ${rotation}`);
        assert.equal(harness.fields.style.width, "200px",
            `source overlay width at ${rotation}`);
        assert.equal(harness.fields.style.height, "120px",
            `source overlay height at ${rotation}`);
        assert.match(String(harness.fields.style.transformOrigin), /^0(?:px)? 0(?:px)?$/,
            `overlay origin at ${rotation}`);
        const actualMatrix = matrixValues(harness.fields.style.transform);
        oracle.matrix.forEach((value, index) => assertClose(
            actualMatrix[index], value, `matrix[${index}] at ${rotation}`
        ));

        const element = harness.fields.children.find((child) =>
            child.dataset.id === "produto"
        );
        assert.ok(element, `produto overlay at ${rotation}`);
        assert.equal(element.style.left, "10%");
        assert.equal(element.style.top, "20%");
        assert.equal(element.style.width, "20%");
        assert.equal(element.style.height, "10%");
        assert.equal(element.style.transform, "rotate(15deg)");
    }
});

test("a stale preview cannot replace a newer raster", async () => {
    const generated = [deferred(), deferred()];
    const renderedSources = [];
    const harness = createHarness({
        generate(layout, records, options, callIndex) {
            return generated[callIndex - 1].promise;
        },
        renderPage(source, options) {
            renderedSources.push(new Uint8Array(source)[0]);
            options.canvas.dataset.raster = String(new Uint8Array(source)[0]);
            return Promise.resolve({
                canvas: options.canvas,
                viewport: {width: 200, height: 120},
                width: 200,
                height: 120,
                scale: 2,
                destroy() {}
            });
        }
    });
    await Promise.resolve();
    harness.api.load(layoutAt(0));

    const older = harness.api.preview();
    const newer = harness.api.preview();
    generated[1].resolve({
        output: new Uint8Array([2]).buffer,
        layout: layoutAt(0),
        report: {valid: true, issues: [], errors: [], warnings: [], metrics: {}}
    });
    await newer;
    generated[0].resolve({
        output: new Uint8Array([1]).buffer,
        layout: layoutAt(0),
        report: {valid: true, issues: [], errors: [], warnings: [], metrics: {}}
    });
    await older;

    assert.deepEqual(renderedSources, [2]);
    assert.equal(harness.previewCanvas.dataset.raster, "2");
});

test("a pending PDF.js raster is cancelled or isolated when a newer preview wins", async () => {
    const rasters = [deferred(), deferred()];
    const viewerCanvases = [];
    const harness = createHarness({
        generate(layout, records, options, callIndex) {
            return Promise.resolve({
                output: new Uint8Array([callIndex]).buffer,
                layout: plain(layout),
                report: {valid: true, issues: [], errors: [], warnings: [], metrics: {}}
            });
        },
        async renderPage(source, options, callIndex) {
            const value = new Uint8Array(source)[0];
            viewerCanvases.push(options.canvas);
            await rasters[callIndex - 1].promise;
            if (options.signal && options.signal.aborted) {
                const error = new Error("render cancelled");
                error.name = "AbortError";
                error.code = "FWPDFVIEWER_RENDER_CANCELLED";
                throw error;
            }
            options.canvas.dataset.raster = String(value);
            return {
                canvas: options.canvas,
                viewport: {width: 200, height: 120},
                width: 200,
                height: 120,
                scale: 2,
                destroy() {}
            };
        }
    });
    await Promise.resolve();
    harness.api.load(layoutAt(0));

    const older = harness.api.preview();
    for (let attempt = 0; attempt < 12 && harness.viewerCalls.length < 1; attempt += 1) {
        await Promise.resolve();
    }
    assert.equal(harness.viewerCalls.length, 1,
        "the former request must reach the asynchronous raster stage");
    const newer = harness.api.preview();
    for (let attempt = 0; attempt < 12 && harness.viewerCalls.length < 2; attempt += 1) {
        await Promise.resolve();
    }
    assert.equal(harness.viewerCalls.length, 2,
        "both requests must have reached the asynchronous raster stage");

    rasters[1].resolve();
    await newer;
    rasters[0].resolve();
    await Promise.allSettled([older]);

    assert.equal(harness.previewCanvas.dataset.raster, "2");
    const firstSignal = harness.viewerCalls[0].options.signal;
    const usedIsolatedCanvases = viewerCanvases[0] !== harness.previewCanvas &&
        viewerCanvases[1] !== harness.previewCanvas;
    assert.ok(
        firstSignal?.aborted === true || usedIsolatedCanvases,
        "stale raster safety requires aborting the former task or isolated canvases"
    );
});

test("print preview refresh is debounced after document changes", async () => {
    const harness = createHarness();
    await Promise.resolve();
    harness.api.load(layoutAt(0));
    await harness.api.preview();
    assert.equal(harness.rendererCalls.length, 1);
    assert.equal(harness.timers.size, 0,
        "a completed preview must not schedule itself again");

    harness.api.setPage({safeArea: 1});
    harness.api.setPage({safeArea: 2});
    harness.api.setPage({safeArea: 3});

    assert.equal(harness.rendererCalls.length, 1,
        "changes must not synchronously regenerate the PDF");
    assert.equal(harness.timers.size, 1,
        "successive changes must collapse into one pending refresh");
    const [{delay}] = [...harness.timers.values()];
    assert.ok(delay >= 100 && delay <= 1000,
        `preview debounce must be perceptible and bounded, received ${delay} ms`);
    assert.match(harness.roles["status-message"].textContent,
        /Atualizando visualiza(?:ç|\u00e7)(?:ão|\u00e3o)/i);

    await harness.flushTimers();
    assert.equal(harness.rendererCalls.length, 2);
    assert.equal(harness.viewerCalls.length, 2);
});

test("raster failure returns to Design and reports the real error", async () => {
    const harness = createHarness({
        renderPage() {
            const error = new Error("PDF.js recusou a pagina");
            error.code = "FWPDFVIEWER_RENDER_FAILED";
            return Promise.reject(error);
        }
    });
    await Promise.resolve();
    harness.api.load(layoutAt(90));

    await assert.rejects(
        harness.api.preview(),
        (error) => error.code === "FWPDFVIEWER_RENDER_FAILED"
    );

    assert.equal(harness.root.dataset.mode, "design");
    assert.equal(harness.previewCanvas.style.display, "none");
    assert.match(harness.roles["status-message"].textContent,
        /PDF\.js recusou a pagina/);
    const errorEvent = harness.root.dispatched.find((event) =>
        event.type === "fwwebex:label-error"
    );
    assert.ok(errorEvent, "preview failure must emit fwwebex:label-error");
    assert.equal(errorEvent.detail.error.code, "FWPDFVIEWER_RENDER_FAILED");
});
