import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import vm from "node:vm";

const labelsSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.labels.tlpp"
), "utf8");

const embeddedScripts = [...labelsSource.matchAll(
    /beginContent var \w+\s*([\s\S]*?)\s*endContent/g
)].map((match) => match[1]);
const canonicalRuntimeSource = embeddedScripts.find((script) =>
    script.includes("function normalizeLayout") &&
    script.includes("FWWebExLabels.snap.resolve")
);
const designerSource = embeddedScripts.find((script) => script.includes(
    "root.__labelDesigner={addText:function"
));

assert.ok(designerSource, "embedded Labels designer runtime was not found");
assert.ok(canonicalRuntimeSource, "canonical Labels snap runtime was not found");

function plain(value) {
    return JSON.parse(JSON.stringify(value));
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
        const current = new Set(this.node.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => current.add(name));
        this.node.className = [...current].join(" ");
    }

    remove(...names) {
        const current = new Set(this.node.className.split(/\s+/).filter(Boolean));
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

    replaceChildren(...children) {
        this.children.forEach((child) => {
            child.parentElement = null;
        });
        this.children = [];
        this.options = [];
        children.forEach((child) => this.appendChild(child));
    }

    remove() {
        if (!this.parentElement) return;
        this.parentElement.children = this.parentElement.children.filter(
            (child) => child !== this
        );
        this.parentElement = null;
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
        const idMatch = /^\[data-id=(?:"([^"]+)"|'([^']+)'|([^\]]+))\]$/.exec(
            selector
        );
        if (idMatch) {
            const id = idMatch[1] || idMatch[2] || idMatch[3];
            return this.children.find((child) => child.dataset.id === id) || null;
        }
        return null;
    }

    querySelectorAll(selector) {
        if (selector === ".fwwebex-label-field") {
            return this.children.filter((child) =>
                child.classList.contains("fwwebex-label-field")
            );
        }
        if (selector === ".fwwebex-label-snap-guide") {
            return this.children.filter((child) =>
                child.classList.contains("fwwebex-label-snap-guide")
            );
        }
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
    scrollIntoView() {}
    click() {}

    set innerHTML(value) {
        if (value === "") this.replaceChildren();
    }

    get innerHTML() {
        return "";
    }
}

function textElement(id, x, y, options = {}) {
    const fontSize = options.fontSize ?? 10;
    return {
        id,
        name: options.name || id,
        type: "text",
        template: `{{${id}}}`,
        box: {
            x,
            y,
            width: options.width ?? 10,
            height: options.height ?? 8
        },
        rotation: 0,
        zIndex: options.zIndex ?? 0,
        locked: options.locked === true,
        hidden: options.hidden === true,
        containerId: options.containerId || null,
        style: {
            fontFamily: "helvetica",
            fontSize,
            minFontSize: options.minFontSize ?? fontSize,
            fontStyle: "normal",
            color: "#000000",
            lineHeightFactor: options.lineHeightFactor ?? 1.15,
            letterSpacing: 0,
            align: "left",
            verticalAlign: options.verticalAlign || "top",
            padding: options.padding ?? {top: 0, right: 0, bottom: 0, left: 0},
            margin: {top: 0, right: 0, bottom: 0, left: 0}
        },
        fit: {mode: "none", maxLines: 1, overflow: "clip"},
        textOptions: {}
    };
}

function containerElement(id, x, y, options = {}) {
    return {
        id,
        name: options.name || id,
        type: "container",
        template: "",
        box: {
            x,
            y,
            width: options.width ?? 40,
            height: options.height ?? 20
        },
        rotation: 0,
        zIndex: options.zIndex ?? 0,
        locked: options.locked === true,
        hidden: options.hidden === true,
        containerId: options.containerId || null,
        layout: {
            direction: "vertical",
            gap: 1,
            padding: {top: 0, right: 0, bottom: 0, left: 0},
            crossAlign: "start",
            mainAlign: "start",
            sizing: "none",
            overflow: "visible",
            clipChildren: false,
            children: options.children || []
        }
    };
}

function canonicalLayout({
    reference = true,
    parent = true,
    manualGuide = true,
    other = true,
    grid = true
} = {}) {
    const elements = [];
    if (parent) {
        elements.push(containerElement("parent", 20.6, 36, {
            children: ["moving"]
        }));
    }
    if (reference) {
        elements.push(textElement("reference", 20.7, 30, {locked: true}));
    }
    if (other) elements.push(textElement("other", 20.4, 45));
    elements.push(textElement("moving", 5, 12, {
        containerId: parent ? "parent" : null,
        zIndex: 10
    }));
    return {
        schema: "fwwebex.labels",
        version: 2,
        name: "smart-snap",
        unit: "mm",
        page: {
            width: 100,
            height: 60,
            rotation: 0,
            margins: {top: 0, right: 0, bottom: 0, left: 20.2},
            safeArea: 0,
            bleed: 0
        },
        background: null,
        editor: {
            grid: {enabled: grid, step: 20},
            snap: {
                enabled: true,
                tolerancePx: 10,
                referenceElementId: reference ? "reference" : null,
                chainMode: false
            },
            guides: manualGuide ? [{axis: "x", position: 20.5}] : []
        },
        variables: [],
        barcodeAutoRules: [],
        barcodeFallbackFormat: "CODE128",
        elements
    };
}

function createHarness() {
    const root = new FakeNode("section");
    root.id = "designer-smart-snap";
    const stage = new FakeNode("div");
    stage.clientWidth = 1000;
    stage.clientHeight = 600;
    const background = new FakeNode("img");
    const fields = new FakeNode("div");
    const snapGuides = new FakeNode("div");
    stage.appendChild(background);
    stage.appendChild(fields);
    stage.appendChild(snapGuides);

    const roles = {
        stage,
        background,
        fields,
        "snap-guides": snapGuides,
        toolbar: new FakeNode("div"),
        "contract-editor": new FakeNode("textarea"),
        "records-editor": new FakeNode("textarea"),
        "status-message": new FakeNode("span")
    };
    roles["status-message"].textContent = "Pronto.";

    root.querySelector = (selector) => {
        const match = /^\[data-role=(?:"([^"]+)"|([^\]]+))\]$/.exec(selector);
        return match ? roles[match[1] || match[2]] || null : null;
    };
    root.querySelectorAll = () => [];

    const frameQueue = new Map();
    let frameId = 0;
    const labels = {
        contract: {
            normalize(layout) {
                return plain(layout);
            }
        },
        layout: {
            translate(layout) {
                return {layout: plain(layout), changedIds: []};
            },
            duplicate(layout) {
                return {layout: plain(layout), ids: []};
            }
        }
    };
    const window = {
        FWWebExLabels: labels,
        prompt: () => null,
        confirm: () => true,
        requestAnimationFrame(callback) {
            frameId += 1;
            frameQueue.set(frameId, callback);
            return frameId;
        },
        cancelAnimationFrame(id) {
            frameQueue.delete(id);
        },
        setTimeout(callback) {
            callback();
            return 1;
        },
        clearTimeout() {}
    };
    const document = {
        activeElement: null,
        createElement: (tagName) => new FakeNode(tagName),
        getElementById: (id) => id === root.id ? root : null
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
        document,
        window,
        requestAnimationFrame: window.requestAnimationFrame,
        cancelAnimationFrame: window.cancelAnimationFrame,
        Map,
        Set,
        Promise
    });

    vm.runInContext(canonicalRuntimeSource, context);
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
        api: root.__labelDesigner,
        snap: context.window.FWWebExLabels.snap,
        flushFrames() {
            while (frameQueue.size) {
                const pending = [...frameQueue.values()];
                frameQueue.clear();
                pending.forEach((callback) => callback(0));
            }
        }
    };
}

function findField(harness, id) {
    const field = harness.roles.fields.children.find(
        (candidate) => candidate.dataset.id === id
    );
    assert.ok(field, `field ${id} was not rendered`);
    return field;
}

function beginDrag(harness, id, rawX, rawY) {
    const layout = plain(harness.api.exportLayout());
    const item = layout.elements.find((candidate) => candidate.id === id);
    assert.ok(item, `element ${id} was not found`);
    const scaleX = harness.roles.stage.clientWidth / layout.page.width;
    const scaleY = harness.roles.stage.clientHeight / layout.page.height;
    const startX = item.box.x * scaleX;
    const startY = item.box.y * scaleY;
    harness.roles.stage.dispatch("pointerdown", {
        target: findField(harness, id),
        clientX: startX,
        clientY: startY,
        pointerId: 7
    });
    moveDrag(harness, item, startX, startY, rawX, rawY);
}

function moveDrag(harness, initialItem, startX, startY, rawX, rawY) {
    const layout = plain(harness.api.exportLayout());
    const scaleX = harness.roles.stage.clientWidth / layout.page.width;
    const scaleY = harness.roles.stage.clientHeight / layout.page.height;
    harness.roles.stage.dispatch("pointermove", {
        target: harness.roles.stage,
        clientX: startX + (rawX - initialItem.box.x) * scaleX,
        clientY: startY + (rawY - initialItem.box.y) * scaleY,
        pointerId: 7
    });
    harness.flushFrames();
}

function draggedElement(harness, id = "moving") {
    return plain(harness.api.exportLayout()).elements.find(
        (candidate) => candidate.id === id
    );
}

function guideForAxis(harness, axis) {
    return harness.roles["snap-guides"].children.find(
        (guide) => guide.dataset.axis === axis
    ) || null;
}

function assertNear(actual, expected, message) {
    assert.ok(
        Math.abs(actual - expected) < 0.0001,
        `${message}: expected ${expected}, received ${actual}`
    );
}

test("Designer owns a non-interactive smart-guide overlay", () => {
    assert.ok(
        labelsSource.includes('data-role="snap-guides"'),
        "Designer shell must own data-role=snap-guides"
    );
    assert.ok(
        /\.fwwebex-label-snap-guide\s*\{[^}]*pointer-events\s*:\s*none/is.test(
            labelsSource
        ),
        "smart guides must not intercept pointer input"
    );
});

test("snap winner follows the documented origin priority", () => {
    const cases = [
        {
            name: "magnetic reference",
            options: {},
            origin: "reference",
            expectedX: 20.7,
            status: /refer/i
        },
        {
            name: "parent container",
            options: {reference: false},
            origin: "container",
            expectedX: 20.6,
            status: /cont[eê]iner|[aá]rea/i
        },
        {
            name: "manual guide",
            options: {reference: false, parent: false},
            origin: "manual-guide",
            expectedX: 20.5,
            status: /guia/i
        },
        {
            name: "other visible element",
            options: {reference: false, parent: false, manualGuide: false},
            origin: "element",
            expectedX: 20.4,
            status: /element/i
        },
        {
            name: "grid",
            options: {
                reference: false,
                parent: false,
                manualGuide: false,
                other: false
            },
            origin: "grid",
            expectedX: 20,
            status: /grid/i
        },
        {
            name: "page margin",
            options: {
                reference: false,
                parent: false,
                manualGuide: false,
                other: false,
                grid: false
            },
            origin: "page",
            expectedX: 20.2,
            status: /p[aá]gina|margem|segur/i
        }
    ];

    for (const scenario of cases) {
        const harness = createHarness();
        harness.api.load(canonicalLayout(scenario.options));
        beginDrag(harness, "moving", 20, 12.37);

        assertNear(
            draggedElement(harness).box.x,
            scenario.expectedX,
            scenario.name
        );
        const guide = guideForAxis(harness, "x");
        assert.ok(guide, `${scenario.name} must render its winning guide`);
        assert.equal(guide.dataset.origin, scenario.origin, scenario.name);
        assert.equal(
            harness.roles["status-message"].dataset.state,
            "snap",
            `${scenario.name} must expose transient snap state`
        );
        assert.match(
            harness.roles["status-message"].textContent,
            scenario.status,
            `${scenario.name} must identify the winning origin in status`
        );
    }
});

test("grid snap remains independent from the general snap toggle", () => {
    const harness = createHarness();
    const layout = canonicalLayout({
        reference: false,
        parent: false,
        manualGuide: false,
        other: false
    });
    layout.editor.snap.enabled = false;

    const result = harness.snap.resolve(layout, {
        elementId: "moving",
        position: {x: 20.4, y: 19.6},
        pixelsPerMm: 10
    });

    assertNear(result.x, 20, "independent grid x");
    assertNear(result.y, 20, "independent grid y");
    assert.equal(result.winners.x.origin, "grid");
    assert.equal(result.winners.y.origin, "grid");
});

test("snap tolerance is visual and therefore stable across zoom levels", () => {
    const harness = createHarness();
    const layout = canonicalLayout({
        parent: false,
        manualGuide: false,
        other: false,
        grid: false
    });
    const reference = layout.elements.find((item) => item.id === "reference");
    reference.box.x = 20;

    const nearAtLowZoom = harness.snap.resolve(layout, {
        elementId: "moving",
        position: {x: 20.7, y: 12.37},
        pixelsPerMm: 10,
        tolerancePx: 8
    });
    const farAtHighZoom = harness.snap.resolve(layout, {
        elementId: "moving",
        position: {x: 20.7, y: 12.37},
        pixelsPerMm: 20,
        tolerancePx: 8
    });

    assertNear(nearAtLowZoom.x, 20, "7 px must snap");
    assertNear(farAtHighZoom.x, 20.7, "14 px must remain unsnapped");
    assert.equal(nearAtLowZoom.winners.x.origin, "reference");
    assert.equal(farAtHighZoom.winners.x, null);
});

test("parent snap uses its padded content box before lower-priority guides", () => {
    const harness = createHarness();
    const layout = canonicalLayout({reference: false, other: false, grid: false});
    const parent = layout.elements.find((item) => item.id === "parent");
    parent.box.x = 20;
    parent.layout.padding = {top: 1, right: 3, bottom: 1, left: 2};
    layout.editor.guides = [{axis: "x", position: 21.8}];

    const result = harness.snap.resolve(layout, {
        elementId: "moving",
        position: {x: 21.7, y: 12.37},
        pixelsPerMm: 10,
        tolerancePx: 8
    });

    assertNear(result.x, 22, "padded parent left edge");
    assert.equal(result.winners.x.origin, "container");
    assert.equal(result.winners.x.sourceId, "parent");
});

test("hidden elements are ignored while locked visible elements remain anchors", () => {
    const harness = createHarness();
    const layout = canonicalLayout({
        reference: false,
        parent: false,
        manualGuide: false,
        other: false,
        grid: false
    });
    layout.elements.unshift(
        textElement("hidden-anchor", 20.1, 45, {hidden: true}),
        textElement("locked-anchor", 20.2, 45, {locked: true})
    );

    const result = harness.snap.resolve(layout, {
        elementId: "moving",
        position: {x: 20.3, y: 12.37},
        pixelsPerMm: 10,
        tolerancePx: 8
    });

    assertNear(result.x, 20.2, "locked visible anchor");
    assert.equal(result.winners.x.origin, "element");
    assert.equal(result.winners.x.sourceId, "locked-anchor");
});

test("Alt suspends every snap origin during the active drag", () => {
    const harness = createHarness();
    harness.api.load(canonicalLayout());
    const layout = plain(harness.api.exportLayout());
    const moving = layout.elements.find((item) => item.id === "moving");
    const scaleX = harness.roles.stage.clientWidth / layout.page.width;
    const scaleY = harness.roles.stage.clientHeight / layout.page.height;
    const startX = moving.box.x * scaleX;
    const startY = moving.box.y * scaleY;

    harness.roles.stage.dispatch("pointerdown", {
        target: findField(harness, "moving"),
        clientX: startX,
        clientY: startY,
        pointerId: 11
    });
    harness.roles.stage.dispatch("pointermove", {
        target: harness.roles.stage,
        clientX: startX + (20.3 - moving.box.x) * scaleX,
        clientY: startY + (12.37 - moving.box.y) * scaleY,
        pointerId: 11,
        altKey: true
    });
    harness.flushFrames();

    assertNear(draggedElement(harness).box.x, 20.3, "Alt raw x");
    assertNear(draggedElement(harness).box.y, 12.37, "Alt raw y");
    assert.equal(harness.roles["snap-guides"].children.length, 0);
    assert.notEqual(harness.roles["status-message"].dataset.state, "snap");
});

test("winning guide reports the final adjustment in millimeters", () => {
    const harness = createHarness();
    harness.api.load(canonicalLayout({
        parent: false,
        manualGuide: false,
        other: false,
        grid: false
    }));
    beginDrag(harness, "moving", 20.3, 12.37);

    const guide = guideForAxis(harness, "x");
    assert.ok(guide);
    assert.equal(guide.dataset.origin, "reference");
    assert.match(
        harness.roles["status-message"].textContent,
        /0[,.]40?\s*mm/i,
        "status must report the 0.40 mm correction, not a pixel distance"
    );
});

test("snap hysteresis keeps the latched winner through 1.5x tolerance", () => {
    const harness = createHarness();
    const layout = canonicalLayout({
        parent: false,
        other: false,
        grid: false
    });
    layout.elements.find((item) => item.id === "reference").box.x = 20;
    layout.editor.guides = [{axis: "x", position: 21.6}];
    harness.api.load(layout);

    const initial = draggedElement(harness);
    const scaleX = harness.roles.stage.clientWidth / layout.page.width;
    const scaleY = harness.roles.stage.clientHeight / layout.page.height;
    const startX = initial.box.x * scaleX;
    const startY = initial.box.y * scaleY;
    harness.roles.stage.dispatch("pointerdown", {
        target: findField(harness, "moving"),
        clientX: startX,
        clientY: startY,
        pointerId: 9
    });

    moveDrag(harness, initial, startX, startY, 20.4, 12.37);
    assertNear(draggedElement(harness).box.x, 20, "initial reference snap");
    assert.equal(guideForAxis(harness, "x").dataset.origin, "reference");

    moveDrag(harness, initial, startX, startY, 21.5, 12.37);
    assertNear(
        draggedElement(harness).box.x,
        20,
        "reference latch at exactly 1.5x tolerance"
    );
    assert.equal(guideForAxis(harness, "x").dataset.origin, "reference");

    moveDrag(harness, initial, startX, startY, 21.51, 12.37);
    assertNear(
        draggedElement(harness).box.x,
        21.6,
        "manual guide after leaving reference hysteresis"
    );
    assert.equal(guideForAxis(harness, "x").dataset.origin, "manual-guide");
});

test("text snap aligns canonical first-line baselines without DOM metrics", () => {
    const harness = createHarness();
    const layout = canonicalLayout({
        parent: false,
        manualGuide: false,
        other: false,
        grid: false
    });
    const reference = layout.elements.find((item) => item.id === "reference");
    const moving = layout.elements.find((item) => item.id === "moving");
    reference.box.x = 70;
    reference.box.y = 20;
    reference.box.height = 12;
    reference.style.fontSize = 10;
    reference.style.minFontSize = 10;
    reference.style.padding = {top: 1, right: 0, bottom: 0, left: 0};
    moving.box.height = 14;
    moving.style.fontSize = 20;
    moving.style.minFontSize = 20;
    moving.style.padding = {top: 2, right: 0, bottom: 0, left: 0};
    harness.api.load(layout);

    const referenceBaseline = 20 + 1 + 10 * 0.352778;
    const movingBaselineOffset = 2 + 20 * 0.352778;
    const expectedY = referenceBaseline - movingBaselineOffset;
    beginDrag(harness, "moving", 5, expectedY + 0.03);

    assertNear(
        draggedElement(harness).box.y,
        expectedY,
        "canonical text baseline"
    );
    const guide = guideForAxis(harness, "y");
    assert.ok(guide, "baseline snap must render a horizontal guide");
    assert.equal(guide.dataset.origin, "reference");
    assert.equal(guide.dataset.anchor, "baseline");
    assert.match(harness.roles["status-message"].textContent, /baseline/i);
});

test("pointerup, pointercancel and Escape clear transient snap feedback", () => {
    for (const ending of ["pointerup", "pointercancel", "Escape"]) {
        const harness = createHarness();
        harness.api.load(canonicalLayout({
            parent: false,
            manualGuide: false,
            other: false,
            grid: false
        }));
        beginDrag(harness, "moving", 20.3, 12.37);
        assert.ok(guideForAxis(harness, "x"), `${ending}: precondition`);
        assert.equal(harness.roles["status-message"].dataset.state, "snap");

        if (ending === "Escape") {
            harness.root.dispatch("keydown", {
                target: harness.root,
                key: "Escape"
            });
        } else {
            harness.roles.stage.dispatch(ending, {
                target: harness.roles.stage,
                pointerId: 7
            });
        }
        harness.flushFrames();

        assert.equal(
            harness.roles["snap-guides"].children.length,
            0,
            `${ending} must remove every transient guide`
        );
        assert.notEqual(
            harness.roles["status-message"].dataset.state,
            "snap",
            `${ending} must clear transient snap status`
        );
    }
});
