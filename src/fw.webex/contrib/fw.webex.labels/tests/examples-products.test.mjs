import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";

const example031 = await readFile(resolve(
    "src/fw.webex/tests/fw.webex.examples/031/fw.webex.example.031.tlpp"
), "utf8");
const example032 = await readFile(resolve(
    "src/fw.webex/tests/fw.webex.examples/032/fw.webex.example.032.tlpp"
), "utf8");

function jsonBlock(source, name) {
    const match = new RegExp(
        `beginContent var c${name}\\s*([\\s\\S]*?)\\s*endContent`
    ).exec(source);
    assert.ok(match, `${name} block must exist`);
    return JSON.parse(match[1]);
}

test("example 031 only configures the reusable designer product", () => {
    assert.match(example031, /CLASS WebExLabelDesigner ARGS 100,60/);
    assert.match(example031, /\.:SetLayout\(cLayoutJSON\)/);
    assert.match(example031, /\.:SetRecords\(cRecordsJSON\)/);
    assert.match(example031, /\.:SetOptions\(cOptionsJSON\)/);
    assert.doesNotMatch(example031, /AddPageStyle/);
    assert.doesNotMatch(example031, /\.fwwebex-label-/);
    assert.doesNotMatch(example031, /beginContent var cScript/);
    assert.doesNotMatch(example031, /FWWebExExample031[A-Z]/);
});

test("example 032 only configures the reusable generator panel", () => {
    assert.match(example032, /CLASS WebExLabelGeneratorPanel/);
    assert.match(example032, /\.:SetLayout\(cLayoutJSON\)/);
    assert.match(example032, /\.:SetRecords\(cRecordsJSON\)/);
    assert.match(example032, /\.:SetFileName\(/);
    assert.match(example032, /\.:SetOptions\(/);
    assert.doesNotMatch(example032, /AddPageStyle/);
    assert.doesNotMatch(example032, /\.fwwebex-label-/);
    assert.doesNotMatch(example032, /beginContent var cScript/);
    assert.doesNotMatch(example032, /FWWebExExample032[A-Z]/);
});

test("examples demonstrate the exact same layout and records", () => {
    assert.deepEqual(
        jsonBlock(example032, "LayoutJSON"),
        jsonBlock(example031, "LayoutJSON")
    );
    assert.deepEqual(
        jsonBlock(example032, "RecordsJSON"),
        jsonBlock(example031, "RecordsJSON")
    );
});
