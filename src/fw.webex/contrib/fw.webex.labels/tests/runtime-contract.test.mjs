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

const generatorSource = scripts.find((script) =>
    script.includes("function normalizeLayout") &&
    script.includes("window.FWWebExLabels.renderer.generate=generate")
);

assert.ok(generatorSource, "embedded Labels generator runtime was not found");

const root = {};
const context = {
    console,
    document: {
        getElementById: () => root,
        createElement: () => ({})
    },
    window: {}
};

vm.runInNewContext(generatorSource, context);

const {normalize, serialize, validate} = context.window.FWWebExLabels.contract;

test("normalizes a version 1 contract to the version 2 internal model", () => {
    const layout = normalize({
        version: 1,
        name: "legacy",
        unit: "mm",
        page: {width: 100, height: 60, rotation: 0},
        background: "data:image/png;base64,AAAA",
        elements: [{
            id: "produto",
            type: "text",
            value: "{{produto.codigo}}",
            x: 2,
            y: 3,
            width: 20,
            height: 5,
            padding: 0,
            fontSize: 8,
            minFontSize: 4
        }]
    });

    assert.equal(layout.schema, "fwwebex.labels");
    assert.equal(layout.version, 2);
    assert.equal(layout.background.dataUrl, "data:image/png;base64,AAAA");
    assert.deepEqual({...layout.elements[0].box}, {
        x: 2, y: 3, width: 20, height: 5
    });
    assert.equal(layout.elements[0].template, "{{produto.codigo}}");
    assert.deepEqual({...layout.elements[0].style.padding}, {
        top: 0, right: 0, bottom: 0, left: 0
    });
});

test("serializes background as the last top-level JSON member", () => {
    const layout = serialize({
        version: 1,
        name: "background-order",
        page: {width: 100, height: 60, rotation: 0},
        background: "data:image/png;base64,AAAA",
        elements: []
    });

    assert.equal(Object.keys(layout).at(-1), "background");
    assert.match(
        JSON.stringify(layout),
        /"elements":\[\],"background":\{"dataUrl":"data:image\/png;base64,AAAA"/
    );
});

test("normalizes only the supported editor metadata", () => {
    const layout = normalize({
        schema: "fwwebex.labels",
        version: 2,
        page: {width: 100, height: 60, rotation: 0},
        editor: {
            grid: {enabled: true, step: 0.5, foreign: "discard"},
            snap: {
                enabled: true,
                tolerancePx: 6,
                referenceElementId: "produto",
                chainMode: true,
                foreign: "discard"
            },
            guides: [{axis: "x", position: 10}],
            foreign: {must: "not survive"}
        },
        elements: [],
        background: null
    });

    assert.deepEqual({...layout.editor.grid}, {enabled: true, step: 0.5});
    assert.deepEqual({...layout.editor.snap}, {
        enabled: true,
        tolerancePx: 6,
        referenceElementId: "produto",
        chainMode: true
    });
    assert.deepEqual(JSON.parse(JSON.stringify(layout.editor.guides)), [
        {axis: "x", position: 10}
    ]);
    assert.equal(Object.hasOwn(layout.editor, "foreign"), false);
    assert.equal(Object.hasOwn(layout.editor.grid, "foreign"), false);
    assert.equal(Object.hasOwn(layout.editor.snap, "foreign"), false);
});

test("returns structured issues for duplicate ids and missing nested values", () => {
    const report = validate({
        version: 1,
        page: {width: 100, height: 60, rotation: 0},
        variables: [{name: "produto.codigo", required: true}],
        elements: [
            {id: "duplicado", type: "text", value: "{{produto.codigo}}",
                x: 0, y: 0, width: 10, height: 5},
            {id: "duplicado", type: "text", value: "{{produto.codigo}}",
                x: 20, y: 0, width: 10, height: 5}
        ]
    }, {produto: {}});

    assert.equal(report.valid, false);
    assert.ok(report.issues.every((item) =>
        typeof item.code === "string" &&
        typeof item.severity === "string" &&
        typeof item.path === "string" &&
        typeof item.message === "string" &&
        typeof item.suggestion === "string"
    ));
    assert.ok(report.errors.some((item) => item.code === "ELEMENT_ID_DUPLICATE"));
    assert.ok(report.errors.some((item) => item.code === "VARIABLE_REQUIRED_MISSING"));
});

test("preserves explicit zero values during normalization", () => {
    const layout = normalize({
        version: 1,
        page: {width: 50, height: 30, rotation: 0},
        elements: [{
            id: "barcode",
            type: "barcode",
            value: "{{codigo}}",
            x: 1,
            y: 1,
            width: 30,
            height: 10,
            quietZone: 0,
            textMargin: 0,
            minModuleWidth: 0
        }]
    });

    assert.equal(layout.elements[0].quietZone, 0);
    assert.equal(layout.elements[0].textMargin, 0);
    assert.equal(layout.elements[0].minModuleWidth, 0);
});

test("migrates legacy JsBarcode pixel typography to canonical units", () => {
    const layout = normalize({
        version: 1,
        page: {width: 50, height: 30, rotation: 0},
        elements: [{
            id: "barcode",
            type: "barcode",
            value: "{{codigo}}",
            x: 1,
            y: 1,
            width: 30,
            height: 10,
            barcodeOptions: {fontSize: 20, textMargin: 2}
        }]
    });

    assert.equal(layout.elements[0].humanReadableFontSize, 15);
    assert.ok(Math.abs(
        layout.elements[0].textMargin - 0.5291666666
    ) < 1e-9);
});
