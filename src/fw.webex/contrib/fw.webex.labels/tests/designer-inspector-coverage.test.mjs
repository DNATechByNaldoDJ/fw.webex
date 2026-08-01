import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";

const source = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.labels.tlpp"
), "utf8");

const scripts = [...source.matchAll(
    /beginContent var cScript\s*([\s\S]*?)\s*endContent/g
)].map((match) => match[1]);

const designer = scripts.find((script) =>
    script.includes("root.__labelDesigner={addText:function")
);

assert.ok(designer, "embedded Labels designer runtime was not found");

const inspectorStart = designer.indexOf(
    '<aside class="fwwebex-label-pane fwwebex-label-inspector">'
);
const inspectorEnd = designer.indexOf("</aside>", inspectorStart);

assert.notEqual(inspectorStart, -1, "designer inspector markup was not found");
assert.notEqual(inspectorEnd, -1, "designer inspector markup is incomplete");

const inspector = designer.slice(inspectorStart, inspectorEnd + "</aside>".length);

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function controlPattern(property, tag = "(?:input|select|textarea)") {
    return new RegExp(
        `<${tag}\\b[^>]*\\bdata-property=["']${escapeRegExp(property)}["'][^>]*>`,
        "i"
    );
}

function expectControl(property, tag) {
    assert.match(
        inspector,
        controlPattern(property, tag),
        `inspector must expose a control for ${property}`
    );
}

function functionBody(name, nextName) {
    const start = designer.indexOf(`function ${name}(`);
    const end = designer.indexOf(`function ${nextName}(`, start + 1);
    assert.notEqual(start, -1, `${name} was not found`);
    assert.notEqual(end, -1, `${name} body boundary was not found`);
    return designer.slice(start, end);
}

test("inspector exposes complete common placement and membership controls", () => {
    for (const property of [
        "zIndex",
        "containerId",
        "style.margin.top",
        "style.margin.right",
        "style.margin.bottom",
        "style.margin.left"
    ]) {
        expectControl(property);
    }
});

test("text inspector exposes the complete configurable typography subset", () => {
    for (const property of [
        "style.fontFamily",
        "style.color",
        "style.lineHeightFactor",
        "style.letterSpacing"
    ]) {
        expectControl(property);
    }
});

test("barcode inspector exposes human-readable, fitting and overflow controls", () => {
    for (const property of [
        "humanReadableFontSize",
        "humanReadableMinFontSize",
        "humanReadableFontFamily",
        "humanReadableFontStyle",
        "humanReadableColor",
        "humanReadablePosition",
        "humanReadableAlign",
        "autoFit",
        "textOverflow"
    ]) {
        expectControl(property);
    }

    for (const property of ["autoFit"]) {
        assert.match(
            inspector,
            new RegExp(
                `<(?:input|select)\\b[^>]*data-property=["']${property}["'][^>]*` +
                `data-value-type=["']boolean["'][^>]*>|` +
                `<(?:input|select)\\b[^>]*data-value-type=["']boolean["'][^>]*` +
                `data-property=["']${property}["'][^>]*>`,
                "i"
            ),
            `${property} must round-trip as a boolean`
        );
    }
});

test("container inspector exposes independent padding and clipping controls", () => {
    for (const property of [
        "layout.padding.top",
        "layout.padding.right",
        "layout.padding.bottom",
        "layout.padding.left",
        "layout.clipChildren"
    ]) {
        expectControl(property);
    }

    assert.match(
        inspector,
        /<(?:input|select)\b[^>]*data-property=["']layout\.clipChildren["'][^>]*data-value-type=["']boolean["'][^>]*>|<(?:input|select)\b[^>]*data-value-type=["']boolean["'][^>]*data-property=["']layout\.clipChildren["'][^>]*>/i,
        "layout.clipChildren must round-trip as a boolean"
    );
});

test("inspector provides advanced JSON editors with parse and render support", () => {
    expectControl("textOptions", "textarea");
    expectControl("barcodeOptions", "textarea");

    for (const property of ["textOptions", "barcodeOptions"]) {
        assert.match(
            inspector,
            new RegExp(
                `<textarea\\b[^>]*data-property=["']${property}["'][^>]*` +
                `data-value-type=["']json["'][^>]*>|` +
                `<textarea\\b[^>]*data-value-type=["']json["'][^>]*` +
                `data-property=["']${property}["'][^>]*>`,
                "i"
            ),
            `${property} must be declared as a JSON editor`
        );
    }

    const renderInspector = functionBody("renderInspector", "renderRulers");
    const applyInspector = functionBody("applyInspector", "handleAction");

    assert.match(
        renderInspector,
        /dataset\.valueType\s*===\s*["']json["'][\s\S]*?JSON\.stringify/,
        "renderInspector must serialize object values for JSON editors"
    );
    assert.match(
        applyInspector,
        /dataset\.valueType\s*===\s*["']json["'][\s\S]*?JSON\.parse/,
        "applyInspector must parse JSON editor values before updating an element"
    );
});
