import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import vm from "node:vm";

const panelPath = resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.label.generator.panel.tlpp"
);
const source = await readFile(panelPath, "utf8");
const scripts = [...source.matchAll(
    /beginContent var cScript\s*([\s\S]*?)\s*endContent/g
)].map((match) => match[1]);
const panelSource = scripts.find((script) =>
    script.includes("root.__labelGeneratorPanel=api")
);

assert.ok(panelSource, "embedded generator panel runtime was not found");

function executableSource(id, {
    layout = '{"schema":"fwwebex.labels","version":2}',
    records = "[{}]",
    fileName = "labels.pdf",
    options = "{}"
} = {}) {
    return panelSource
        .replaceAll("__ID__", id)
        .replaceAll("__LAYOUT__", layout)
        .replaceAll("__RECORDS__", records)
        .replaceAll("__FILE_NAME__", fileName)
        .replaceAll("__OPTIONS__", options);
}

class FakeNode {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.dataset = {};
        this.listeners = new Map();
        this.attributes = new Map();
        this.className = "";
        this.textContent = "";
        this.value = "";
        this.hidden = false;
        this.disabled = false;
        this.parentElement = null;
        this.events = [];
        this.clicked = false;
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    remove() {
        if (!this.parentElement) return;
        const index = this.parentElement.children.indexOf(this);
        if (index >= 0) this.parentElement.children.splice(index, 1);
        this.parentElement = null;
    }

    click() {
        this.clicked = true;
        const listener = this.listeners.get("click");
        if (listener) listener({currentTarget: this, target: this});
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }

    dispatchEvent(event) {
        this.events.push(event);
        const listener = this.listeners.get(event.type);
        if (listener) listener({currentTarget: this, target: this, ...event});
        return true;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    set innerHTML(value) {
        if (value === "") this.children = [];
    }

    get innerHTML() {
        return "";
    }
}

function createPanelRoot() {
    const root = new FakeNode("div");
    const roles = {
        layout: new FakeNode("textarea"),
        records: new FakeNode("textarea"),
        "file-name": new FakeNode("input"),
        rotation: new FakeNode("select"),
        report: new FakeNode("section"),
        status: new FakeNode("p"),
        issues: new FakeNode("ol"),
        "empty-issues": new FakeNode("p")
    };
    roles.rotation.value = "0";
    const buttons = ["validate", "preview", "download", "print"].map((action) => {
        const button = new FakeNode("button");
        button.dataset.action = action;
        return button;
    });
    root.querySelector = (selector) => {
        const match = /^\[data-role="([^"]+)"\]$/.exec(selector);
        return match ? roles[match[1]] || null : null;
    };
    root.querySelectorAll = (selector) =>
        selector === "[data-action]" ? buttons : [];
    return {root, roles, buttons};
}

function createHarness() {
    const panels = {
        panelA: createPanelRoot(),
        panelB: createPanelRoot()
    };
    const calls = [];
    const openedWindows = [];
    const downloads = [];
    let urlIndex = 0;
    const body = new FakeNode("body");
    body.appendChild = (child) => {
        downloads.push(child);
        child.parentElement = body;
        body.children.push(child);
        return child;
    };
    const context = {
        console,
        CustomEvent: class {
            constructor(type, options) {
                this.type = type;
                this.detail = options && options.detail;
            }
        },
        URL: {
            createObjectURL: () => "blob:test-"+(++urlIndex),
            revokeObjectURL: () => {}
        },
        document: {
            body,
            createElement: (tagName) => new FakeNode(tagName),
            getElementById: (id) => panels[id] && panels[id].root
        },
        window: {
            FWWebExLabels: {
                renderer: {
                    generate: async (layout, records, options) => {
                        calls.push({layout, records, options});
                        return {
                            output: {kind: "blob", call: calls.length},
                            layout,
                            report: {
                                valid: true,
                                issues: [],
                                errors: [],
                                warnings: [],
                                metrics: {records: []}
                            }
                        };
                    }
                }
            },
            open: () => {
                const target = {
                    closed: false,
                    close() { this.closed = true; },
                    location: {
                        value: "",
                        replace(value) { this.value = value; }
                    }
                };
                openedWindows.push(target);
                return target;
            },
            setTimeout: (callback) => {
                callback();
                return 1;
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(executableSource("panelA", {
        layout: '{"schema":"fwwebex.labels","version":2,"name":"A"}',
        records: '[{"produto":"A"}]',
        fileName: "a.pdf"
    }), context);
    vm.runInContext(executableSource("panelB", {
        layout: '{"schema":"fwwebex.labels","version":2,"name":"B"}',
        records: '[{"produto":"B"}]',
        fileName: "b.pdf"
    }), context);
    return {
        panels,
        calls,
        openedWindows,
        downloads,
        context,
        apiA: panels.panelA.root.__labelGeneratorPanel,
        apiB: panels.panelB.root.__labelGeneratorPanel
    };
}

test("TLPP component is self-contained and exposes server-side configuration", () => {
    assert.match(source,
        /class WebExLabelGeneratorPanel from WebExDiv/);
    assert.match(source,
        /WebExFeatureLabels\(\):Enable\(\)/);
    assert.doesNotMatch(source,
        /::oHeadlessGenerator:=WebExLabelPDFGenerator\(\):New\(\)/);
    assert.match(source,
        /public method SetLayout\(xLayout as variant\)/);
    assert.match(source,
        /public method SetRecords\(xRecords as variant\)/);
    assert.match(source,
        /public method SetFileName\(cFileName as character\)/);
    assert.match(source,
        /public method SetOptions\(xOptions as variant\)/);
    assert.match(source, /data-role="layout"/);
    assert.match(source, /data-role="records"/);
    assert.match(source, /data-role="rotation"/);
    assert.match(source, /data-role="issues"/);
});

test("panel delegates every operation to the canonical Labels renderer", async () => {
    const {apiA, calls, openedWindows, downloads} = createHarness();
    apiA.setOptions({compress: false, rotation: 90});

    await apiA.validate();
    await apiA.preview();
    await apiA.download();
    await apiA.print();

    assert.equal(calls.length, 4);
    assert.deepEqual(calls.map((call) => call.options.output),
        ["none", "blob", "blob", "blob"]);
    assert.deepEqual(calls.map((call) => call.options.autoPrint),
        [false, false, false, true]);
    assert.ok(calls.every((call) => call.options.returnResult === true));
    assert.ok(calls.every((call) => call.options.rotation === 90));
    assert.ok(calls.every((call) => call.options.fileName === "a.pdf"));
    assert.ok(calls.every((call) => call.options.compress === false));
    assert.equal(openedWindows.length, 2);
    assert.match(openedWindows[0].location.value, /^blob:test-/);
    assert.match(openedWindows[1].location.value, /^blob:test-/);
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].download, "a.pdf");

    assert.doesNotMatch(panelSource, /new\s+(?:window\.)?jspdf/i);
    assert.doesNotMatch(panelSource, /\bJsBarcode\s*\(/);
    assert.equal(
        (panelSource.match(/pipeline\(\)\.generate\(/g) || []).length,
        1,
        "the panel must have one renderer delegation point"
    );
});

test("two panels keep values, reports and events isolated", async () => {
    const {apiA, apiB, panels, calls} = createHarness();
    apiA.load({
        layout: {schema: "fwwebex.labels", version: 2, name: "changed-A"},
        records: [{produto: "changed-A"}],
        fileName: "changed-A",
        rotation: 180
    });

    assert.equal(apiA.getLayout().name, "changed-A");
    assert.equal(apiB.getLayout().name, "B");
    assert.equal(apiA.getRecords()[0].produto, "changed-A");
    assert.equal(apiB.getRecords()[0].produto, "B");
    assert.equal(panels.panelA.roles["file-name"].value, "changed-A.pdf");
    assert.equal(panels.panelB.roles["file-name"].value, "b.pdf");

    await apiA.validate();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].layout.name, "changed-A");
    assert.ok(apiA.getState().lastReport);
    assert.equal(apiB.getState().lastReport, null);
    assert.equal(panels.panelA.root.events.length, 1);
    assert.equal(panels.panelB.root.events.length, 0);
});

test("invalid editor JSON produces a structured local issue", async () => {
    const {apiA, panels, calls} = createHarness();
    apiA.setLayout("{invalid");

    const result = await apiA.validate();
    const report = apiA.getState().lastReport;

    assert.equal(result, null);
    assert.equal(calls.length, 0);
    assert.equal(report.valid, false);
    assert.equal(report.issues[0].code, "JSON_INPUT_INVALID");
    assert.equal(report.issues[0].path, "/layout");
    assert.equal(report.issues[0].phase, "input");
    assert.equal(panels.panelA.roles.report.dataset.state, "error");
    assert.equal(panels.panelA.roles.issues.children.length, 1);
});

test("layout and record changes invalidate the previous report and result", async () => {
    const {apiA, panels} = createHarness();
    const {roles} = panels.panelA;

    await apiA.validate();
    assert.ok(apiA.getState().lastResult);
    assert.ok(apiA.getState().lastReport);

    apiA.setLayout({schema: "fwwebex.labels", version: 2, name: "new-layout"});
    assert.equal(apiA.getState().lastResult, null);
    assert.equal(apiA.getState().lastReport, null);
    assert.equal(roles.report.dataset.state, "idle");
    assert.match(roles.status.textContent, /Layout alterado/);
    assert.equal(roles.issues.children.length, 0);
    assert.equal(roles["empty-issues"].hidden, false);

    await apiA.validate();
    apiA.setRecords([{produto: "new-data"}]);
    assert.equal(apiA.getState().lastResult, null);
    assert.equal(apiA.getState().lastReport, null);
    assert.equal(roles.report.dataset.state, "idle");
    assert.match(roles.status.textContent, /Dados alterados/);

    await apiA.validate();
    roles.layout.value = '{"schema":"fwwebex.labels","version":2,"name":"typed"}';
    roles.layout.dispatchEvent({type: "input"});
    assert.equal(apiA.getState().lastResult, null);
    assert.equal(apiA.getState().lastReport, null);
    assert.match(roles.status.textContent, /Layout alterado/);

    await apiA.validate();
    roles.records.value = '[{"produto":"typed"}]';
    roles.records.dispatchEvent({type: "input"});
    assert.equal(apiA.getState().lastResult, null);
    assert.equal(apiA.getState().lastReport, null);
    assert.match(roles.status.textContent, /Dados alterados/);
});

test("effective option and rotation changes invalidate exactly once", async () => {
    const {apiA, panels, calls} = createHarness();
    const {roles} = panels.panelA;

    await apiA.validate();
    const initialState = apiA.getState();

    apiA.setOptions({rotation: 0});
    assert.equal(apiA.getState().inputRevision, initialState.inputRevision,
        "an equivalent rotation supplied through options has no effect");
    assert.equal(apiA.getState().lastReport, initialState.lastReport);

    apiA.setOptions({compress: false, rotation: 0});
    const changedState = apiA.getState();
    assert.equal(changedState.inputRevision, initialState.inputRevision + 1);
    assert.equal(changedState.lastResult, null);
    assert.equal(changedState.lastReport, null);
    assert.match(roles.status.textContent, /Op[cç][oõ]es alteradas/);

    await apiA.validate();
    const validatedState = apiA.getState();
    apiA.setOptions({rotation: "0", compress: false});
    assert.equal(apiA.getState().inputRevision, validatedState.inputRevision,
        "property order and equivalent rotation types are semantically equal");
    assert.equal(apiA.getState().lastReport, validatedState.lastReport);

    roles.rotation.dispatchEvent({type: "change"});
    assert.equal(apiA.getState().inputRevision, validatedState.inputRevision,
        "a change event without a new selector value is ignored");
    assert.equal(apiA.getState().lastReport, validatedState.lastReport);

    roles.rotation.value = "90";
    roles.rotation.dispatchEvent({type: "change"});
    const rotatedState = apiA.getState();
    assert.equal(rotatedState.inputRevision, validatedState.inputRevision + 1);
    assert.equal(rotatedState.lastResult, null);
    assert.equal(rotatedState.lastReport, null);
    assert.match(roles.status.textContent, /Rota[cç][aã]o alterada/);

    await apiA.validate();
    assert.equal(calls.at(-1).options.rotation, 90);
});

test("older generations cannot beat a newer option revision", async () => {
    const {apiA, panels, context} = createHarness();
    const pendingGenerations = [];
    const successfulResult = (tag) => ({
        tag,
        output: null,
        report: {
            valid: true,
            issues: [],
            errors: [],
            warnings: [],
            metrics: {}
        }
    });
    context.window.FWWebExLabels.renderer.generate = () =>
        new Promise((resolveGeneration) => {
            pendingGenerations.push(resolveGeneration);
        });

    const older = apiA.validate();
    apiA.setOptions({compress: false});
    const newer = apiA.validate();

    pendingGenerations[0](successfulResult("older"));
    assert.equal(await older, null);
    assert.equal(apiA.getState().busy, true,
        "an obsolete completion must not clear a newer busy operation");

    pendingGenerations[1](successfulResult("newer"));
    assert.equal((await newer).tag, "newer");
    assert.equal(apiA.getState().lastResult.tag, "newer");
    assert.equal(apiA.getState().busy, false);

    const beforeRotation = apiA.validate();
    panels.panelA.roles.rotation.value = "180";
    panels.panelA.roles.rotation.dispatchEvent({type: "change"});
    pendingGenerations[2](successfulResult("before-rotation"));

    assert.equal(await beforeRotation, null);
    assert.equal(apiA.getState().lastResult, null);
    assert.equal(apiA.getState().lastReport, null);
    assert.match(panels.panelA.roles.status.textContent, /Rota[cç][aã]o alterada/);
});

test("an in-flight generation cannot restore a report after inputs change", async () => {
    const {apiA, panels, context} = createHarness();
    let finishGeneration;
    context.window.FWWebExLabels.renderer.generate = () =>
        new Promise((resolveGeneration) => {
            finishGeneration = resolveGeneration;
        });

    const pending = apiA.validate();
    apiA.setRecords([{produto: "changed-while-validating"}]);
    finishGeneration({
        output: null,
        report: {
            valid: true,
            issues: [],
            errors: [],
            warnings: [],
            metrics: {}
        }
    });

    assert.equal(await pending, null);
    assert.equal(apiA.getState().lastResult, null);
    assert.equal(apiA.getState().lastReport, null);
    assert.equal(panels.panelA.roles.report.dataset.state, "idle");
    assert.match(panels.panelA.roles.status.textContent, /Dados alterados/);
});
