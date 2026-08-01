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

const executableDesignerSource = designerSource
    .replaceAll("__ID__", "designer-test")
    .replaceAll("__WIDTH__", "100")
    .replaceAll("__HEIGHT__", "60");

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
        this.src = "";
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

function createRoot({missingRole = null} = {}) {
    const root = new FakeElement("section");
    const roles = {
        stage: new FakeElement("div"),
        background: new FakeElement("img"),
        fields: new FakeElement("div"),
        "status-message": new FakeElement("span"),
        "status-selection": new FakeElement("span")
    };
    roles.stage.clientWidth = 1000;
    roles.stage.clientHeight = 600;
    roles.stage.appendChild(roles.background);
    roles.stage.appendChild(roles.fields);
    root.querySelector = (selector) => {
        const match = /^\[data-role=(.+)\]$/.exec(selector);
        if (!match || match[1] === missingRole) return null;
        return roles[match[1]] || null;
    };
    return {root, roles};
}

function createHarness() {
    const {root, roles} = createRoot();
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
    vm.runInNewContext(executableDesignerSource, context);

    return {
        designer: root.__labelDesigner,
        root,
        roles
    };
}

function fieldKeys(element) {
    return Object.keys(element).sort();
}

test("designer loads v1 and exports only the canonical v2 shape", () => {
    const {designer} = createHarness();
    const exported = plain(designer.load({
        version: 1,
        name: "legacy",
        unit: "mm",
        page: {width: 90, height: 45, rotation: 0},
        background: "data:image/png;base64,LEGACY",
        elements: [{
            id: "produto",
            type: "text",
            value: "{{produto.codigo}}",
            x: 2,
            y: 3,
            width: 30,
            height: 7,
            fontFamily: "courier",
            fontSize: 9,
            minFontSize: 5,
            padding: 1,
            margin: 0,
            autoFit: true,
            maxLines: 2,
            overflow: "ellipsis"
        }]
    }));

    assert.equal(exported.schema, "fwwebex.labels");
    assert.equal(exported.version, 2);
    assert.equal(exported.unit, "mm");
    assert.deepEqual(exported.elements[0].box, {
        x: 2, y: 3, width: 30, height: 7
    });
    assert.equal(exported.elements[0].template, "{{produto.codigo}}");
    assert.deepEqual(exported.elements[0].style.padding, {
        top: 1, right: 1, bottom: 1, left: 1
    });
    assert.deepEqual(exported.elements[0].fit, {
        mode: "shrink", maxLines: 2, overflow: "ellipsis"
    });

    const legacyFlatFields = [
        "x", "y", "width", "height", "value", "fontFamily", "fontSize",
        "minFontSize", "padding", "margin", "autoFit", "maxLines", "overflow",
        "bold"
    ];
    assert.deepEqual(
        fieldKeys(exported.elements[0]).filter((key) =>
            legacyFlatFields.includes(key)
        ),
        [],
        "legacy accessors must never become enumerable export fields"
    );
});

test("designer v2 round-trip preserves exact background and explicit zeroes", () => {
    const {designer, roles} = createHarness();
    const dataUrl = "data:image/png;base64,AA+/00==";
    const exported = plain(designer.load({
        schema: "fwwebex.labels",
        version: 2,
        name: "canonical",
        unit: "mm",
        page: {
            width: 100,
            height: 60,
            rotation: 270,
            margins: {top: 1, right: 2, bottom: 3, left: 4},
            safeArea: 0,
            bleed: 0
        },
        background: {
            dataUrl,
            fit: "contain",
            opacity: 0,
            locked: false
        },
        editor: {
            grid: {enabled: true, step: 0.5},
            snap: {
                enabled: true,
                tolerancePx: 4,
                referenceElementId: "texto",
                chainMode: false
            },
            guides: []
        },
        variables: [],
        barcodeAutoRules: [],
        barcodeFallbackFormat: "CODE128",
        elements: [{
            id: "texto",
            name: "Texto",
            type: "text",
            template: "{{produto}}",
            box: {x: 5, y: 6, width: 30, height: 8},
            rotation: 0,
            zIndex: 0,
            locked: false,
            hidden: false,
            containerId: null,
            style: {
                fontFamily: "helvetica",
                fontSize: 10,
                minFontSize: 4,
                fontStyle: "normal",
                color: "#112233",
                lineHeightFactor: 1.2,
                letterSpacing: 0,
                align: "left",
                verticalAlign: "top",
                padding: {top: 0, right: 1, bottom: 2, left: 3},
                margin: {top: 4, right: 3, bottom: 2, left: 1}
            },
            fit: {mode: "shrink", maxLines: 2, overflow: "ellipsis"},
            textOptions: {}
        }, {
            id: "barcode",
            name: "Codigo",
            type: "barcode",
            template: "{{barcode}}",
            box: {x: 40, y: 6, width: 45, height: 18},
            rotation: 0,
            zIndex: 1,
            locked: false,
            hidden: false,
            containerId: null,
            format: "EAN13",
            fallbackFormat: "CODE128",
            displayValue: true,
            quietZone: 0,
            minModuleWidth: 0.19,
            overflow: "error",
            humanReadableFontSize: 10,
            humanReadableMinFontSize: 6,
            humanReadableFontFamily: "courier",
            humanReadableFontStyle: "normal",
            humanReadableColor: "#000000",
            humanReadablePosition: "bottom",
            humanReadableAlign: "center",
            textMargin: 0,
            autoFit: true,
            textOverflow: "error",
            barcodeOptions: {}
        }]
    }));

    assert.equal(exported.background.dataUrl, dataUrl);
    assert.equal(exported.background.opacity, 0);
    assert.equal(roles.background.src, dataUrl);
    assert.equal(roles.background.style.opacity, "0");
    assert.deepEqual(exported.page.margins, {
        top: 1, right: 2, bottom: 3, left: 4
    });
    assert.deepEqual(exported.elements[0].style.padding, {
        top: 0, right: 1, bottom: 2, left: 3
    });
    assert.deepEqual(exported.elements[0].style.margin, {
        top: 4, right: 3, bottom: 2, left: 1
    });
    assert.equal(exported.elements[1].textMargin, 0);
    assert.equal(exported.elements[1].quietZone, 0);
});

test("designer page API accepts complete document geometry without JSON editing", () => {
    const {designer} = createHarness();

    designer.setPage({
        width: 120,
        height: 80,
        rotation: 270,
        margins: {top: 1, right: 2, bottom: 3, left: 4},
        safeArea: 2.5,
        bleed: 1.5
    });

    const page = plain(designer.exportLayout().page);
    assert.deepEqual(page, {
        width: 120,
        height: 80,
        rotation: 270,
        margins: {top: 1, right: 2, bottom: 3, left: 4},
        safeArea: 2.5,
        bleed: 1.5
    });
});

test("designer discovers missing variables and reports unused declarations", () => {
    const {designer} = createHarness();
    designer.load({
        schema: "fwwebex.labels",
        version: 2,
        name: "variables",
        unit: "mm",
        page: {width: 100, height: 60, rotation: 0},
        editor: {},
        variables: [{name: "legado", type: "string"}],
        barcodeAutoRules: [],
        elements: [{
            id: "produto",
            type: "text",
            template: "{{produto.codigo}} / {{lote}}",
            box: {x: 1, y: 1, width: 40, height: 6},
            style: {fontSize: 8, minFontSize: 4},
            fit: {mode: "shrink", maxLines: 1, overflow: "error"}
        }],
        background: null
    });

    const preview = plain(designer.discoverVariables(false));
    assert.deepEqual(preview.used, ["produto.codigo", "lote"]);
    assert.deepEqual(preview.missing, ["produto.codigo", "lote"]);
    assert.deepEqual(preview.unused, ["legado"]);

    designer.discoverVariables(true);
    assert.deepEqual(
        plain(designer.exportLayout().variables.map((item) => item.name)),
        ["legado", "produto.codigo", "lote"]
    );
});

test("keyboard movement keeps the documented 0.1 mm and 1 mm steps", () => {
    const {designer, root, roles} = createHarness();
    designer.load({
        version: 1,
        page: {width: 100, height: 60, rotation: 0},
        editor: {grid: {enabled: true, step: 5}},
        elements: [{
            id: "texto",
            type: "text",
            value: "{{texto}}",
            x: 10,
            y: 10,
            width: 20,
            height: 5
        }]
    });
    designer.addText({id: "movel", box: {x: 10, y: 10, width: 20, height: 5}});
    const event = (key, shiftKey = false) => ({
        target: roles.stage,
        key,
        shiftKey,
        ctrlKey: false,
        metaKey: false,
        preventDefault() {}
    });

    root.dispatch("keydown", event("ArrowRight"));
    root.dispatch("keydown", event("ArrowDown", true));

    const moved = designer.exportLayout().elements.find((item) => item.id === "movel");
    assert.equal(moved.box.x, 10.1);
    assert.equal(moved.box.y, 11);
});

test("Escape ends the chained positioning mode", () => {
    const {designer, root, roles} = createHarness();
    designer.load({
        version: 1,
        page: {width: 100, height: 60, rotation: 0},
        editor: {snap: {chainMode: true}},
        elements: []
    });

    root.dispatch("keydown", {
        target: roles.stage,
        key: "Escape",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault() {}
    });

    assert.equal(designer.exportLayout().editor.snap.chainMode, false);
});

test("invalid imported reference is cleared with a non-blocking warning", () => {
    const {designer, roles} = createHarness();
    designer.load({
        version: 1,
        page: {width: 100, height: 60, rotation: 0},
        editor: {snap: {referenceElementId: "inexistente"}},
        elements: []
    });

    assert.equal(designer.exportLayout().editor.snap.referenceElementId, null);
    assert.match(roles["status-message"].textContent, /inexistente/);
    assert.equal(roles["status-message"].dataset.state, "warning");
});

test("status identifies the magnetic reference by name and id", () => {
    const {designer, roles} = createHarness();
    designer.load({
        version: 1,
        page: {width: 100, height: 60, rotation: 0},
        editor: {snap: {referenceElementId: "produto"}},
        elements: [{
            id: "produto",
            name: "Produto principal",
            type: "text",
            value: "{{produto}}",
            x: 1,
            y: 1,
            width: 20,
            height: 5
        }]
    });

    assert.match(
        roles["status-selection"].textContent,
        /Produto principal \(produto\)/
    );
});

test("designer operations retain canonical element structures", () => {
    const {designer} = createHarness();

    const area = designer.addContainer({
        id: "area",
        box: {x: 10, y: 10, width: 70, height: 40},
        layout: {
            direction: "vertical",
            padding: {top: 1, right: 2, bottom: 3, left: 4},
            gap: 1.5,
            crossAlign: "left",
            mainAlign: "start",
            sizing: "none",
            overflow: "error",
            clipChildren: true,
            children: []
        }
    });
    assert.equal(area.id, "area");

    designer.addText({
        id: "produto",
        template: "{{produto}}",
        box: {x: 14, y: 12, width: 32, height: 9},
        style: {
            fontFamily: "courier",
            fontSize: 11,
            minFontSize: 5,
            fontStyle: "normal",
            color: "#123456",
            lineHeightFactor: 1.25,
            letterSpacing: 0.1,
            align: "left",
            verticalAlign: "top",
            padding: {top: 1, right: 2, bottom: 1, left: 2},
            margin: {top: 0, right: 1, bottom: 2, left: 3}
        },
        fit: {mode: "shrink", maxLines: 2, overflow: "ellipsis"}
    });
    designer.updateSelected({
        box: {x: 15, width: 34},
        style: {fontStyle: "bold", align: "center"},
        fit: {maxLines: 3},
        containerId: "area"
    });
    designer.toggleLock();

    const beforeDuplicate = plain(designer.exportLayout());
    const original = beforeDuplicate.elements.find((item) => item.id === "produto");
    const originalArea = beforeDuplicate.elements.find((item) => item.id === "area");
    assert.deepEqual(original.box, {x: 15, y: 12, width: 34, height: 9});
    assert.equal(original.style.fontFamily, "courier");
    assert.equal(original.style.fontStyle, "bold");
    assert.equal(original.style.align, "center");
    assert.deepEqual(original.style.padding, {
        top: 1, right: 2, bottom: 1, left: 2
    });
    assert.deepEqual(original.style.margin, {
        top: 0, right: 1, bottom: 2, left: 3
    });
    assert.deepEqual(original.fit, {
        mode: "shrink", maxLines: 3, overflow: "ellipsis"
    });
    assert.equal(original.locked, true);
    assert.equal(original.containerId, "area");
    assert.ok(originalArea.layout.children.includes("produto"));
    assert.deepEqual(originalArea.layout.padding, {
        top: 1, right: 2, bottom: 3, left: 4
    });

    const copies = plain(designer.duplicate());
    assert.equal(copies.length, 1);
    assert.notEqual(copies[0].id, "produto");
    assert.deepEqual(copies[0].box, {x: 17, y: 14, width: 34, height: 9});
    assert.deepEqual(copies[0].style, original.style);
    assert.deepEqual(copies[0].fit, original.fit);
    assert.equal(copies[0].locked, false);
    assert.equal(copies[0].containerId, "area");

    designer.toggleLock();
    const finalLayout = plain(designer.exportLayout());
    const copy = finalLayout.elements.find((item) => item.id === copies[0].id);
    const finalArea = finalLayout.elements.find((item) => item.id === "area");
    assert.equal(copy.locked, true);
    assert.deepEqual(
        finalArea.layout.children,
        ["produto", copies[0].id],
        "duplicating a child must preserve bidirectional container membership"
    );
    assert.deepEqual(
        {...finalArea.layout, children: originalArea.layout.children},
        originalArea.layout
    );
});

test("designer reports every required structural role by name", async (t) => {
    for (const missingRole of ["stage", "background", "fields"]) {
        await t.test(`missing ${missingRole}`, () => {
            const {root} = createRoot({missingRole});
            const context = {
                CustomEvent: class {},
                document: {
                    createElement: (tagName) => new FakeElement(tagName),
                    getElementById: () => root
                },
                window: {}
            };

            assert.throws(
                () => vm.runInNewContext(executableDesignerSource, context),
                (error) => {
                    assert.match(error.message, /estrutura do designer incompleta/i);
                    assert.match(error.message, /\bstage\b/i);
                    assert.match(error.message, /\bbackground\b/i);
                    assert.match(error.message, /\bfields\b/i);
                    return true;
                }
            );
        });
    }
});
