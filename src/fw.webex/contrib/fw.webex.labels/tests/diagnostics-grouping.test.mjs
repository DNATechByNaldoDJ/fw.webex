import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import vm from "node:vm";

const labelsSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.labels.tlpp"
), "utf8");

const runtimeSource = [...labelsSource.matchAll(
    /beginContent var \w+\s*([\s\S]*?)\s*endContent/g
)].map((match) => match[1]).find((source) =>
    source.includes("function normalizeLayout") &&
    source.includes("window.FWWebExLabels.renderer.generate=generate")
);

assert.ok(runtimeSource, "embedded Labels runtime was not found");

const context = {console, document: {}, window: {}};
vm.runInNewContext(runtimeSource, context);
const diagnostics = context.window.FWWebExLabels.diagnostics;

test("diagnostics summarize repeated records without hiding occurrences", () => {
    const issues = Array.from({length: 100}, (_, recordIndex) => ({
        code: "TEXT_OVERFLOW",
        severity: "error",
        path: "/elements/0/fit/overflow",
        elementId: "produto",
        recordIndex,
        phase: "renderer",
        message: "Texto nao cabe.",
        suggestion: "Aumente a caixa.",
        details: {requiredWidth: 30 + recordIndex}
    }));

    const groups = diagnostics.summarize(issues);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].occurrenceCount, 100);
    assert.equal(groups[0].affectedRecordCount, 100);
    assert.equal(groups[0].occurrences.length, 100);
    assert.equal(groups[0].occurrences[99].details.requiredWidth, 129);
});

test("record validation paths are grouped across array indexes", () => {
    const issues = [0, 1].map((recordIndex) => ({
        code: "DATA_RECORD_INVALID",
        severity: "error",
        path: `/${recordIndex}`,
        recordIndex,
        phase: "data",
        message: "O registro deve ser um objeto.",
        suggestion: "Informe um objeto JSON para cada registro."
    }));

    const groups = diagnostics.summarize(issues);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].occurrenceCount, 2);
    assert.equal(groups[0].affectedRecordCount, 2);
    assert.deepEqual(Array.from(groups[0].records), [0, 1]);
    assert.deepEqual(Array.from(groups[0].paths), ["/0", "/1"]);
});

test("diagnostics keep elements, severities and physical causes separate", () => {
    const groups = diagnostics.summarize([
        {code: "TEXT_OVERFLOW", severity: "error", elementId: "a", message: "x"},
        {code: "TEXT_OVERFLOW", severity: "error", elementId: "b", message: "x"},
        {code: "TEXT_OVERFLOW", severity: "warning", elementId: "a", message: "x"},
        {code: "BARCODE_MODULE_TOO_NARROW", severity: "error", elementId: "a", message: "x"}
    ]);

    assert.equal(groups.length, 4);
});

test("exact deduplication preserves different measurements and unsafe separators", () => {
    const base = {
        code: "TEXT_OVERFLOW",
        severity: "error",
        path: "/elements/0/fit/overflow",
        elementId: "produto",
        recordIndex: 0,
        phase: "renderer",
        message: "valor | ainda seguro",
        suggestion: "Aumente a caixa."
    };
    const first = {...base, details: {requiredWidth: 31, nested: {b: 2, a: 1}}};
    const reorderedClone = {
        ...base,
        details: {nested: {a: 1, b: 2}, requiredWidth: 31}
    };
    const distinct = {...base, details: {requiredWidth: 32}};

    const result = diagnostics.deduplicate([first, reorderedClone, distinct]);
    assert.equal(result.length, 2);
    assert.equal(result[0].details.requiredWidth, 31);
    assert.equal(result[1].details.requiredWidth, 32);
});
