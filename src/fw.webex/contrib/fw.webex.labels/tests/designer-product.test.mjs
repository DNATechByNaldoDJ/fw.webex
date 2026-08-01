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

assert.ok(designer, "designer runtime was not found");

test("WebExLabelDesigner is a configured, self-contained FWWebEx product", () => {
    assert.match(source, /class WebExLabelDesigner from WebExDiv/);
    assert.match(source, /WebExFeatureLabels\(\):Enable\(\)/);
    assert.match(
        source,
        /jObjectsContainer\["script-fwwebex-labels-runtime"\]/
    );
    assert.match(source, /public method SetLayout\(xLayout as variant\)/);
    assert.match(source, /public method SetRecords\(xRecords as variant\)/);
    assert.match(source, /public method SetOptions\(xOptions as variant\)/);

    for (const role of [
        "toolbar", "layers", "stage", "background", "fields", "inspector",
        "contract-editor", "records-editor", "problems", "status"
    ]) {
        assert.match(
            designer,
            new RegExp(`data-role=["']${role}["']`),
            `designer must own its ${role} region`
        );
    }
});

test("designer exposes product workflows without duplicating PDF rules", () => {
    const methods = {
        setRecords: "setRecords",
        setOptions: "setOptions",
        validate: "validateProduct",
        preview: "previewProduct",
        download: "downloadProduct",
        print: "printProduct",
        undo: "undo",
        redo: "redo",
        discoverVariables: "discoverVariables"
    };
    for (const [name, implementation] of Object.entries(methods)) {
        assert.match(
            designer,
            new RegExp(`${name}:${implementation}`),
            `designer API must expose ${name}`
        );
    }
    assert.match(designer, /window\.FWWebExLabels\.renderer/);
    assert.doesNotMatch(designer, /new\s+(?:window\.)?jspdf/i);
    assert.doesNotMatch(designer, /\bJsBarcode\s*\(/);
});

test("component CSS is registered by Labels and is not page-grid CSS", () => {
    assert.match(source, /style-fwwebex-labels/);
    assert.match(source, /\.fwwebex-label-designer/);
    assert.match(source, /\.fwwebex-label-workspace\{/);
    assert.match(source, /\.fwwebex-label-field\{/);
    assert.doesNotMatch(
        source.match(/beginContent var cStyle([\s\S]*?)endContent/)?.[1] || "",
        /\.fwwebex-label-designer\s*\{[^}]*grid-area\s*:/s
    );
});

test("designer supports multi-instance-safe root-scoped controls", () => {
    assert.match(designer, /root\.querySelector\("\[data-role=/);
    assert.match(designer, /FWWebExLabels\.designer\.get/);
    assert.match(designer, /FWWebExLabels\.designer\.destroy/);
    assert.doesNotMatch(designer, /getElementById\(["']label-/);
    assert.doesNotMatch(
        source,
        /oGeneratorScript:SetFixedID\("script-fwwebex-labels-runtime"\)/
    );
    assert.match(source, /protected data oFacadeScript as object/);
});

test("designer exposes compact page, editor and background settings", () => {
    for (const role of [
        "page-width", "page-height", "page-rotation",
        "page-margin-top", "page-margin-right", "page-margin-bottom",
        "page-margin-left", "page-safe-area", "page-bleed",
        "grid-step", "snap-tolerance", "background-locked", "layer-search"
    ]) {
        assert.match(
            designer,
            new RegExp(`data-role=["']${role}["']`),
            `designer must expose ${role}`
        );
    }
    assert.match(designer, /<details[^>]+fwwebex-label-page-settings/);
    assert.match(designer, /function setPage\(settings,height,rotation\)/);
    assert.match(designer, /target\.margins=normalizeInsets\(marginSource,0\)/);
    assert.match(designer, /data-action="lock-reference"/);
    assert.match(designer, /visibleIds\.add\(current\.id\)/);
});
