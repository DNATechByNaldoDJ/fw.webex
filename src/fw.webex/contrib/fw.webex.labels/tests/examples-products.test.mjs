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
    const layout031 = jsonBlock(example031, "LayoutJSON");
    const layout032 = jsonBlock(example032, "LayoutJSON");
    assert.deepEqual(layout032, layout031);
    assert.deepEqual(Object.keys(layout032), Object.keys(layout031));
    assert.equal(Object.keys(layout031).at(-1), "background");
    assert.deepEqual(
        jsonBlock(example032, "RecordsJSON"),
        jsonBlock(example031, "RecordsJSON")
    );
});

test("designer example opens Components and leaves safe resize headroom", () => {
    const layout = jsonBlock(example031, "LayoutJSON");
    const options = jsonBlock(example031, "OptionsJSON");
    const byId = new Map(layout.elements.map((item) => [item.id, item]));

    assert.equal(options.tabs.sidebar, "add");
    assert.equal(options.autoValidate, true);
    for (const containerId of ["area-dados", "area-barcode"]) {
        const container = byId.get(containerId);
        const children = container.layout.children.map((id) => byId.get(id));
        const usefulHeight = container.box.height -
            container.layout.padding.top - container.layout.padding.bottom;
        const contentHeight = children.reduce(
            (total, child) => total + child.basisBox.height,
            0
        ) + Math.max(0, children.length - 1) * container.layout.gap;

        assert.equal(container.layout.sizing, "shrink");
        assert.ok(
            usefulHeight - contentHeight >= 4,
            `${containerId} must leave at least 4 mm of resize headroom`
        );
        for (const child of children) {
            assert.equal(child.box.width, child.basisBox.width);
            assert.equal(child.box.height, child.basisBox.height);
        }
    }
});
