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
assert.ok(generatorSource, "embedded Labels generator runtime was not found");

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
        this.listeners = new Map();
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    querySelector(selector) {
        if (selector === ".fwwebex-label-field-content") {
            return this.children.find((child) =>
                child.className === "fwwebex-label-field-content"
            ) || null;
        }
        return null;
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }

    dispatch(type, event) {
        const listener = this.listeners.get(type);
        if (listener) listener(event);
    }

    dispatchEvent() {
        return true;
    }

    closest(selector) {
        if (selector === ".fwwebex-label-field" &&
            this.className.split(/\s+/).includes("fwwebex-label-field")) {
            return this;
        }
        return this.parentElement ? this.parentElement.closest(selector) : null;
    }

    setPointerCapture() {}

    set innerHTML(value) {
        if (value === "") this.children = [];
    }

    get innerHTML() {
        return "";
    }
}

function createHarness() {
    const root = new FakeElement("section");
    const roles = {
        stage: new FakeElement("div"),
        background: new FakeElement("img"),
        fields: new FakeElement("div")
    };
    roles.stage.appendChild(roles.background);
    roles.stage.appendChild(roles.fields);
    root.querySelector = (selector) => {
        const match = /^\[data-role=(.+)\]$/.exec(selector);
        return match ? roles[match[1]] || null : null;
    };

    const context = {
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
        window: {
            prompt: () => null
        }
    };

    vm.runInNewContext(generatorSource, context);
    vm.runInNewContext(
        designerSource
            .replaceAll("__ID__", "layout-engine-test")
            .replaceAll("__WIDTH__", "100")
            .replaceAll("__HEIGHT__", "60"),
        context
    );

    return {
        designer: root.__labelDesigner,
        layoutEngine: context.window.FWWebExLabels.layout,
        labelsAPI: context.window.FWWebExLabels,
        roles
    };
}

function text(id, box, containerId = null, locked = false) {
    return {
        id,
        name: id,
        type: "text",
        template: `{{${id}}}`,
        box,
        basisBox: {width: box.width, height: box.height},
        rotation: 0,
        zIndex: 1,
        locked,
        hidden: false,
        containerId,
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

function container(id, box, children, containerId = null, overrides = {}) {
    return {
        id,
        name: id,
        type: "container",
        template: "",
        box,
        basisBox: {width: box.width, height: box.height},
        rotation: 0,
        zIndex: 0,
        locked: overrides.locked === true,
        hidden: false,
        containerId,
        layout: {
            direction: overrides.direction || "vertical",
            padding: overrides.padding || {
                top: 2, right: 2, bottom: 2, left: 2
            },
            gap: overrides.gap ?? 2,
            crossAlign: overrides.crossAlign || "stretch",
            mainAlign: overrides.mainAlign || "start",
            sizing: overrides.sizing || "none",
            overflow: overrides.overflow || "error",
            clipChildren: false,
            children
        }
    };
}

function nestedLayout() {
    return {
        schema: "fwwebex.labels",
        version: 2,
        name: "nested-layout",
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
        editor: {},
        variables: [],
        barcodeAutoRules: [],
        barcodeFallbackFormat: "CODE128",
        elements: [
            container(
                "outer",
                {x: 10, y: 10, width: 80, height: 40},
                ["inner", "tail"]
            ),
            container(
                "inner",
                {x: 0, y: 0, width: 30, height: 16},
                ["a", "b"],
                "outer",
                {
                    locked: true,
                    direction: "horizontal",
                    padding: {top: 1, right: 1, bottom: 1, left: 1},
                    gap: 1,
                    crossAlign: "center"
                }
            ),
            text("b", {x: 0, y: 0, width: 12, height: 6}, "inner"),
            text("a", {x: 0, y: 0, width: 10, height: 4}, "inner"),
            text("tail", {x: 0, y: 0, width: 20, height: 5}, "outer")
        ]
    };
}

function select(roles, id) {
    const field = roles.fields.children.find((child) => child.dataset.id === id);
    assert.ok(field, `designer field ${id} was not rendered`);
    roles.stage.dispatch("pointerdown", {
        target: field,
        shiftKey: false,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        preventDefault() {}
    });
    roles.stage.dispatch("pointerup", {});
}

test("publishes one reusable LayoutEngine instead of private designer/PDF copies", () => {
    const {layoutEngine, labelsAPI} = createHarness();

    assert.ok(
        layoutEngine,
        "FWWebExLabels.layout must be public before designer or renderer integration"
    );
    for (const method of [
        "resolve",
        "assign",
        "duplicate",
        "remove",
        "translate"
    ]) {
        assert.equal(
            typeof layoutEngine[method],
            "function",
            `FWWebExLabels.layout.${method} must be public`
        );
    }
    assert.equal(
        labelsAPI.layoutEngine,
        layoutEngine,
        "layoutEngine compatibility alias must reference the canonical layout namespace"
    );
});

test("public resolve is pure, idempotent and honors explicit nested order", () => {
    const {layoutEngine} = createHarness();
    const source = nestedLayout();
    const before = plain(source);

    const first = plain(layoutEngine.resolve(source, []).layout);
    const second = plain(layoutEngine.resolve(first, []).layout);

    assert.deepEqual(source, before, "resolve must not mutate the contract supplied by its caller");
    assert.deepEqual(
        second.elements.map((item) => ({id: item.id, box: item.box})),
        first.elements.map((item) => ({id: item.id, box: item.box})),
        "a confirmed reflow must be stable when resolved again"
    );
    assert.deepEqual(
        first.elements.find((item) => item.id === "a").box,
        {x: 13, y: 18, width: 10, height: 4}
    );
    assert.deepEqual(
        first.elements.find((item) => item.id === "b").box,
        {x: 24, y: 17, width: 12, height: 6}
    );
});

test("public assign moves membership atomically at an explicit insertion index", () => {
    const {layoutEngine} = createHarness();
    const source = nestedLayout();
    const before = plain(source);

    const result = plain(layoutEngine.assign(source, ["tail"], "inner", {index: 1}));
    const outer = result.layout.elements.find((item) => item.id === "outer");
    const inner = result.layout.elements.find((item) => item.id === "inner");
    const tail = result.layout.elements.find((item) => item.id === "tail");

    assert.deepEqual(source, before, "assign must not mutate its input");
    assert.equal(tail.containerId, "inner");
    assert.deepEqual(outer.layout.children, ["inner"]);
    assert.deepEqual(inner.layout.children, ["a", "tail", "b"]);
    assert.deepEqual(result.ids, ["tail"]);
});

test("public duplicate clones a complete subtree and remaps every relation", () => {
    const {layoutEngine} = createHarness();
    const source = nestedLayout();
    const before = plain(source);
    const result = plain(layoutEngine.duplicate(source, ["inner"], {
        offsetX: 2,
        offsetY: 3,
        idFactory: (id) => `${id}-copy`
    }));
    const copy = result.layout.elements.find((item) => item.id === "inner-copy");
    const aCopy = result.layout.elements.find((item) => item.id === "a-copy");
    const bCopy = result.layout.elements.find((item) => item.id === "b-copy");
    const outer = result.layout.elements.find((item) => item.id === "outer");

    assert.deepEqual(source, before, "duplicate must not mutate its input");
    assert.deepEqual(result.idMap, {
        inner: "inner-copy",
        a: "a-copy",
        b: "b-copy"
    });
    assert.deepEqual(result.ids, ["inner-copy"]);
    assert.equal(copy.containerId, "outer");
    assert.deepEqual(copy.layout.children, ["a-copy", "b-copy"]);
    assert.equal(copy.locked, false, "a fresh copy must be editable");
    assert.equal(aCopy.containerId, "inner-copy");
    assert.equal(bCopy.containerId, "inner-copy");
    assert.deepEqual(
        outer.layout.children,
        ["inner", "inner-copy", "tail"],
        "the subtree copy must be inserted after its source"
    );
});

test("public remove cascades and returns every removed subtree ID", () => {
    const {layoutEngine} = createHarness();
    const source = nestedLayout();
    const before = plain(source);
    const result = plain(layoutEngine.remove(source, ["inner"], {cascade: true}));
    const outer = result.layout.elements.find((item) => item.id === "outer");

    assert.deepEqual(source, before, "remove must not mutate its input");
    assert.deepEqual(new Set(result.removedIds), new Set(["inner", "a", "b"]));
    assert.deepEqual(result.layout.elements.map((item) => item.id), ["outer", "tail"]);
    assert.deepEqual(outer.layout.children, ["tail"]);
});

test("public translate moves the whole subtree even when a descendant is locked", () => {
    const {layoutEngine} = createHarness();
    const flowed = plain(layoutEngine.resolve(nestedLayout(), []).layout);
    const before = plain(flowed);
    const result = plain(layoutEngine.translate(
        flowed,
        "outer",
        {dx: 3, dy: 2},
        {respectLocked: true}
    ));
    const byId = new Map(result.layout.elements.map((item) => [item.id, item]));

    assert.deepEqual(flowed, before, "translate must not mutate its input");
    assert.deepEqual(result.changedIds, ["outer", "inner", "a", "b", "tail"]);
    assert.deepEqual(byId.get("outer").box, {x: 13, y: 12, width: 80, height: 40});
    assert.deepEqual(byId.get("inner").box, {x: 15, y: 14, width: 76, height: 16});
    assert.deepEqual(byId.get("a").box, {x: 16, y: 20, width: 10, height: 4});
    assert.deepEqual(byId.get("b").box, {x: 27, y: 19, width: 12, height: 6});
    assert.deepEqual(byId.get("tail").box, {x: 15, y: 32, width: 76, height: 5});
    assert.equal(byId.get("inner").locked, true);
});

test("automatic reflow ignores locked because lock is editor state only", () => {
    const {designer} = createHarness();
    designer.load(nestedLayout());

    const result = designer.layoutContainer("outer");
    const layout = plain(designer.exportLayout());
    const inner = layout.elements.find((item) => item.id === "inner");
    const tail = layout.elements.find((item) => item.id === "tail");

    assert.equal(result.overflow, false);
    assert.deepEqual(inner.box, {x: 12, y: 12, width: 76, height: 16});
    assert.deepEqual(tail.box, {x: 12, y: 30, width: 76, height: 5});
    assert.equal(inner.locked, true, "reflow must not change editor lock state");
});

test("designer reflow is recursive and follows every explicit children order", () => {
    const {designer} = createHarness();
    designer.load(nestedLayout());

    designer.layoutContainer("outer");
    const layout = plain(designer.exportLayout());
    const a = layout.elements.find((item) => item.id === "a");
    const b = layout.elements.find((item) => item.id === "b");

    assert.deepEqual(a.box, {x: 13, y: 18, width: 10, height: 4});
    assert.deepEqual(b.box, {x: 24, y: 17, width: 12, height: 6});
});

test("pointer resize persists the child basis through automatic container reflow", () => {
    const {designer, layoutEngine, roles} = createHarness();
    designer.load(nestedLayout());
    designer.layoutContainer("outer");

    let field = roles.fields.children.find((child) => child.dataset.id === "a");
    const grip = field.children.find((child) => child.dataset.resize === "1");
    assert.ok(grip, "child a resize grip must exist");
    roles.stage.dispatch("pointerdown", {
        target: grip,
        shiftKey: false,
        clientX: 100,
        clientY: 100,
        pointerId: 3,
        preventDefault() {}
    });
    roles.stage.dispatch("pointermove", {
        target: grip,
        clientX: 150,
        clientY: 100,
        pointerId: 3
    });
    roles.stage.dispatch("pointerup", {});

    const edited = plain(designer.exportLayout());
    const child = edited.elements.find((item) => item.id === "a");
    assert.equal(child.box.width, 15);
    assert.equal(child.basisBox.width, 15);

    const resolved = plain(layoutEngine.resolve(edited, []).layout);
    assert.equal(
        resolved.elements.find((item) => item.id === "a").box.width,
        15,
        "validation/PDF reflow must not restore the old 10 mm width"
    );
});

test("designer can fit a container box exactly to its configured child bases", () => {
    const {designer} = createHarness();
    designer.load(nestedLayout());

    const result = plain(designer.fitContainerToContents("outer"));
    const outer = plain(designer.exportLayout()).elements.find(
        (item) => item.id === "outer"
    );

    assert.equal(result.applied, true);
    assert.equal(result.count, 2);
    assert.deepEqual(outer.box, {x: 10, y: 10, width: 34, height: 27});
    assert.deepEqual(outer.basisBox, {width: 34, height: 27});
});

test("fitting a nested container reports both its basis and parent-constrained size", () => {
    const {designer} = createHarness();
    const layout = nestedLayout();
    layout.elements.find((item) => item.id === "inner").locked = false;
    designer.load(layout);

    const result = plain(designer.fitContainerToContents("inner"));
    const inner = plain(designer.exportLayout()).elements.find(
        (item) => item.id === "inner"
    );

    assert.equal(result.applied, true);
    assert.equal(result.constrainedByParent, true);
    assert.deepEqual(
        {width: result.basisWidth, height: result.basisHeight},
        {width: 25, height: 8}
    );
    assert.deepEqual(
        {width: result.width, height: result.height},
        {width: 76, height: 8}
    );
    assert.deepEqual(inner.basisBox, {width: 25, height: 8});
    assert.deepEqual(
        {width: inner.box.width, height: inner.box.height},
        {width: result.width, height: result.height},
        "the API result must describe the final visible box after parent reflow"
    );
});

test("fit-to-content lets the parent reflow an initially out-of-page child", () => {
    const {designer} = createHarness();
    const layout = nestedLayout();
    const inner = layout.elements.find((item) => item.id === "inner");
    inner.locked = false;
    inner.box.x = 95;
    inner.box.y = 55;
    designer.load(layout);

    const result = plain(designer.fitContainerToContents("inner"));
    const current = plain(designer.exportLayout()).elements.find(
        (item) => item.id === "inner"
    );

    assert.equal(result.applied, true);
    assert.ok(current.box.x >= 0 && current.box.y >= 0);
    assert.ok(current.box.x + current.box.width <= layout.page.width);
    assert.ok(current.box.y + current.box.height <= layout.page.height);
});

test("fit-to-content refuses negative and rotation-induced page overflow", async (t) => {
    const cases = [{
        name: "negative position",
        configure(outer) {
            outer.box.x = -1;
            outer.basisBox.width = outer.box.width;
            outer.basisBox.height = outer.box.height;
        }
    }, {
        name: "rotated bounds",
        configure(outer) {
            outer.box.x = 0;
            outer.box.y = 0;
            outer.rotation = 45;
        }
    }];

    for (const scenario of cases) {
        await t.test(scenario.name, () => {
            const {designer} = createHarness();
            const layout = nestedLayout();
            const outer = layout.elements.find((item) => item.id === "outer");
            scenario.configure(outer);
            const previousBox = plain(outer.box);
            const previousBasis = plain(outer.basisBox);
            designer.load(layout);

            const result = plain(designer.fitContainerToContents("outer"));
            const current = plain(designer.exportLayout()).elements.find(
                (item) => item.id === "outer"
            );

            assert.equal(result.applied, false);
            assert.equal(result.overflow, true);
            assert.deepEqual(current.box, previousBox);
            assert.deepEqual(current.basisBox, previousBasis);
        });
    }
});

test("duplicating one child preserves the bidirectional explicit membership", () => {
    const {designer, roles} = createHarness();
    designer.load(nestedLayout());
    select(roles, "a");

    const [copy] = plain(designer.duplicate());
    const layout = plain(designer.exportLayout());
    const inner = layout.elements.find((item) => item.id === "inner");

    assert.equal(copy.containerId, "inner");
    assert.deepEqual(
        inner.layout.children,
        ["a", copy.id, "b"],
        "the copy must be inserted after its source in the explicit order"
    );
});

test("removing a container cascades through its explicit subtree without dangling IDs", () => {
    const {designer, roles} = createHarness();
    designer.load(nestedLayout());
    select(roles, "inner");

    designer.remove();
    const layout = plain(designer.exportLayout());
    const ids = layout.elements.map((item) => item.id);
    const outer = layout.elements.find((item) => item.id === "outer");

    assert.deepEqual(ids, ["outer", "tail"]);
    assert.deepEqual(outer.layout.children, ["tail"]);
    assert.equal(
        layout.elements.some((item) =>
            item.containerId && !ids.includes(item.containerId)
        ),
        false,
        "removal must never leave a dangling containerId"
    );
});
