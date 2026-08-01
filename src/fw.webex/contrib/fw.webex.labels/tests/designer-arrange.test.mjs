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
const canonicalRuntimeSource = scripts.find((script) =>
    script.includes("function normalizeLayout") &&
    script.includes("window.FWWebExLabels.renderer.generate=generate")
);
const designerSource = scripts.find((script) => script.includes(
    "root.__labelDesigner={addText:function"
));

assert.ok(canonicalRuntimeSource, "canonical Labels runtime was not found");
assert.ok(designerSource, "embedded Labels designer runtime was not found");

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

class FakeElement {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.style = {};
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    getContext() {
        return null;
    }
}

function loadLayoutAPI() {
    const root = new FakeElement("section");
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
            getElementById: () => root
        },
        window: {}
    });

    vm.runInContext(canonicalRuntimeSource, context);
    return context.window.FWWebExLabels.layout;
}

const layoutAPI = loadLayoutAPI();

function textElement(id, box, options = {}) {
    return {
        id,
        name: id,
        type: "text",
        template: `{{${id}}}`,
        box: plain(box),
        basisBox: {
            width: box.width,
            height: box.height
        },
        rotation: options.rotation ?? 0,
        zIndex: options.zIndex ?? 1,
        locked: options.locked === true,
        hidden: false,
        containerId: options.containerId || null,
        style: {
            fontFamily: "helvetica",
            fontSize: 10,
            minFontSize: 4,
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
    };
}

function containerElement(id, box, children, options = {}) {
    return {
        id,
        name: id,
        type: "container",
        template: "",
        box: plain(box),
        basisBox: {
            width: box.width,
            height: box.height
        },
        rotation: options.rotation ?? 0,
        zIndex: options.zIndex ?? 0,
        locked: options.locked === true,
        hidden: false,
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
            children: children.slice()
        }
    };
}

function labelLayout(elements, page = {}) {
    return {
        schema: "fwwebex.labels",
        version: 2,
        name: "arrange-test",
        unit: "mm",
        page: {
            width: page.width ?? 140,
            height: page.height ?? 80,
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
                tolerancePx: 6,
                referenceElementId: null,
                chainMode: false
            },
            guides: []
        },
        variables: [],
        barcodeAutoRules: [],
        barcodeFallbackFormat: "CODE128",
        elements
    };
}

function byId(layout, id) {
    const item = layout.elements.find((candidate) => candidate.id === id);
    assert.ok(item, `element ${id} was not found`);
    return item;
}

function arrange(layout, ids, command, options) {
    assert.equal(
        typeof layoutAPI.arrange,
        "function",
        "FWWebExLabels.layout.arrange must be public"
    );
    return plain(layoutAPI.arrange(layout, ids, command, options));
}

function assertEnvelope(result, command, referenceId) {
    assert.equal(result.command, command);
    assert.equal(result.referenceId, referenceId);
    assert.ok(Array.isArray(result.changedIds), "changedIds must be an array");
    assert.ok(Array.isArray(result.skippedIds), "skippedIds must be an array");
    assert.ok(Array.isArray(result.overflowIds), "overflowIds must be an array");
    assert.ok(result.layout && Array.isArray(result.layout.elements));
}

function assertIds(actual, expected, message) {
    assert.deepEqual(
        [...new Set(actual)].sort(),
        [...new Set(expected)].sort(),
        message
    );
}

test("arrange aligns against an explicit locked reference and skips locked targets", () => {
    const commands = [
        ["align-left", {x: 40, y: 4, width: 8, height: 4}],
        ["align-center", {x: 46, y: 4, width: 8, height: 4}],
        ["align-right", {x: 52, y: 4, width: 8, height: 4}],
        ["align-top", {x: 5, y: 20, width: 8, height: 4}],
        ["align-middle", {x: 5, y: 23, width: 8, height: 4}],
        ["align-bottom", {x: 5, y: 26, width: 8, height: 4}]
    ];

    for (const [command, expectedBox] of commands) {
        const source = labelLayout([
            textElement("target", {x: 5, y: 4, width: 8, height: 4}),
            textElement("locked-target", {
                x: 70, y: 40, width: 9, height: 5
            }, {locked: true}),
            textElement("reference", {
                x: 40, y: 20, width: 20, height: 10
            }, {locked: true})
        ]);
        const before = plain(source);
        const result = arrange(
            source,
            ["locked-target", "target", "reference"],
            command,
            {referenceId: "reference"}
        );

        assert.deepEqual(source, before, `${command} must not mutate its input`);
        assertEnvelope(result, command, "reference");
        assert.deepEqual(byId(result.layout, "target").box, expectedBox);
        assert.deepEqual(
            byId(result.layout, "reference"),
            byId(before, "reference"),
            `${command} must never alter its reference`
        );
        assert.deepEqual(
            byId(result.layout, "locked-target"),
            byId(before, "locked-target"),
            `${command} must not alter a locked target`
        );
        assertIds(result.skippedIds, ["locked-target"]);
        assert.equal(result.overflowIds.length, 0);
    }
});

test("relative positioning supports every direction and transverse alignment", () => {
    const cases = [
        ["position-above", "start", {x: 40, y: 14, width: 8, height: 4}],
        ["position-below", "center", {x: 46, y: 32, width: 8, height: 4}],
        ["position-left", "end", {x: 30, y: 26, width: 8, height: 4}],
        ["position-right", "stretch", {x: 62, y: 20, width: 8, height: 10}]
    ];

    for (const [command, crossAlign, expectedBox] of cases) {
        const source = labelLayout([
            textElement("reference", {x: 40, y: 20, width: 20, height: 10}),
            textElement("target", {x: 5, y: 4, width: 8, height: 4})
        ]);
        const before = plain(source);
        const result = arrange(source, ["target"], command, {
            referenceId: "reference",
            gap: 2,
            crossAlign
        });

        assert.deepEqual(source, before, `${command} must not mutate its input`);
        assertEnvelope(result, command, "reference");
        assert.deepEqual(byId(result.layout, "target").box, expectedBox);
        assert.deepEqual(
            byId(result.layout, "reference"),
            byId(before, "reference")
        );
        assertIds(result.changedIds, ["target"]);
        assert.equal(result.skippedIds.length, 0);
        assert.equal(result.overflowIds.length, 0);
    }
});

test("arrange object syntax and aliases use the canonical engine", () => {
    for (const alias of ["align", "position", "distribute", "matchSize"]) {
        assert.equal(
            typeof layoutAPI[alias],
            "function",
            `FWWebExLabels.layout.${alias} must be public`
        );
    }

    const source = labelLayout([
        textElement("reference", {x: 40, y: 20, width: 20, height: 10}),
        textElement("target", {x: 5, y: 4, width: 8, height: 4})
    ]);
    const before = plain(source);
    const positioned = plain(layoutAPI.position(source, ["target"], {
        direction: "below",
        referenceId: "reference",
        gap: 2,
        crossAlign: "center"
    }));

    assert.deepEqual(source, before, "an alias must not mutate its input");
    assertEnvelope(positioned, "position-below", "reference");
    assert.deepEqual(byId(positioned.layout, "target").box, {
        x: 46, y: 32, width: 8, height: 4
    });

    const resized = arrange(source, ["target"], {
        operation: "match-size",
        dimension: "both",
        referenceId: "reference"
    });

    assertEnvelope(resized, "equal-size", "reference");
    assert.deepEqual(byId(resized.layout, "target").box, {
        x: 5, y: 4, width: 20, height: 10
    });
});

test("equal size commands synchronize basisBox without moving the reference", () => {
    const cases = [
        ["equal-width", {width: 20, height: 4}, {width: 20, height: 4}],
        ["equal-height", {width: 8, height: 10}, {width: 8, height: 10}],
        ["equal-size", {width: 20, height: 10}, {width: 20, height: 10}]
    ];

    for (const [command, expectedSize, expectedBasis] of cases) {
        const source = labelLayout([
            textElement("reference", {x: 40, y: 20, width: 20, height: 10}),
            textElement("target", {x: 5, y: 4, width: 8, height: 4}),
            textElement("locked-target", {
                x: 70, y: 40, width: 9, height: 5
            }, {locked: true})
        ]);
        const before = plain(source);
        const result = arrange(
            source,
            ["locked-target", "reference", "target"],
            command,
            {referenceId: "reference"}
        );
        const target = byId(result.layout, "target");

        assert.deepEqual(source, before, `${command} must not mutate its input`);
        assertEnvelope(result, command, "reference");
        assert.deepEqual(
            {width: target.box.width, height: target.box.height},
            expectedSize
        );
        assert.deepEqual(target.basisBox, expectedBasis);
        assert.deepEqual(
            {x: target.box.x, y: target.box.y},
            {x: 5, y: 4},
            `${command} must preserve the target origin`
        );
        assert.deepEqual(byId(result.layout, "reference"), byId(before, "reference"));
        assert.deepEqual(
            byId(result.layout, "locked-target"),
            byId(before, "locked-target")
        );
        assertIds(result.changedIds, ["target"]);
        assertIds(result.skippedIds, ["locked-target"]);
    }
});

test("horizontal distribution is geometric, selection-order independent and reference-fixed", () => {
    const source = labelLayout([
        textElement("left", {x: 10, y: 10, width: 10, height: 5}),
        textElement("reference", {x: 60, y: 10, width: 20, height: 5}),
        textElement("right", {x: 100, y: 10, width: 10, height: 5})
    ]);
    const before = plain(source);
    const result = arrange(
        source,
        ["right", "left", "reference"],
        "distribute-horizontal",
        {referenceId: "reference"}
    );

    assert.deepEqual(source, before, "distribution must not mutate its input");
    assertEnvelope(result, "distribute-horizontal", "reference");
    assert.equal(byId(result.layout, "left").box.x, 20);
    assert.equal(byId(result.layout, "reference").box.x, 60);
    assert.equal(byId(result.layout, "right").box.x, 110);
    assert.equal(
        byId(result.layout, "reference").box.x -
            (byId(result.layout, "left").box.x + byId(result.layout, "left").box.width),
        30
    );
    assert.equal(
        byId(result.layout, "right").box.x -
            (byId(result.layout, "reference").box.x +
                byId(result.layout, "reference").box.width),
        30
    );
    assert.deepEqual(byId(result.layout, "reference"), byId(before, "reference"));
    assertIds(result.changedIds, ["left", "right"]);
    assert.equal(result.overflowIds.length, 0);
});

test("vertical distribution keeps a non-ideal internal reference fixed", () => {
    const source = labelLayout([
        textElement("bottom", {x: 10, y: 65, width: 5, height: 5}),
        textElement("reference", {x: 10, y: 30, width: 5, height: 10}),
        textElement("top", {x: 10, y: 5, width: 5, height: 5})
    ]);
    const before = plain(source);
    const result = arrange(
        source,
        ["bottom", "reference", "top"],
        "distribute-vertical",
        {referenceId: "reference"}
    );

    assert.deepEqual(source, before, "distribution must not mutate its input");
    assertEnvelope(result, "distribute-vertical", "reference");
    assert.equal(byId(result.layout, "top").box.y, 2.5);
    assert.equal(byId(result.layout, "reference").box.y, 30);
    assert.equal(byId(result.layout, "bottom").box.y, 62.5);
    assert.equal(
        byId(result.layout, "reference").box.y -
            (byId(result.layout, "top").box.y + byId(result.layout, "top").box.height),
        22.5
    );
    assert.equal(
        byId(result.layout, "bottom").box.y -
            (byId(result.layout, "reference").box.y +
                byId(result.layout, "reference").box.height),
        22.5
    );
    assert.deepEqual(byId(result.layout, "reference"), byId(before, "reference"));
    assertIds(result.changedIds, ["top", "bottom"]);
});

test("moving a container translates its complete subtree exactly once", () => {
    const source = labelLayout([
        textElement("reference", {x: 10, y: 10, width: 10, height: 10}),
        containerElement(
            "group",
            {x: 40, y: 30, width: 20, height: 20},
            ["child", "inner"]
        ),
        textElement("child", {
            x: 43, y: 34, width: 5, height: 4
        }, {containerId: "group", locked: true}),
        containerElement(
            "inner",
            {x: 48, y: 40, width: 8, height: 8},
            ["grandchild"],
            {containerId: "group"}
        ),
        textElement("grandchild", {
            x: 49, y: 41, width: 3, height: 2
        }, {containerId: "inner"})
    ]);
    const before = plain(source);
    const result = arrange(source, ["group"], "position-right", {
        referenceId: "reference",
        gap: 5,
        crossAlign: "start"
    });

    assert.deepEqual(source, before, "subtree positioning must not mutate its input");
    assert.deepEqual(byId(result.layout, "group").box, {
        x: 25, y: 10, width: 20, height: 20
    });
    assert.deepEqual(byId(result.layout, "child").box, {
        x: 28, y: 14, width: 5, height: 4
    });
    assert.deepEqual(byId(result.layout, "inner").box, {
        x: 33, y: 20, width: 8, height: 8
    });
    assert.deepEqual(byId(result.layout, "grandchild").box, {
        x: 34, y: 21, width: 3, height: 2
    });
    assertIds(result.changedIds, ["group", "child", "inner", "grandchild"]);
    assert.equal(result.skippedIds.length, 0);
    assert.equal(byId(result.layout, "child").locked, true);
    assert.equal(byId(result.layout, "child").containerId, "group");
    assert.deepEqual(byId(result.layout, "group").layout.children, ["child", "inner"]);
    assert.deepEqual(byId(result.layout, "inner").layout.children, ["grandchild"]);
});

test("a selected descendant is not arranged twice when its container is selected", () => {
    const source = labelLayout([
        textElement("reference", {x: 10, y: 10, width: 10, height: 10}),
        containerElement(
            "group",
            {x: 40, y: 30, width: 20, height: 20},
            ["child"]
        ),
        textElement("child", {
            x: 43, y: 34, width: 5, height: 4
        }, {containerId: "group"})
    ]);
    const result = arrange(
        source,
        ["child", "group"],
        "position-right",
        {referenceId: "reference", gap: 5, crossAlign: "start"}
    );

    assert.deepEqual(byId(result.layout, "group").box, {
        x: 25, y: 10, width: 20, height: 20
    });
    assert.deepEqual(byId(result.layout, "child").box, {
        x: 28, y: 14, width: 5, height: 4
    });
    assertIds(result.changedIds, ["group", "child"]);
});

test("arrange reports page overflow without clamping or mutating the reference", () => {
    const source = labelLayout([
        textElement("reference", {x: 1, y: 1, width: 5, height: 5}),
        textElement("target", {x: 30, y: 20, width: 10, height: 8})
    ], {width: 100, height: 60});
    const before = plain(source);
    const result = arrange(source, ["target"], "position-left", {
        referenceId: "reference",
        gap: 2,
        crossAlign: "start"
    });

    assert.deepEqual(source, before);
    assert.deepEqual(byId(result.layout, "target").box, {
        x: -11, y: 1, width: 10, height: 8
    });
    assert.deepEqual(byId(result.layout, "reference"), byId(before, "reference"));
    assertIds(result.changedIds, ["target"]);
    assertIds(result.overflowIds, ["target"]);
});

test("arrange validates commands before changing the caller layout", () => {
    const source = labelLayout([
        textElement("reference", {x: 40, y: 20, width: 20, height: 10}),
        textElement("target", {x: 5, y: 4, width: 8, height: 4})
    ]);
    const before = plain(source);

    assert.equal(typeof layoutAPI.arrange, "function");
    assert.throws(
        () => layoutAPI.arrange(
            source,
            ["target"],
            "rotate-randomly",
            {referenceId: "reference"}
        ),
        /arrange|command|comando|unsupported|invalido|invalid/i
    );
    assert.deepEqual(source, before, "an invalid command must leave input untouched");
});

class DesignerNode {
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

    get classList() {
        const node = this;
        return {
            contains(name) {
                return node.className.split(/\s+/).filter(Boolean).includes(name);
            },
            add(...names) {
                const current = new Set(node.className.split(/\s+/).filter(Boolean));
                names.forEach((name) => current.add(name));
                node.className = [...current].join(" ");
            },
            remove(...names) {
                const current = new Set(node.className.split(/\s+/).filter(Boolean));
                names.forEach((name) => current.delete(name));
                node.className = [...current].join(" ");
            },
            toggle(name, force) {
                const current = new Set(node.className.split(/\s+/).filter(Boolean));
                const enabled = force === undefined ? !current.has(name) : force === true;
                if (enabled) current.add(name);
                else current.delete(name);
                node.className = [...current].join(" ");
                return enabled;
            }
        };
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

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
        if (name === "src") this._src = "";
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
        for (const listener of this.listeners.get(event.type) || []) listener(event);
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
        return [];
    }

    closest(selector) {
        if (selector === "[data-action]" && this.dataset.action) return this;
        if (selector === ".fwwebex-label-layer" &&
            this.classList.contains("fwwebex-label-layer")) return this;
        if (selector === ".fwwebex-label-field" &&
            this.classList.contains("fwwebex-label-field")) return this;
        if (selector === ".fwwebex-label-problem" &&
            this.classList.contains("fwwebex-label-problem")) return this;
        if (selector === ".fwwebex-label-pane" &&
            this.classList.contains("fwwebex-label-pane")) return this;
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

function createDesignerHarness() {
    const root = new DesignerNode("section");
    root.id = "designer-arrange-integration";
    const stage = new DesignerNode("div");
    const background = new DesignerNode("img");
    const fields = new DesignerNode("div");
    const snapGuides = new DesignerNode("div");
    stage.appendChild(background);
    stage.appendChild(fields);
    stage.appendChild(snapGuides);

    const roles = {
        stage,
        background,
        fields,
        "snap-guides": snapGuides,
        toolbar: new DesignerNode("div"),
        "arrange-menu": new DesignerNode("details"),
        "align-mode": new DesignerNode("select"),
        "position-direction": new DesignerNode("select"),
        "cross-align": new DesignerNode("select"),
        "stack-gap": new DesignerNode("input"),
        "contract-editor": new DesignerNode("textarea"),
        "records-editor": new DesignerNode("textarea"),
        "status-message": new DesignerNode("span"),
        "status-selection": new DesignerNode("span")
    };
    roles["align-mode"].value = "left";
    roles["position-direction"].value = "below";
    roles["cross-align"].value = "start";
    roles["stack-gap"].value = "1";

    const actions = {};
    [
        "align",
        "position-relative",
        "distribute-horizontal",
        "distribute-vertical",
        "equal-width",
        "equal-height",
        "equal-size",
        "grid",
        "snap",
        "reference",
        "chain",
        "print-overlay"
    ].forEach((action) => {
        const button = new DesignerNode("button");
        button.dataset.action = action;
        actions[action] = button;
    });

    root.querySelector = (selector) => {
        const roleMatch = /^\[data-role=(?:"([^"]+)"|([^\]]+))\]$/.exec(selector);
        if (roleMatch) return roles[roleMatch[1] || roleMatch[2]] || null;
        const actionMatch = /^\[data-action=(?:"([^"]+)"|([^\]]+))\]$/.exec(selector);
        return actionMatch ? actions[actionMatch[1] || actionMatch[2]] || null : null;
    };
    root.querySelectorAll = () => [];

    const frameQueue = new Map();
    let frameId = 0;
    const document = {
        activeElement: null,
        createElement: (tagName) => new DesignerNode(tagName),
        getElementById: (id) => id === root.id ? root : null
    };
    const window = {
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
        clearTimeout() {},
        URL: {
            createObjectURL: () => "blob:arrange-test",
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
        actions,
        api: root.__labelDesigner,
        async settle() {
            await Promise.resolve();
            await Promise.resolve();
        },
        clickLayer(id, append = false) {
            const layer = new DesignerNode("button");
            layer.className = "fwwebex-label-layer";
            layer.dataset.id = id;
            root.dispatch("click", {target: layer, shiftKey: append});
        },
        clickAction(action) {
            root.dispatch("click", {target: actions[action]});
        }
    };
}

test("Designer shell exposes the complete Organize menu contract", () => {
    const menu = /<details[^>]+data-role="arrange-menu"[\s\S]*?<\/details>/.exec(
        designerSource
    )?.[0] || "";

    assert.match(menu, /Organizar sele(?:&ccedil;|ç)&atilde;o/);
    assert.match(menu, /data-role="position-direction"/);
    for (const direction of ["above", "below", "left", "right"]) {
        assert.match(menu, new RegExp(`<option value="${direction}">`));
    }
    assert.match(menu, /data-role="cross-align"/);
    for (const crossAlign of ["start", "center", "end", "stretch"]) {
        assert.match(menu, new RegExp(`<option value="${crossAlign}">`));
    }
    for (const action of [
        "distribute-horizontal",
        "distribute-vertical",
        "equal-width",
        "equal-height",
        "equal-size"
    ]) {
        assert.match(menu, new RegExp(`data-action="${action}"`));
    }
});

test("chain mode reuses direction, gap and crossAlign and rejects overflow", async () => {
    const harness = createDesignerHarness();
    await harness.settle();
    const source = labelLayout([], {width: 100, height: 60});
    source.editor.snap.chainMode = true;
    harness.api.load(source);
    harness.roles["position-direction"].value = "right";
    harness.roles["stack-gap"].value = "3";
    harness.roles["cross-align"].value = "end";

    harness.api.addText({
        id: "reference",
        box: {x: 10, y: 10, width: 10, height: 12}
    });
    harness.api.addText({id: "second"});
    harness.api.addText({id: "third"});
    harness.api.addText({id: "overflow"});
    const layout = plain(harness.api.exportLayout());

    assert.deepEqual(byId(layout, "second").box, {
        x: 23, y: 14, width: 35, height: 8
    });
    assert.deepEqual(byId(layout, "third").box, {
        x: 61, y: 14, width: 35, height: 8
    });
    assert.deepEqual(
        byId(layout, "overflow").box,
        {x: 5, y: 5, width: 35, height: 8},
        "overflow must preserve the element's initial position"
    );
    assert.equal(layout.editor.snap.chainMode, true);
    assert.equal(harness.roles["position-direction"].value, "right");
    assert.equal(harness.roles["stack-gap"].value, "3");
    assert.equal(harness.roles["cross-align"].value, "end");
    assert.match(
        harness.roles["status-message"].textContent,
        /ultrapassaria a p[aá]gina/i
    );
});

test("an arrange toolbar action creates exactly one undo checkpoint", async () => {
    const harness = createDesignerHarness();
    await harness.settle();
    const source = labelLayout([
        textElement("reference", {x: 40, y: 20, width: 20, height: 10}),
        textElement("target", {x: 5, y: 4, width: 8, height: 4})
    ]);
    source.editor.snap.referenceElementId = "reference";
    harness.api.load(source);

    harness.clickLayer("target");
    assert.equal(harness.roles["arrange-menu"].hidden, true);
    harness.clickLayer("reference", true);
    assert.equal(harness.roles["arrange-menu"].hidden, false);
    harness.roles["align-mode"].value = "left";
    harness.clickAction("align");
    assert.equal(byId(plain(harness.api.exportLayout()), "target").box.x, 40);

    assert.equal(harness.api.undo(), true);
    assert.equal(byId(plain(harness.api.exportLayout()), "target").box.x, 5);
    assert.equal(
        harness.api.undo(),
        false,
        "one click must not create a second history entry"
    );
    assert.equal(harness.api.redo(), true);
    assert.equal(byId(plain(harness.api.exportLayout()), "target").box.x, 40);
    assert.equal(harness.api.redo(), false);
});
