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

function ean13Text(value) {
    const source = String(value);
    if (!/^\d{12}$/.test(source)) return source;
    const sum = [...source].reduce((total, digit, index) =>
        total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    return source + ((10 - sum % 10) % 10);
}

class FakeMatrix {
    constructor(...values) {
        this.values = values;
    }
}

class FakePDF {
    constructor(options) {
        this.options = plain(options);
        this.Matrix = FakeMatrix;
        this.fontSizeCalls = [];
        this.textCalls = [];
        this.imageCalls = [];
        this.rectCalls = [];
        this.addPageCalls = [];
        this.matrixCalls = [];
        this.clipCalls = [];
        this.advancedCalls = 0;
        this.savedFiles = [];
        this.autoPrintCalls = 0;
        this.currentFontSize = 10;
        this.pendingRect = null;
    }

    setTextColor() {}
    setDrawColor() {}
    setFillColor() {}
    setFont() {}
    setCharSpace() {}
    setLineWidth() {}
    saveGraphicsState() {}
    restoreGraphicsState() {}
    discardPath() {}

    getFontList() {
        return {
            helvetica: ["normal", "bold", "italic", "bolditalic"],
            times: ["normal", "bold", "italic", "bolditalic"],
            courier: ["normal", "bold", "italic", "bolditalic"]
        };
    }

    setFontSize(value) {
        this.currentFontSize = Number(value);
        this.fontSizeCalls.push(this.currentFontSize);
    }

    splitTextToSize(value, width) {
        const text = String(value);
        const charactersPerLine = Math.max(1, Math.floor(Number(width)));
        if (!text) return [""];
        const lines = [];
        for (let index = 0; index < text.length; index += charactersPerLine) {
            lines.push(text.slice(index, index + charactersPerLine));
        }
        return lines;
    }

    getTextWidth(value) {
        return String(value).length;
    }

    text(lines, x, y, options) {
        this.textCalls.push({
            lines: plain(lines),
            x,
            y,
            options: plain(options)
        });
    }

    addImage(...args) {
        this.imageCalls.push(plain(args));
    }

    getImageProperties() {
        return {width: 200, height: 100};
    }

    addPage(...args) {
        this.addPageCalls.push(plain(args));
    }

    rect(x, y, width, height, style) {
        this.pendingRect = {x, y, width, height};
        this.rectCalls.push({x, y, width, height, style});
    }

    clip() {
        this.clipCalls.push(plain(this.pendingRect));
    }

    setCurrentTransformationMatrix(matrix) {
        this.matrixCalls.push(matrix);
    }

    advancedAPI(callback) {
        this.advancedCalls += 1;
        callback(this);
    }

    output(kind) {
        return {kind};
    }

    save(fileName) {
        this.savedFiles.push(fileName);
    }

    autoPrint() {
        this.autoPrintCalls += 1;
    }
}

function loadRuntime(options = {}) {
    const root = {};
    const pdfInstances = [];
    const barcodeCalls = [];
    const JsBarcode = (target, value, options) => {
        barcodeCalls.push({
            target: typeof target.toDataURL === "function" ? "canvas" : "metadata",
            value: String(value),
            options: plain(options)
        });
        const displayText = options.displayValue === true
            ? (String(options.format).toUpperCase() === "EAN13"
                ? ean13Text(value)
                : String(options.text ?? value))
            : undefined;
        target.encodings = [{data: "10101", text: displayText}];
        return target;
    };
    const sandbox = {
        console,
        document: {
            getElementById: () => root,
            createElement: () => ({
                toDataURL: () => "data:image/png;base64,FAKE"
            })
        },
        window: {
            FWWebEx: {
                PDF: {
                    isReady: () => true,
                    create: (options) => {
                        const pdf = new FakePDF(options);
                        pdfInstances.push(pdf);
                        return pdf;
                    }
                }
            }
        }
    };
    if (options.withBarcode !== false) sandbox.JsBarcode = JsBarcode;
    const context = vm.createContext(sandbox);

    vm.runInContext(generatorSource, context);
    const labels = sandbox.window.FWWebExLabels;
    return {
        api: {
            generate: labels.renderer.generate,
            normalize: labels.contract.normalize,
            serialize: labels.contract.serialize,
            validate: labels.contract.validate,
            resolveLayout: labels.layout.resolve,
            layout: labels.layout
        },
        barcodeCalls,
        pdfInstances
    };
}

function baseLayout(overrides = {}) {
    return {
        schema: "fwwebex.labels",
        version: 2,
        name: "renderer-critical",
        unit: "mm",
        page: {
            width: 100,
            height: 60,
            rotation: 0,
            margins: 0,
            safeArea: 0,
            bleed: 0
        },
        background: null,
        editor: {},
        variables: [],
        barcodeAutoRules: [],
        elements: [],
        ...overrides
    };
}

function textElement(
    id,
    template,
    box = {x: 1, y: 1, width: 20, height: 10},
    overrides = {}
) {
    const style = overrides.style || {};
    const fit = overrides.fit || {};
    return {
        id,
        type: "text",
        template,
        box,
        rotation: overrides.rotation ?? 0,
        zIndex: overrides.zIndex ?? 0,
        locked: false,
        hidden: false,
        containerId: null,
        style: {
            fontFamily: "helvetica",
            fontSize: 6,
            minFontSize: 6,
            fontStyle: "normal",
            color: "#000000",
            lineHeightFactor: 1,
            letterSpacing: 0,
            align: "left",
            verticalAlign: "top",
            padding: 0,
            margin: 0,
            ...style
        },
        fit: {
            mode: "none",
            maxLines: 1,
            overflow: "error",
            ...fit
        },
        textOptions: {}
    };
}

function barcodeElement(overrides = {}) {
    return {
        id: "barcode",
        type: "barcode",
        template: "{{codigo}}",
        box: {x: 7, y: 8, width: 20, height: 12},
        rotation: 0,
        zIndex: 0,
        locked: false,
        hidden: false,
        containerId: null,
        format: "CODE128",
        fallbackFormat: "CODE128",
        displayValue: true,
        quietZone: 0,
        minModuleWidth: 0,
        overflow: "error",
        humanReadableFontSize: 2,
        humanReadableMinFontSize: 2,
        textMargin: 0,
        autoFit: true,
        textOverflow: "error",
        barcodeOptions: {width: 2, height: 80},
        ...overrides
    };
}

test("produto overflow reports useful geometry without crossing minFontSize", async () => {
    const {api, pdfInstances} = loadRuntime();
    const [layout, records] = await Promise.all([
        readFile(resolve(
            "src/fw.webex/contrib/fw.webex.labels/tests/fixtures/" +
            "v1-product-min-font/layout.json"
        ), "utf8").then(JSON.parse),
        readFile(resolve(
            "src/fw.webex/contrib/fw.webex.labels/tests/fixtures/" +
            "v1-product-min-font/records.json"
        ), "utf8").then(JSON.parse)
    ]);
    let generationError = null;

    try {
        await api.generate(layout, records, {output: "none"});
    } catch (error) {
        generationError = error;
    }

    assert.ok(generationError, "the impossible 1 mm content height must fail");
    const overflow = generationError.issues.find((item) =>
        item.code === "TEXT_OVERFLOW" && item.elementId === "produto"
    );
    assert.ok(overflow);
    assert.equal(overflow.path, "/elements/0/fit/overflow");
    assert.equal(overflow.recordIndex, 0);
    assert.equal(overflow.details.contentBox.width, 16.03);
    assert.equal(overflow.details.contentBox.height, 1);
    assert.equal(overflow.details.fontSize, 8);
    assert.equal(overflow.details.minFontSize, 8);
    assert.equal(overflow.details.finalFontSize, 8);
    assert.ok(overflow.details.requiredHeight > 3);
    assert.match(overflow.suggestion, /padding\/minFontSize/);

    assert.equal(pdfInstances.length, 1);
    const fittingSizes = pdfInstances[0].fontSizeCalls.filter((size) => size <= 8);
    assert.ok(fittingSizes.length > 0);
    assert.ok(fittingSizes.every((size) => size >= 8));
    assert.equal(pdfInstances[0].textCalls.length, 0);
});

test("clip and ellipsis apply distinct overflow behavior deterministically", async () => {
    const {api, pdfInstances} = loadRuntime();
    const layout = baseLayout({
        elements: [
            textElement("clip", "ABCDEFGHIJK", {
                x: 1, y: 1, width: 5, height: 4
            }, {
                style: {fontSize: 10, minFontSize: 10},
                fit: {mode: "none", maxLines: 1, overflow: "clip"}
            }),
            textElement("ellipsis", "ABCDEFGHIJK", {
                x: 10, y: 1, width: 5, height: 4
            }, {
                style: {fontSize: 10, minFontSize: 10},
                fit: {mode: "none", maxLines: 1, overflow: "ellipsis"}
            })
        ]
    });

    const result = await api.generate(layout, {}, {
        output: "none",
        returnResult: true
    });
    const pdf = pdfInstances[0];

    assert.equal(result.report.valid, true);
    assert.deepEqual(
        plain(result.report.warnings
            .filter((item) => item.code === "TEXT_OVERFLOW_APPLIED")
            .map((item) => item.elementId)),
        ["clip", "ellipsis"]
    );
    assert.equal(pdf.textCalls.length, 2);
    assert.deepEqual(pdf.textCalls[0].lines, ["ABCDE"]);
    assert.deepEqual(pdf.textCalls[1].lines, ["AB..."]);
    assert.deepEqual(pdf.clipCalls, [{x: 1, y: 1, width: 5, height: 4}]);

    const clipMetrics = result.report.metrics.records[0].elements.clip;
    const ellipsisMetrics =
        result.report.metrics.records[0].elements.ellipsis;
    assert.deepEqual(plain(clipMetrics.contentBox), {
        x: 1, y: 1, width: 5, height: 4
    });
    assert.deepEqual(plain(ellipsisMetrics.contentBox), {
        x: 10, y: 1, width: 5, height: 4
    });
    assert.equal(clipMetrics.finalFontSize, 10);
    assert.equal(clipMetrics.overflowPolicy, "clip");
    assert.equal(ellipsisMetrics.finalFontSize, 10);
    assert.equal(ellipsisMetrics.overflowPolicy, "ellipsis");
});

test("validateOnly measures every supplied record without drawing PDF pages", async () => {
    const {api, pdfInstances} = loadRuntime();
    const result = await api.generate(baseLayout({
        elements: [textElement("produto", "{{produto}}", {
            x: 1, y: 1, width: 30, height: 8
        })]
    }), [{produto: "A"}, {produto: "B"}], {
        output: "none",
        returnResult: true,
        validateOnly: true
    });
    const pdf = pdfInstances[0];

    assert.equal(result.report.valid, true);
    assert.equal(result.report.metrics.records.length, 2);
    assert.equal(pdf.advancedCalls, 0);
    assert.equal(pdf.addPageCalls.length, 0);
    assert.equal(pdf.textCalls.length, 0);
});

test("ellipsis marker is measured and never exceeds a very narrow box", async () => {
    const {api, pdfInstances} = loadRuntime();
    const layout = baseLayout({
        elements: [
            textElement("estreito", "ABCDE", {
                x: 1, y: 1, width: 1, height: 4
            }, {
                style: {fontSize: 10, minFontSize: 10},
                fit: {mode: "none", maxLines: 1, overflow: "ellipsis"}
            })
        ]
    });

    const result = await api.generate(layout, {}, {
        output: "none",
        returnResult: true
    });
    const rendered = pdfInstances[0].textCalls[0].lines[0];

    assert.equal(result.report.valid, true);
    assert.equal(rendered, ".");
    assert.ok(pdfInstances[0].getTextWidth(rendered) <= 1);
});

test("font fallback is explicit and container clipping is physical", async () => {
    const {api, pdfInstances} = loadRuntime();
    const container = {
        id: "area",
        type: "container",
        box: {x: 2, y: 3, width: 30, height: 20},
        rotation: 0,
        zIndex: 0,
        locked: false,
        hidden: false,
        containerId: null,
        layout: {
            direction: "vertical",
            padding: 1,
            gap: 0,
            crossAlign: "stretch",
            mainAlign: "start",
            sizing: "none",
            overflow: "clip",
            clipChildren: true,
            children: ["texto"]
        }
    };
    const child = {
        ...textElement("texto", "ABC", {
            x: 99, y: 99, width: 10, height: 5
        }, {
            style: {fontFamily: "Arial"}
        }),
        containerId: "area"
    };

    const result = await api.generate(baseLayout({
        elements: [container, child]
    }), {}, {output: "none", returnResult: true});

    const fallback = result.report.warnings.find((item) =>
        item.code === "FONT_FALLBACK_USED" && item.elementId === "texto"
    );
    assert.ok(fallback);
    assert.deepEqual(plain(fallback.details), {
        requestedFamily: "Arial",
        requestedStyle: "normal",
        family: "helvetica",
        style: "normal",
        fallback: true
    });
    assert.deepEqual(pdfInstances[0].clipCalls, [
        {x: 2, y: 3, width: 30, height: 20}
    ]);
});

test("barcode keeps quietZone and textMargin zero through planning and render", async () => {
    const {api, barcodeCalls, pdfInstances} = loadRuntime();
    const layout = baseLayout({elements: [barcodeElement()]});

    const result = await api.generate(layout, {codigo: "12345"}, {
        output: "none",
        returnResult: true
    });
    const pdf = pdfInstances[0];
    const metrics = result.report.metrics.records[0].elements.barcode;

    assert.equal(result.report.valid, true);
    assert.equal(metrics.moduleWidth, 4);
    assert.equal(metrics.minModuleWidth, 0);
    assert.equal(metrics.textMargin, 0);
    assert.equal(metrics.barsHeight, 12 - 2 * 0.352778);
    assert.equal(pdf.imageCalls.length, 0, "barcode bars must remain vectorial");
    const filledRectangles = pdf.rectCalls.filter((call) => call.style === "F");
    assert.equal(filledRectangles.length, 4);
    assert.deepEqual(filledRectangles[0], {
        x: 7, y: 8, width: 20, height: 12, style: "F"
    });
    assert.deepEqual(
        filledRectangles.slice(1).map((call) => call.x),
        [7, 15, 23],
        "quietZone 0 must not shift vector modules"
    );
    assert.ok(filledRectangles.slice(1).every((call) => call.width === 4));
    assert.equal(pdf.textCalls.length, 1);
    assert.equal(barcodeCalls.length, 2);
    assert.equal(barcodeCalls[0].target, "metadata");
    assert.equal(barcodeCalls[0].options.displayValue, false);
    assert.equal(barcodeCalls[1].options.displayValue, true);
    assert.ok(barcodeCalls.every((call) => call.options.margin === 0));
    assert.ok(barcodeCalls.every((call) => call.options.textMargin === 0));
});

test("EAN13 human-readable text uses the checksum encoded by JsBarcode", async () => {
    const {api, pdfInstances} = loadRuntime();
    const layout = baseLayout({
        elements: [barcodeElement({
            format: "EAN13",
            template: "{{codigo}}",
            quietZone: 2
        })]
    });

    const result = await api.generate(layout, {
        codigo: "590123412345"
    }, {output: "none", returnResult: true});
    const pdf = pdfInstances[0];
    const metrics = result.report.metrics.records[0].elements.barcode;

    assert.equal(metrics.inputValue, "590123412345");
    assert.equal(metrics.encodedDisplayText, "5901234123457");
    assert.equal(pdf.textCalls[0].lines, "5901234123457");
    const background = pdf.rectCalls.find((call) => call.style === "F");
    assert.deepEqual(background, {
        x: 7, y: 8, width: 20, height: 12, style: "F"
    });
    const firstBar = pdf.rectCalls.filter((call) => call.style === "F")[1];
    assert.equal(firstBar.x, 9, "quiet zone must remain inside the white background");
});

test("allowed narrow barcode modules remain visible as a structured warning", async () => {
    const {api} = loadRuntime();
    const layout = baseLayout({
        elements: [barcodeElement({
            box: {x: 1, y: 1, width: 5, height: 10},
            minModuleWidth: 2,
            overflow: "allow",
            displayValue: false
        })]
    });

    const result = await api.generate(layout, {
        codigo: "123"
    }, {output: "none", returnResult: true});
    const warning = result.report.warnings.find((item) =>
        item.code === "BARCODE_MODULE_TOO_NARROW_ALLOWED"
    );

    assert.equal(result.report.valid, true);
    assert.equal(warning?.elementId, "barcode");
    assert.equal(warning?.details.moduleWidth, 1);
    assert.equal(warning?.details.minModuleWidth, 2);
    assert.equal(warning?.details.requiredWidth, 10);
});

test("missing JsBarcode reports a dependency error instead of a value error", async () => {
    const {api} = loadRuntime({withBarcode: false});
    let generationError = null;

    try {
        await api.generate(baseLayout({
            elements: [barcodeElement()]
        }), {codigo: "123"}, {output: "none"});
    } catch (error) {
        generationError = error;
    }

    const dependency = generationError?.issues?.find((item) =>
        item.code === "BARCODE_DEPENDENCY_MISSING"
    );
    assert.ok(dependency);
    assert.equal(dependency.phase, "dependency");
    assert.equal(dependency.elementId, "barcode");
});

test("fit none reports the configured font size instead of the minimum", async () => {
    const {api} = loadRuntime();
    const layout = baseLayout({
        elements: [textElement("sem-ajuste", "ABCDEFGHIJK", {
            x: 1, y: 1, width: 5, height: 4
        }, {
            style: {fontSize: 10, minFontSize: 2},
            fit: {mode: "none", maxLines: 1, overflow: "error"}
        })]
    });
    let generationError = null;

    try {
        await api.generate(layout, {}, {output: "none"});
    } catch (error) {
        generationError = error;
    }

    const overflow = generationError?.issues?.find((item) =>
        item.code === "TEXT_OVERFLOW"
    );
    assert.ok(overflow);
    assert.equal(overflow.details.fitMode, "none");
    assert.equal(overflow.details.fontSize, 10);
    assert.equal(overflow.details.minFontSize, 2);
    assert.equal(overflow.details.finalFontSize, 10);
    assert.match(overflow.message, /tamanho configurado de 10\.00 pt/);
});

test("empty resolved text is measured explicitly and does not draw a glyph", async () => {
    const {api, pdfInstances} = loadRuntime();
    const result = await api.generate(baseLayout({
        elements: [textElement("vazio", "{{opcional}}")]
    }), {}, {output: "none", returnResult: true});
    const metrics = result.report.metrics.records[0].elements.vazio;

    assert.equal(result.report.valid, true);
    assert.equal(metrics.empty, true);
    assert.equal(metrics.lineCount, 0);
    assert.equal(metrics.finalFontSize, 6);
    assert.equal(pdfInstances[0].textCalls.length, 0);
});

test("multiple records produce one page per record in all orthogonal rotations", async () => {
    const expected = {
        0: {format: [100, 60], matrix: null},
        90: {format: [60, 100], matrix: [0, 1, -1, 0, 60, 0]},
        180: {format: [100, 60], matrix: [-1, 0, 0, -1, 100, 60]},
        270: {format: [60, 100], matrix: [0, -1, 1, 0, 0, 100]}
    };
    const records = [
        {codigo: "REG-1"},
        {codigo: "REG-2"},
        {codigo: "REG-3"}
    ];
    const layout = baseLayout({
        background: {
            dataUrl: "data:image/png;base64,AAAA",
            fit: "contain",
            opacity: 1,
            locked: true
        },
        elements: [
            textElement("codigo", "{{codigo}}", {
                x: 37, y: 21, width: 23, height: 11
            }, {rotation: 30})
        ]
    });
    let referenceMetrics = null;
    const radians = 30 * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const centerX = 37 + 23 / 2;
    const centerY = 21 + 11 / 2;
    const elementMatrix = [
        cosine,
        sine,
        -sine,
        cosine,
        centerX - cosine * centerX + sine * centerY,
        centerY - sine * centerX - cosine * centerY
    ];

    function assertMatrix(actual, expectedMatrix, message) {
        assert.equal(actual.length, expectedMatrix.length, message);
        actual.forEach((value, index) => {
            assert.ok(
                Math.abs(value - expectedMatrix[index]) < 1e-12,
                `${message}: coefficient ${index}, expected ` +
                `${expectedMatrix[index]}, received ${value}`
            );
        });
    }

    for (const rotation of [0, 90, 180, 270]) {
        const {api, pdfInstances} = loadRuntime();
        const result = await api.generate(layout, records, {
            rotation,
            output: "none",
            returnResult: true
        });
        const pdf = pdfInstances[0];

        assert.deepEqual(pdf.options.format, expected[rotation].format);
        assert.equal(pdf.addPageCalls.length, 2);
        assert.ok(pdf.addPageCalls.every((call) =>
            JSON.stringify(call[0]) === JSON.stringify(expected[rotation].format)
        ));
        assert.equal(pdf.advancedCalls, 3);
        assert.equal(pdf.textCalls.length, 3);
        assert.equal(pdf.imageCalls.length, 3);
        assert.ok(pdf.imageCalls.every((call) =>
            call[0] === "data:image/png;base64,AAAA" &&
            call[1] === "PNG" &&
            call[2] === 0 &&
            call[3] === 5 &&
            call[4] === 100 &&
            call[5] === 50
        ));
        assert.deepEqual(
            pdf.textCalls.map((call) => call.lines),
            [["REG-1"], ["REG-2"], ["REG-3"]]
        );
        assert.ok(pdf.textCalls.every((call) =>
            !Object.hasOwn(call.options, "angle")
        ));
        assert.equal(result.report.metrics.records.length, 3);

        if (expected[rotation].matrix === null) {
            assert.equal(pdf.matrixCalls.length, 3);
            pdf.matrixCalls.forEach((matrix, index) => {
                assertMatrix(
                    matrix.values,
                    elementMatrix,
                    `element matrix on page ${index + 1} at rotation 0`
                );
            });
        } else {
            assert.equal(pdf.matrixCalls.length, 6);
            for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
                assertMatrix(
                    pdf.matrixCalls[pageIndex * 2].values,
                    expected[rotation].matrix,
                    `page matrix on page ${pageIndex + 1} at rotation ${rotation}`
                );
                assertMatrix(
                    pdf.matrixCalls[pageIndex * 2 + 1].values,
                    elementMatrix,
                    `element matrix on page ${pageIndex + 1} at rotation ${rotation}`
                );
            }
        }

        const currentMetrics = plain(result.report.metrics);
        if (referenceMetrics === null) referenceMetrics = currentMetrics;
        else assert.deepEqual(
            currentMetrics,
            referenceMetrics,
            `rotation ${rotation} must not alter fit metrics`
        );
    }
});
