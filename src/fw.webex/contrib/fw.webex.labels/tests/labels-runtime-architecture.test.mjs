import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import vm from "node:vm";

const labelsPath = resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.labels.tlpp"
);
const panelPath = resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.label.generator.panel.tlpp"
);
const [labelsSource, panelSource] = await Promise.all([
    readFile(labelsPath, "utf8"),
    readFile(panelPath, "utf8")
]);

function contentBlocks(source) {
    return [...source.matchAll(
        /beginContent var (\w+)\s*([\s\S]*?)\s*endContent/g
    )].map((match) => ({
        name: match[1],
        source: match[2]
    }));
}

function methodSource(source, signature, nextSignature) {
    const start = source.indexOf(signature);
    assert.notEqual(start, -1, `method not found: ${signature}`);
    const end = nextSignature ? source.indexOf(nextSignature, start + 1) : -1;
    return source.slice(start, end < 0 ? source.length : end);
}

const labelBlocks = contentBlocks(labelsSource);
const panelBlocks = contentBlocks(panelSource);
const featureLoad = methodSource(
    labelsSource,
    "method Load(oControl) class WebExFeatureLabels",
    "method New(nLabelWidth,nLabelHeight) class WebExLabelDesigner"
);
const canonicalRuntime = labelBlocks.find(({source}) =>
    source.includes('const SCHEMA="fwwebex.labels"') &&
    source.includes("function normalizeLayout")
);
const rootFacade = labelBlocks
    .filter(({source}) =>
        source.includes('document.getElementById("__ID__")') &&
        source.includes("root.__labelPDF") &&
        !source.includes("function normalizeLayout")
    )
    .sort((left, right) => left.source.length - right.source.length)[0];

assert.ok(canonicalRuntime, "canonical Labels runtime was not found");
assert.ok(rootFacade, "short root facade was not found");

test("generator panel CSS is owned by the singleton Labels feature", () => {
    assert.equal(
        (featureLoad.match(
            /jObjectsContainer\["style-fwwebex-labels"\]/g
        ) || []).length,
        1,
        "Labels must register its component stylesheet exactly once"
    );
    for (const selector of [
        ".fwwebex-label-generator-panel",
        ".fwwebex-label-generator-shell",
        ".fwwebex-label-generator-report",
        ".fwwebex-label-generator-severity"
    ]) {
        assert.ok(
            featureLoad.includes(selector),
            `singleton Labels CSS must own ${selector}`
        );
    }

    assert.doesNotMatch(
        panelSource,
        /protected data oPanelStyle|WebExStyle\(\):New\(\)|beginContent var cStyle/,
        "each panel instance must not create another stylesheet"
    );
    assert.doesNotMatch(
        panelSource,
        /SetFixedID\("style-fwwebex-label-generator-panel"\)/,
        "a per-instance fixed style ID would duplicate DOM IDs"
    );
});

test("the large canonical Labels runtime has one global stable registration", () => {
    assert.ok(
        canonicalRuntime.source.length > 50_000,
        "the test must be guarding the canonical runtime, not a facade"
    );
    assert.doesNotMatch(
        canonicalRuntime.source,
        /document\.getElementById\("__ID__"\)|__ID__/,
        "the shared runtime must not be tied to a component root"
    );
    assert.equal(
        (featureLoad.match(
            /jObjectsContainer\["script-fwwebex-labels-runtime"\]/g
        ) || []).length,
        1,
        "the Labels feature must register the canonical runtime once"
    );
    assert.doesNotMatch(
        labelsSource,
        /oGeneratorScript:SetFixedID\("script-fwwebex-labels-runtime"\)/,
        "generator instances must not emit the shared fixed script ID"
    );
});

test("the per-root PDF facade stays short and domain-rule free", () => {
    assert.ok(
        rootFacade.source.length < 3_000,
        `root facade grew to ${rootFacade.source.length} characters`
    );
    assert.match(rootFacade.source, /document\.getElementById\("__ID__"\)/);
    assert.match(rootFacade.source, /window\.FWWebExLabels/);
    assert.match(rootFacade.source, /root\.__labelPDF/);
    assert.doesNotMatch(
        rootFacade.source,
        /const SCHEMA|function normalizeLayout|function validateContract|JsBarcode|jspdf/i
    );
});

test("designer and generator panel publish get/create/destroy factories", () => {
    const products = [
        {name: "designer", source: labelsSource, rootSlot: "__labelDesigner"},
        {
            name: "generatorPanel",
            source: panelSource,
            rootSlot: "__labelGeneratorPanel"
        }
    ];
    for (const product of products) {
        for (const operation of ["get", "create", "destroy"]) {
            assert.match(
                product.source,
                new RegExp(
                    `FWWebExLabels\\.${product.name}\\.${operation}=function`
                ),
                `${product.name} must publish ${operation}()`
            );
        }
        assert.match(
            product.source,
            new RegExp(`root\\.${product.rootSlot}=null`),
            `${product.name}.destroy() must release its root instance`
        );
        assert.match(
            product.source,
            /destroy:function\(\)\{[\s\S]*?removeListeners\(\)/,
            `${product.name}.destroy() must remove its DOM listeners`
        );
    }
});

test("one shared runtime can back two isolated root facades", async () => {
    const roots = new Map([
        ["labels-root-a", {}],
        ["labels-root-b", {}]
    ]);
    const normalize = (layout) => ({...layout, normalized: true});
    const serialize = (layout) => ({...layout, serialized: true});
    const validate = () => ({valid: true});
    const generate = async () => ({report: {valid: true}});
    const resolveLayout = (layout) => ({layout});
    const layout = {resolve: resolveLayout};
    const window = {
        FWWebExLabels: {
            contract: {normalize, serialize, validate},
            renderer: {generate},
            layout
        }
    };
    const context = vm.createContext({
        Error,
        Promise,
        document: {
            getElementById(id) {
                return roots.get(id) || null;
            }
        },
        window
    });

    for (const id of roots.keys()) {
        vm.runInContext(
            rootFacade.source.replaceAll("__ID__", id),
            context
        );
    }
    await Promise.resolve();

    const first = roots.get("labels-root-a").__labelPDF;
    const second = roots.get("labels-root-b").__labelPDF;
    assert.ok(first);
    assert.ok(second);
    assert.notEqual(first, second, "each root needs its own facade object");
    assert.equal(first.generate, generate);
    assert.equal(second.generate, generate);
    assert.equal(first.normalize, normalize);
    assert.equal(second.normalize, normalize);
    assert.equal(first.layout, layout);
    assert.equal(second.layout, layout);

    first.localState = "only-a";
    assert.equal(second.localState, undefined);
});

test("panel runtime remains root-scoped and has no fixed control IDs", () => {
    const runtime = panelBlocks.find(({source}) =>
        source.includes("root.__labelGeneratorPanel=api")
    );
    assert.ok(runtime, "generator panel runtime was not found");
    assert.match(runtime.source, /root\.querySelector\(/);
    assert.doesNotMatch(runtime.source, /getElementById\(["']label-/);
    assert.doesNotMatch(
        panelSource,
        /SetFixedID\("(?:label-pdf-|label-generator-(?:layout|records|status))/
    );
});
