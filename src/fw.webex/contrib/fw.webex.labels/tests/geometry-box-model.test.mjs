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

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function closeTo(actual, expected, message) {
    assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `${message}: expected ${expected}, received ${actual}`
    );
}

function loadRuntime() {
    const context = vm.createContext({
        console,
        document: {
            getElementById: () => ({}),
            createElement: () => ({})
        },
        window: {}
    });
    vm.runInContext(generatorSource, context);
    return context.window.FWWebExLabels;
}

function baseLayout(elements, page = {width: 100, height: 60}) {
    return {
        schema: "fwwebex.labels",
        version: 2,
        name: "geometry-box-model",
        unit: "mm",
        page: {
            width: page.width,
            height: page.height,
            rotation: 0,
            margins: 0,
            safeArea: 0,
            bleed: 0
        },
        background: null,
        editor: {},
        variables: [],
        barcodeAutoRules: [],
        barcodeFallbackFormat: "CODE128",
        elements
    };
}

function textElement(id, box, overrides = {}) {
    const style = overrides.style || {};
    return {
        id,
        name: id,
        type: "text",
        template: overrides.template ?? id,
        box,
        basisBox: overrides.basisBox || {
            width: box.width,
            height: box.height
        },
        rotation: 0,
        zIndex: 1,
        locked: false,
        hidden: false,
        containerId: overrides.containerId ?? null,
        style: {
            fontFamily: "helvetica",
            fontSize: style.fontSize ?? 10,
            minFontSize: style.minFontSize ?? 3,
            fontStyle: "normal",
            color: "#000000",
            lineHeightFactor: style.lineHeightFactor ?? 1,
            letterSpacing: 0,
            align: "left",
            verticalAlign: "top",
            padding: style.padding ?? 0,
            margin: style.margin ?? 0
        },
        fit: {mode: "shrink", maxLines: 1, overflow: "error"},
        textOptions: {}
    };
}

function containerElement(id, box, children, overrides = {}) {
    return {
        id,
        name: id,
        type: "container",
        template: "",
        box,
        basisBox: overrides.basisBox || {
            width: box.width,
            height: box.height
        },
        rotation: 0,
        zIndex: 0,
        locked: false,
        hidden: false,
        containerId: overrides.containerId ?? null,
        layout: {
            direction: overrides.direction || "vertical",
            padding: overrides.padding ?? 0,
            gap: overrides.gap ?? 0,
            crossAlign: overrides.crossAlign || "start",
            mainAlign: overrides.mainAlign || "start",
            sizing: overrides.sizing || "none",
            overflow: overrides.overflow || "error",
            clipChildren: false,
            children
        }
    };
}

function byId(layout, id) {
    return layout.elements.find((element) => element.id === id);
}

test("canonical box-model API handles asymmetric margin, padding, inset and outset", () => {
    const labels = loadRuntime();
    const element = textElement("texto", {
        x: 10, y: 20, width: 30, height: 40
    }, {
        style: {
            padding: {top: 1, right: 2, bottom: 3, left: 4},
            margin: {top: 5, right: 6, bottom: 7, left: 8}
        }
    });
    const before = plain(element);

    assert.equal(typeof labels.geometry.boxModel, "function");
    assert.equal(typeof labels.geometry.insetBox, "function");
    assert.equal(typeof labels.geometry.outsetBox, "function");
    assert.equal(typeof labels.geometry.minimumStructuralBox, "function");
    assert.deepEqual(plain(labels.geometry.boxModel(element)), {
        elementBox: {x: 10, y: 20, width: 30, height: 40},
        outerBox: {x: 10, y: 20, width: 30, height: 40},
        marginBox: {x: 2, y: 15, width: 44, height: 52},
        contentBox: {x: 14, y: 21, width: 24, height: 36},
        margin: {top: 5, right: 6, bottom: 7, left: 8},
        padding: {top: 1, right: 2, bottom: 3, left: 4},
        contentInsets: {top: 1, right: 2, bottom: 3, left: 4},
        quietZone: 0
    });
    assert.deepEqual(plain(labels.geometry.insetBox(
        {x: 1, y: 2, width: 10, height: 20},
        {top: 1, right: 2, bottom: 3, left: 4}
    )), {x: 5, y: 3, width: 4, height: 16});
    assert.deepEqual(plain(labels.geometry.outsetBox(
        {x: 1, y: 2, width: 10, height: 20},
        {top: 1, right: 2, bottom: 3, left: 4}
    )), {x: -3, y: 1, width: 16, height: 24});
    assert.deepEqual(element, before, "geometry helpers must not mutate their input");
});

test("minimumStructuralBox accounts for type-specific usable-area reservations", () => {
    const {geometry} = loadRuntime();
    const textMinimum = geometry.minimumStructuralBox(textElement("texto", {
        x: 0, y: 0, width: 20, height: 10
    }, {
        style: {
            minFontSize: 4,
            lineHeightFactor: 1.25,
            padding: {top: 1, right: 2, bottom: 3, left: 4}
        }
    }));
    const barcodeMinimum = geometry.minimumStructuralBox({
        type: "barcode",
        quietZone: 2,
        minModuleWidth: 0.3,
        displayValue: true,
        humanReadableMinFontSize: 4,
        textMargin: 1
    });
    const containerMinimum = geometry.minimumStructuralBox({
        type: "container",
        layout: {padding: {top: 1, right: 2, bottom: 3, left: 4}}
    });

    closeTo(textMinimum.width, 6.1, "text structural width");
    closeTo(textMinimum.height, 5.76389, "text structural height");
    closeTo(textMinimum.contentHeight, 1.76389, "text minimum line height");
    closeTo(barcodeMinimum.width, 4.3, "barcode structural width");
    closeTo(barcodeMinimum.height, 2.511112, "barcode structural height");
    assert.deepEqual(plain(containerMinimum), {
        width: 6.1,
        height: 4.1,
        contentWidth: 0.1,
        contentHeight: 0.1
    });
});

test("validation rejects container padding and barcode quiet-zone that erase content", () => {
    const labels = loadRuntime();
    const container = containerElement("area", {
        x: 1, y: 1, width: 10, height: 8
    }, [], {
        padding: {top: 1, right: 4, bottom: 1, left: 6}
    });
    const barcode = {
        id: "barcode",
        type: "barcode",
        template: "123456",
        box: {x: 20, y: 1, width: 6, height: 8},
        quietZone: 3,
        format: "CODE128"
    };

    const report = labels.contract.validate(baseLayout([container, barcode]), {});

    assert.ok(report.errors.some((issue) =>
        issue.code === "CONTAINER_CONTENT_BOX_INVALID" &&
        issue.elementId === "area" &&
        issue.details.contentBox.width === 0
    ));
    assert.ok(report.errors.some((issue) =>
        issue.code === "BARCODE_CONTENT_BOX_INVALID" &&
        issue.elementId === "barcode" &&
        issue.details.contentBox.width === 0
    ));
});

test("container crossAlign center centers the complete margin box", () => {
    const labels = loadRuntime();
    const container = containerElement("area", {
        x: 0, y: 0, width: 40, height: 20
    }, ["filho"], {
        padding: {top: 1, right: 4, bottom: 1, left: 2},
        crossAlign: "center"
    });
    const child = textElement("filho", {
        x: 0, y: 0, width: 10, height: 5
    }, {
        containerId: "area",
        style: {margin: {top: 0, right: 5, bottom: 0, left: 3}}
    });

    const resolved = labels.layout.resolve(baseLayout([container, child]), {}).layout;
    const childBox = byId(resolved, "filho").box;
    const contentBox = labels.geometry.boxModel(byId(resolved, "area")).contentBox;
    const marginBox = labels.geometry.boxModel(byId(resolved, "filho")).marginBox;

    assert.equal(childBox.x, 13);
    assert.equal(
        marginBox.x + marginBox.width / 2,
        contentBox.x + contentBox.width / 2
    );
});

test("graphArrange reports overflow when only the target margin crosses its container", () => {
    const labels = loadRuntime();
    const container = containerElement("area", {
        x: 0, y: 0, width: 30, height: 20
    }, ["referencia", "alvo"], {padding: 2});
    const reference = textElement("referencia", {
        x: 18, y: 4, width: 10, height: 5
    }, {containerId: "area"});
    const target = textElement("alvo", {
        x: 5, y: 4, width: 5, height: 5
    }, {
        containerId: "area",
        style: {margin: {top: 0, right: 4, bottom: 0, left: 0}}
    });

    const result = labels.layout.arrange(
        baseLayout([container, reference, target]),
        ["alvo"],
        "align-right",
        {referenceId: "referencia"}
    );

    assert.deepEqual(plain(byId(result.layout, "alvo").box), {
        x: 23, y: 4, width: 5, height: 5
    });
    assert.deepEqual(plain(result.overflowIds), ["alvo"]);
});

test("shrink uses water-filling and pins a child at its structural minimum", () => {
    const labels = loadRuntime();
    const container = containerElement("area", {
        x: 0, y: 0, width: 30, height: 20
    }, ["limitado", "flexivel"], {sizing: "shrink"});
    const limited = textElement("limitado", {
        x: 0, y: 0, width: 10, height: 10
    }, {
        containerId: "area",
        style: {
            fontSize: 10,
            minFontSize: 10,
            padding: {top: 1, right: 0, bottom: 1, left: 0}
        }
    });
    const flexible = textElement("flexivel", {
        x: 0, y: 0, width: 10, height: 30
    }, {
        containerId: "area",
        style: {fontSize: 10, minFontSize: 1}
    });
    const minimum = labels.geometry.minimumStructuralBox(limited).height;

    const resolved = labels.layout.resolve(baseLayout([
        container, limited, flexible
    ]), {}).layout;

    closeTo(byId(resolved, "limitado").box.height, minimum,
        "limited child must stop at its minimum");
    closeTo(byId(resolved, "flexivel").box.height, 20 - minimum,
        "flexible child receives the remaining height");
    closeTo(
        byId(resolved, "limitado").box.height +
            byId(resolved, "flexivel").box.height,
        20,
        "water-filled children must consume the available main axis"
    );
});

test("equal sizing redistributes space after pinning a structural minimum", () => {
    const labels = loadRuntime();
    const container = containerElement("area", {
        x: 0, y: 0, width: 30, height: 12
    }, ["limitado", "flexivel"], {sizing: "equal"});
    const limited = textElement("limitado", {
        x: 0, y: 0, width: 10, height: 10
    }, {
        containerId: "area",
        style: {fontSize: 20, minFontSize: 20}
    });
    const flexible = textElement("flexivel", {
        x: 0, y: 0, width: 10, height: 10
    }, {
        containerId: "area",
        style: {fontSize: 10, minFontSize: 1}
    });
    const minimum = labels.geometry.minimumStructuralBox(limited).height;

    const resolved = labels.layout.resolve(baseLayout([
        container, limited, flexible
    ]), {}).layout;

    closeTo(byId(resolved, "limitado").box.height, minimum,
        "equal child pinned to its minimum");
    closeTo(byId(resolved, "flexivel").box.height, 12 - minimum,
        "remaining equal child receives the available space");
});

test("equal sizing and space-between share one coherent final geometry", () => {
    const labels = loadRuntime();
    const container = containerElement("area", {
        x: 0, y: 0, width: 30, height: 100
    }, ["primeiro", "segundo"], {
        sizing: "equal",
        mainAlign: "space-between"
    });
    const first = textElement("primeiro", {
        x: 0, y: 0, width: 10, height: 10
    }, {containerId: "area"});
    const second = textElement("segundo", {
        x: 0, y: 0, width: 10, height: 30
    }, {containerId: "area"});

    const resolved = labels.layout.resolve(baseLayout(
        [container, first, second],
        {width: 100, height: 120}
    ), {}).layout;

    assert.deepEqual(plain(byId(resolved, "primeiro").box), {
        x: 0, y: 0, width: 10, height: 50
    });
    assert.deepEqual(plain(byId(resolved, "segundo").box), {
        x: 0, y: 50, width: 10, height: 50
    });
    assert.notEqual(byId(resolved, "area").hasOverflow, true);
});

test("parent shrink reserves the recursive structural minimum of nested containers", () => {
    const labels = loadRuntime();
    const outer = containerElement("externa", {
        x: 0, y: 0, width: 30, height: 6
    }, ["interna", "irmao"], {sizing: "shrink"});
    const inner = containerElement("interna", {
        x: 0, y: 0, width: 10, height: 10
    }, ["texto-interno"], {
        containerId: "externa",
        sizing: "shrink"
    });
    const innerText = textElement("texto-interno", {
        x: 0, y: 0, width: 10, height: 10
    }, {
        containerId: "interna",
        style: {fontSize: 10, minFontSize: 10}
    });
    const sibling = textElement("irmao", {
        x: 0, y: 0, width: 10, height: 10
    }, {
        containerId: "externa",
        style: {fontSize: 10, minFontSize: 1}
    });
    const innerMinimum = labels.geometry.minimumStructuralBox(innerText).height;

    const resolved = labels.layout.resolve(baseLayout([
        outer, inner, innerText, sibling
    ]), {}).layout;

    closeTo(byId(resolved, "interna").box.height, innerMinimum,
        "outer allocation for nested content");
    closeTo(byId(resolved, "texto-interno").box.height, innerMinimum,
        "nested child keeps its structural minimum");
    closeTo(byId(resolved, "irmao").box.height, 6 - innerMinimum,
        "sibling receives the remaining viable space");
    assert.notEqual(byId(resolved, "externa").hasOverflow, true);
    assert.notEqual(byId(resolved, "interna").hasOverflow, true);
});

test("impossible shrink preserves structural minima instead of degenerating boxes", () => {
    const labels = loadRuntime();
    const container = containerElement("area", {
        x: 5, y: 5, width: 30, height: 5
    }, ["primeiro", "segundo"], {
        sizing: "shrink",
        overflow: "visible"
    });
    const first = textElement("primeiro", {
        x: 0, y: 0, width: 10, height: 10
    }, {
        containerId: "area",
        style: {fontSize: 10, minFontSize: 10}
    });
    const second = textElement("segundo", {
        x: 0, y: 0, width: 10, height: 10
    }, {
        containerId: "area",
        style: {fontSize: 10, minFontSize: 10}
    });
    const minimum = labels.geometry.minimumStructuralBox(first).height;

    const resolved = labels.layout.resolve(baseLayout([
        container, first, second
    ]), {}).layout;

    closeTo(byId(resolved, "primeiro").box.height, minimum,
        "first child structural minimum");
    closeTo(byId(resolved, "segundo").box.height, minimum,
        "second child structural minimum");
    assert.equal(byId(resolved, "area").hasOverflow, true);
    assert.ok(minimum * 2 > byId(resolved, "area").box.height);
});

test("cross-axis stretch consumes usable width after asymmetric child margins", () => {
    const labels = loadRuntime();
    const container = containerElement("area", {
        x: 5, y: 5, width: 30, height: 20
    }, ["filho"], {
        padding: {top: 1, right: 4, bottom: 1, left: 2},
        crossAlign: "stretch"
    });
    const child = textElement("filho", {
        x: 0, y: 0, width: 10, height: 5
    }, {
        containerId: "area",
        style: {margin: {top: 0, right: 3, bottom: 0, left: 2}}
    });

    const resolved = labels.layout.resolve(baseLayout([container, child]), {}).layout;
    const childBox = byId(resolved, "filho").box;
    const contentBox = labels.geometry.boxModel(byId(resolved, "area")).contentBox;

    assert.equal(childBox.x, contentBox.x + 2);
    assert.equal(childBox.width, contentBox.width - 2 - 3);
    assert.equal(byId(resolved, "area").hasOverflow, undefined);
});
