import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";

const visualEnabled = process.env.FWWEBEX_LABELS_VISUAL === "1";

const labelsSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.labels.tlpp"
), "utf8");
const pdfFeatureSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.jspdf.tlpp"
), "utf8");

const labelScripts = [...labelsSource.matchAll(
    /beginContent var \w+\s*([\s\S]*?)\s*endContent/g
)].map((match) => match[1]);
const generatorSource = labelScripts.find((script) =>
    script.includes("function normalizeLayout") &&
    script.includes("window.FWWebExLabels.renderer.generate=generate")
);
const pdfRuntime = [...pdfFeatureSource.matchAll(
    /beginContent var cRuntime\s*([\s\S]*?)\s*endContent/g
)][0]?.[1];
const jsPDFURL = pdfFeatureSource.match(
    /https:\/\/cdn\.jsdelivr\.net\/npm\/jspdf@[^"')\s]+/
)?.[0];
const jsBarcodeURL = labelsSource.match(
    /https:\/\/cdn\.jsdelivr\.net\/npm\/jsbarcode@[^"')\s]+/i
)?.[0];
const pdfJsURL =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const pdfJsWorkerURL =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

assert.ok(generatorSource, "embedded Labels generator runtime was not found");
assert.ok(pdfRuntime, "embedded generic PDF runtime was not found");
assert.ok(jsPDFURL, "pinned jsPDF URL was not found");
assert.ok(jsBarcodeURL, "pinned JsBarcode URL was not found");

test("real browser raster matches the asymmetric canvas at 0/90/180/270", {
    skip: !visualEnabled,
    timeout: 180_000
}, async () => {
    let chromium;
    try {
        ({chromium} = await import("playwright"));
    } catch (error) {
        assert.fail(
            "FWWEBEX_LABELS_VISUAL=1 requires the optional 'playwright' " +
            "package and an installed Chromium browser. See tests/README.md. " +
            `Original error: ${error.message}`
        );
    }

    const launchOptions = {headless: true};
    if (process.env.FWWEBEX_LABELS_BROWSER)
        launchOptions.executablePath = process.env.FWWEBEX_LABELS_BROWSER;
    const browser = await chromium.launch(launchOptions);
    try {
        const page = await browser.newPage();
        await page.setContent("<div id=\"labels-visual-generator\"></div>");
        await page.addScriptTag({url: jsPDFURL});
        await page.addScriptTag({content: pdfRuntime});
        await page.addScriptTag({url: jsBarcodeURL});
        await page.addScriptTag({
            content: generatorSource
        });
        await page.addScriptTag({url: pdfJsURL});

        const results = await page.evaluate(async ({
            workerURL,
            rotations
        }) => {
            const sourceWidth = 100;
            const sourceHeight = 60;
            const pixelsPerMillimeter = 8;
            const barcodeValue = "FWWEBEX-12345";
            const barcodeBox = {x: 24, y: 21, width: 53, height: 18};
            const quietZone = 2;

            function makeBackground() {
                const canvas = document.createElement("canvas");
                canvas.width = 1000;
                canvas.height = 600;
                const context = canvas.getContext("2d");
                context.fillStyle = "#eeeeee";
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = "#e53935";
                context.fillRect(0, 0, 350, 180);
                context.fillStyle = "#43a047";
                context.fillRect(680, 0, 320, 260);
                context.fillStyle = "#1e88e5";
                context.fillRect(600, 420, 400, 180);
                context.fillStyle = "#fdd835";
                context.fillRect(0, 350, 260, 250);
                context.fillStyle = "#8e24aa";
                context.fillRect(405, 225, 145, 115);
                return canvas;
            }

            function layout(backgroundDataURL) {
                return {
                    schema: "fwwebex.labels",
                    version: 2,
                    name: "visual-asymmetric-rotation",
                    unit: "mm",
                    page: {
                        width: sourceWidth,
                        height: sourceHeight,
                        rotation: 0,
                        margins: 0,
                        safeArea: 0,
                        bleed: 0
                    },
                    background: {
                        dataUrl: backgroundDataURL,
                        fit: "fill",
                        opacity: 1,
                        locked: true
                    },
                    editor: {},
                    variables: [{
                        name: "barcode",
                        type: "string",
                        required: true
                    }],
                    barcodeAutoRules: [],
                    barcodeFallbackFormat: "CODE128",
                    elements: [{
                        id: "visual-barcode",
                        name: "Barcode",
                        type: "barcode",
                        template: "{{barcode}}",
                        box: barcodeBox,
                        rotation: 0,
                        zIndex: 1,
                        locked: false,
                        hidden: false,
                        containerId: null,
                        format: "CODE128",
                        fallbackFormat: "CODE128",
                        displayValue: false,
                        quietZone,
                        minModuleWidth: 0,
                        overflow: "allow",
                        humanReadableFontSize: 10,
                        humanReadableMinFontSize: 6,
                        humanReadableFontFamily: "courier",
                        humanReadableFontStyle: "normal",
                        humanReadableColor: "#000000",
                        humanReadablePosition: "bottom",
                        humanReadableAlign: "center",
                        textMargin: 0,
                        autoFit: true,
                        textOverflow: "error",
                        barcodeOptions: {
                            width: 2,
                            height: 80,
                            lineColor: "#000000",
                            background: "#ffffff"
                        }
                    }]
                };
            }

            function applyPageTransform(context, rotation, scale) {
                if (rotation === 90) {
                    context.setTransform(
                        0,
                        scale,
                        -scale,
                        0,
                        sourceHeight * scale,
                        0
                    );
                } else if (rotation === 180) {
                    context.setTransform(
                        -scale,
                        0,
                        0,
                        -scale,
                        sourceWidth * scale,
                        sourceHeight * scale
                    );
                } else if (rotation === 270) {
                    context.setTransform(
                        0,
                        -scale,
                        scale,
                        0,
                        0,
                        sourceWidth * scale
                    );
                } else {
                    context.setTransform(scale, 0, 0, scale, 0, 0);
                }
            }

            function drawReference(
                canvas,
                rotation,
                backgroundCanvas,
                scale
            ) {
                const context = canvas.getContext("2d", {willReadFrequently: true});
                context.imageSmoothingEnabled = false;
                applyPageTransform(context, rotation, scale);
                context.drawImage(
                    backgroundCanvas,
                    0,
                    0,
                    sourceWidth,
                    sourceHeight
                );

                context.fillStyle = "#ffffff";
                context.fillRect(
                    barcodeBox.x,
                    barcodeBox.y,
                    barcodeBox.width,
                    barcodeBox.height
                );
                const metadata = {};
                JsBarcode(metadata, barcodeValue, {
                    format: "CODE128",
                    displayValue: false,
                    width: 2,
                    height: 80,
                    margin: 0,
                    textMargin: 0,
                    lineColor: "#000000",
                    background: "#ffffff"
                });
                const encodings = (metadata.encodings || []).map((encoding) => ({
                    data: String(encoding.data || ""),
                    height: Number(encoding.options?.height || 80)
                }));
                const moduleCount = encodings.reduce(
                    (total, encoding) => total + encoding.data.length,
                    0
                );
                const availableWidth = barcodeBox.width - quietZone * 2;
                const moduleWidth = availableWidth / moduleCount;
                const maximumHeight = Math.max(
                    1,
                    ...encodings.map((encoding) => encoding.height)
                );
                let moduleOffset = 0;
                context.fillStyle = "#000000";
                for (const encoding of encodings) {
                    const segmentHeight = barcodeBox.height *
                        encoding.height / maximumHeight;
                    let index = 0;
                    while (index < encoding.data.length) {
                        const value = Number(encoding.data[index]);
                        if (!(value > 0)) {
                            index += 1;
                            continue;
                        }
                        let end = index + 1;
                        while (end < encoding.data.length &&
                            encoding.data[end] === encoding.data[index]) {
                            end += 1;
                        }
                        context.fillRect(
                            barcodeBox.x + quietZone +
                                (moduleOffset + index) * moduleWidth,
                            barcodeBox.y,
                            (end - index) * moduleWidth,
                            segmentHeight * value
                        );
                        index = end;
                    }
                    moduleOffset += encoding.data.length;
                }
                context.resetTransform();
            }

            function compare(actual, expected) {
                const first = actual.getContext(
                    "2d",
                    {willReadFrequently: true}
                ).getImageData(0, 0, actual.width, actual.height).data;
                const second = expected.getContext(
                    "2d",
                    {willReadFrequently: true}
                ).getImageData(0, 0, expected.width, expected.height).data;
                let mismatches = 0;
                let absoluteDelta = 0;
                for (let index = 0; index < first.length; index += 4) {
                    const red = Math.abs(first[index] - second[index]);
                    const green = Math.abs(first[index + 1] - second[index + 1]);
                    const blue = Math.abs(first[index + 2] - second[index + 2]);
                    absoluteDelta += red + green + blue;
                    if (Math.max(red, green, blue) > 48) mismatches += 1;
                }
                const pixels = actual.width * actual.height;
                return {
                    mismatchRatio: mismatches / pixels,
                    meanAbsoluteChannelDelta: absoluteDelta / (pixels * 3)
                };
            }

            pdfjsLib.GlobalWorkerOptions.workerSrc = workerURL;
            const backgroundCanvas = makeBackground();
            const contract = layout(backgroundCanvas.toDataURL("image/png"));
            const observations = [];
            for (const rotation of rotations) {
                const generated = await FWWebExLabels.renderer.generate(
                    contract,
                    {barcode: barcodeValue},
                    {
                        rotation,
                        output: "datauristring",
                        returnResult: true
                    }
                );
                const bytes = new Uint8Array(
                    await (await fetch(generated.output)).arrayBuffer()
                );
                const pdf = await pdfjsLib.getDocument({data: bytes}).promise;
                const pdfPage = await pdf.getPage(1);
                const unscaled = pdfPage.getViewport({scale: 1});
                const pageWidth = rotation === 90 || rotation === 270
                    ? sourceHeight
                    : sourceWidth;
                const targetWidth = pageWidth * pixelsPerMillimeter;
                const viewport = pdfPage.getViewport({
                    scale: targetWidth / unscaled.width
                });
                const actual = document.createElement("canvas");
                actual.width = Math.round(viewport.width);
                actual.height = Math.round(viewport.height);
                await pdfPage.render({
                    canvasContext: actual.getContext("2d"),
                    viewport
                }).promise;

                const expected = document.createElement("canvas");
                expected.width = actual.width;
                expected.height = actual.height;
                drawReference(
                    expected,
                    rotation,
                    backgroundCanvas,
                    actual.width / pageWidth
                );
                observations.push({
                    rotation,
                    width: actual.width,
                    height: actual.height,
                    ...compare(actual, expected)
                });
                await pdf.destroy();
            }
            return observations;
        }, {
            workerURL: pdfJsWorkerURL,
            rotations: [0, 90, 180, 270]
        });

        assert.deepEqual(
            results.map((result) => result.rotation),
            [0, 90, 180, 270]
        );
        for (const result of results) {
            const expectedLandscape = result.rotation === 0 ||
                result.rotation === 180;
            assert.equal(
                result.width > result.height,
                expectedLandscape,
                `unexpected page orientation at ${result.rotation} degrees`
            );
            assert.ok(
                result.mismatchRatio < 0.035,
                `${result.rotation} degrees: raster mismatch ` +
                `${(result.mismatchRatio * 100).toFixed(2)}%`
            );
            assert.ok(
                result.meanAbsoluteChannelDelta < 10,
                `${result.rotation} degrees: mean RGB delta ` +
                result.meanAbsoluteChannelDelta.toFixed(2)
            );
        }
    } finally {
        await browser.close();
    }
});
