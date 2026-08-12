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
const generatorSource = scripts.find((script) =>
    script.includes("function normalizeLayout") &&
    script.includes("window.FWWebExLabels.renderer.generate=generate")
);

assert.ok(designerSource, "embedded Labels designer runtime was not found");
assert.ok(generatorSource, "embedded Labels contract runtime was not found");

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

class FakeElement {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentElement = null;
        this.style = {};
        this.dataset = {};
        this.className = "";
        this.textContent = "";
        this.clientWidth = 1000;
        this.clientHeight = 600;
        this.scrollWidth = 0;
        this.scrollHeight = 0;
        this.hidden = false;
        this.listeners = new Map();
        this.dispatched = [];
        this.srcAssignments = 0;
        this._src = "";
    }

    set src(value) {
        this._src = String(value ?? "");
        this.srcAssignments += 1;
    }

    get src() {
        return this._src;
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    replaceChildren(...children) {
        this.children.forEach((child) => {
            child.parentElement = null;
        });
        this.children = [];
        children.forEach((child) => this.appendChild(child));
    }

    remove() {
        if (!this.parentElement) return;
        this.parentElement.children = this.parentElement.children.filter(
            (child) => child !== this
        );
        this.parentElement = null;
    }

    querySelector(selector) {
        if (selector === ".fwwebex-label-field-content") {
            return this.children.find((child) =>
                child.className.split(/\s+/).includes(
                    "fwwebex-label-field-content"
                )
            ) || null;
        }
        if (selector.startsWith("[data-id=")) {
            const id = selector.slice(9, -1).replace(/^["']|["']$/g, "");
            return this.children.find((child) => child.dataset.id === id) || null;
        }
        return null;
    }

    querySelectorAll(selector) {
        if (selector === ".fwwebex-label-field") {
            return this.children.filter((child) =>
                child.className.split(/\s+/).includes("fwwebex-label-field")
            );
        }
        return [];
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
            preventDefault() {},
            pointerId: 1,
            clientX: 0,
            clientY: 0,
            shiftKey: false,
            target: this,
            ...event
        };
        for (const listener of this.listeners.get(type) || []) listener(payload);
    }

    dispatchEvent(event) {
        this.dispatched.push(event);
        for (const listener of this.listeners.get(event.type) || []) {
            listener(event);
        }
        return true;
    }

    closest(selector) {
        if (selector === ".fwwebex-label-field" &&
            this.className.split(/\s+/).includes("fwwebex-label-field")) {
            return this;
        }
        return this.parentElement ? this.parentElement.closest(selector) : null;
    }

    getBoundingClientRect() {
        return {
            x: 0,
            y: 0,
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

    set innerHTML(value) {
        if (value === "") this.replaceChildren();
    }

    get innerHTML() {
        return "";
    }
}

function createRoot(id) {
    const root = new FakeElement("section");
    root.id = id;
    const roles = {
        stage: new FakeElement("div"),
        background: new FakeElement("img"),
        fields: new FakeElement("div")
    };
    roles.stage.clientWidth = 1000;
    roles.stage.clientHeight = 600;
    roles.stage.appendChild(roles.background);
    roles.stage.appendChild(roles.fields);
    root.querySelector = (selector) => {
        const match = /^\[data-role=(.+)\]$/.exec(selector);
        return match ? roles[match[1]] || null : null;
    };
    return {root, roles};
}

function canonicalLayout(name, background, elementId) {
    return {
        schema: "fwwebex.labels",
        version: 2,
        name,
        unit: "mm",
        page: {
            width: 100,
            height: 60,
            rotation: 0,
            margins: 0,
            safeArea: 0,
            bleed: 0
        },
        background: background ? {
            dataUrl: background,
            fit: "fill",
            opacity: 1,
            locked: true
        } : null,
        editor: {
            grid: {enabled: false, step: 1},
            snap: {enabled: false, tolerancePx: 8},
            guides: []
        },
        variables: [],
        barcodeAutoRules: [],
        barcodeFallbackFormat: "CODE128",
        elements: [{
            id: elementId,
            name: name,
            type: "text",
            template: `{{${name}}}`,
            box: {x: 5, y: 5, width: 30, height: 8},
            rotation: 0,
            zIndex: 0,
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
                padding: 0,
                margin: 0
            },
            fit: {mode: "shrink", maxLines: 1, overflow: "ellipsis"},
            textOptions: {}
        }]
    };
}

function createHarness({instrumentJSON = false} = {}) {
    const first = createRoot("designer-isolation-a");
    const second = createRoot("designer-isolation-b");
    const roots = new Map([
        [first.root.id, first.root],
        [second.root.id, second.root]
    ]);
    const frameQueue = [];
    const serialization = {
        lengths: [],
        reset() {
            this.lengths.length = 0;
        }
    };
    const instrumentedJSON = {
        parse: JSON.parse.bind(JSON),
        stringify(value, replacer, space) {
            const result = JSON.stringify(value, replacer, space);
            serialization.lengths.push(result.length);
            return result;
        }
    };
    const sharedWindow = {
        prompt: () => null,
        requestAnimationFrame(callback) {
            frameQueue.push(callback);
            return frameQueue.length;
        },
        cancelAnimationFrame() {}
    };
    const context = vm.createContext({
        console,
        CustomEvent: class {
            constructor(type, options) {
                this.type = type;
                this.detail = options && options.detail;
            }
        },
        document: {
            createElement: (tagName) => new FakeElement(tagName),
            getElementById: (id) => roots.get(id) || null
        },
        window: sharedWindow,
        requestAnimationFrame: sharedWindow.requestAnimationFrame,
        cancelAnimationFrame: sharedWindow.cancelAnimationFrame,
        ...(instrumentJSON ? {JSON: instrumentedJSON} : {})
    });

    vm.runInContext(generatorSource, context);
    for (const entry of [first, second]) {
        vm.runInContext(
            designerSource
                .replaceAll("__ID__", entry.root.id)
                .replaceAll("__WIDTH__", "100")
                .replaceAll("__HEIGHT__", "60"),
            context
        );
    }

    return {
        first,
        second,
        labels: sharedWindow.FWWebExLabels,
        serialization,
        flushFrames() {
            const pending = frameQueue.splice(0);
            pending.forEach((callback) => callback(0));
        }
    };
}

test("two designer instances keep state, DOM and events isolated", () => {
    const {first, second, labels} = createHarness();
    const firstBackground = "data:image/png;base64,QUFB";
    const secondBackground = "data:image/png;base64,QkJC";

    first.root.__labelDesigner.load(canonicalLayout(
        "produto",
        firstBackground,
        "first-field"
    ));
    second.root.__labelDesigner.load(canonicalLayout(
        "lote",
        secondBackground,
        "second-field"
    ));
    first.root.dispatched.length = 0;
    second.root.dispatched.length = 0;

    first.roles.stage.dispatch("pointerdown", {
        target: first.roles.fields.children[0]
    });
    first.roles.stage.dispatch("pointerup");
    first.root.__labelDesigner.updateSelected({
        template: "{{produto.codigo}}",
        box: {x: 17}
    });
    second.roles.stage.dispatch("pointerdown", {
        target: second.roles.fields.children[0]
    });
    second.roles.stage.dispatch("pointerup");
    second.root.__labelDesigner.updateSelected({
        template: "{{lote.codigo}}",
        box: {y: 21}
    });

    const firstLayout = plain(first.root.__labelDesigner.exportLayout());
    const secondLayout = plain(second.root.__labelDesigner.exportLayout());
    assert.equal(firstLayout.elements[0].template, "{{produto.codigo}}");
    assert.equal(firstLayout.elements[0].box.x, 17);
    assert.equal(firstLayout.elements[0].box.y, 5);
    assert.equal(firstLayout.background.dataUrl, firstBackground);
    assert.equal(secondLayout.elements[0].template, "{{lote.codigo}}");
    assert.equal(secondLayout.elements[0].box.x, 5);
    assert.equal(secondLayout.elements[0].box.y, 21);
    assert.equal(secondLayout.background.dataUrl, secondBackground);

    assert.equal(first.roles.background.src, firstBackground);
    assert.equal(second.roles.background.src, secondBackground);
    assert.equal(first.roles.fields.children.length, 1);
    assert.equal(second.roles.fields.children.length, 1);
    assert.notEqual(first.root.__labelDesigner, second.root.__labelDesigner);
    assert.equal(labels.contract.normalize(firstLayout).name, "produto");
    assert.equal(labels.contract.normalize(secondLayout).name, "lote");
    assert.ok(first.root.dispatched.length > 0);
    assert.ok(second.root.dispatched.length > 0);
    assert.ok(first.root.dispatched.every((event) =>
        event.detail.name === "produto"
    ));
    assert.ok(second.root.dispatched.every((event) =>
        event.detail.name === "lote"
    ));
});

test("dragging with a large background has a bounded serialization budget", () => {
    const {first, serialization, flushFrames} = createHarness({
        instrumentJSON: true
    });
    const dataUrl = `data:image/png;base64,${"A".repeat(2 * 1024 * 1024)}`;
    first.root.__labelDesigner.load(canonicalLayout(
        "produto",
        dataUrl,
        "large-background-field"
    ));

    const field = first.roles.fields.children[0];
    first.roles.stage.dispatch("pointerdown", {
        target: field,
        clientX: 100,
        clientY: 100
    });
    serialization.reset();
    first.root.dispatched.length = 0;
    first.roles.background.srcAssignments = 0;

    for (let index = 1; index <= 40; index += 1) {
        first.roles.stage.dispatch("pointermove", {
            target: first.roles.stage,
            clientX: 100 + index * 2,
            clientY: 100 + index
        });
    }
    flushFrames();
    first.roles.stage.dispatch("pointerup", {target: first.roles.stage});
    flushFrames();

    const largeSerializations = serialization.lengths.filter(
        (length) => length >= dataUrl.length
    );
    assert.ok(
        largeSerializations.length <= 2,
        `drag serialized the ${dataUrl.length}-byte background ` +
        `${largeSerializations.length} times`
    );
    assert.ok(
        first.root.dispatched.length <= 2,
        `drag emitted ${first.root.dispatched.length} full change events`
    );
    assert.equal(
        first.roles.background.srcAssignments,
        0,
        "drag must not reassign the unchanged background image"
    );

    const moved = plain(first.root.__labelDesigner.exportLayout()).elements[0];
    assert.ok(moved.box.x > 5);
    assert.ok(moved.box.y > 5);
});
