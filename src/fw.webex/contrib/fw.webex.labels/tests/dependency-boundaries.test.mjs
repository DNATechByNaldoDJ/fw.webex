import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";

const labelsSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.labels.tlpp"
), "utf8");
const pdfFeatureSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.jspdf.tlpp"
), "utf8");
const metadataFeatureSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.exifreader.tlpp"
), "utf8");

test("Labels owns only its pinned JsBarcode dependency", () => {
    const barcodeURLs = labelsSource.match(
        /https:\/\/cdn\.jsdelivr\.net\/npm\/jsbarcode@[^"')\s]+/gi
    ) || [];
    assert.deepEqual(barcodeURLs, [
        "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"
    ]);
    assert.doesNotMatch(labelsSource, /jspdf(?:@|\/)[0-9]/i);
});

test("generic PDF and optional HTML dependencies stay pinned and separated", () => {
    const dependencyURLs = pdfFeatureSource.match(
        /https:\/\/cdn\.jsdelivr\.net\/npm\/[^"')\s]+/gi
    ) || [];
    assert.deepEqual(dependencyURLs, [
        "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js",
        "https://cdn.jsdelivr.net/npm/dompurify@3.4.7/dist/purify.min.js",
        "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
    ]);
    assert.match(pdfFeatureSource, /class WebExFeatureJsPDFHTML/);
    assert.match(labelsSource, /WebExFeatureJsPDF\(\):Enable\(30\)/);
    assert.doesNotMatch(labelsSource, /html2canvas|DOMPurify/);
});

test("ExifReader is owned by its generic feature and loaded only by the designer", () => {
    const dependencyURLs = metadataFeatureSource.match(
        /https:\/\/cdn\.jsdelivr\.net\/npm\/[^"')\s]+/gi
    ) || [];
    assert.deepEqual(dependencyURLs, [
        "https://cdn.jsdelivr.net/npm/exifreader@4.42.0/dist/exif-reader.js"
    ]);
    assert.doesNotMatch(labelsSource, /exifreader@/i);
    assert.match(labelsSource, /WebExFeatureExifReader\(\):Enable\(28\)/);
    const labelsFeature = labelsSource.match(
        /method Enable\(\) class WebExFeatureLabels([\s\S]*?)return\(self\)/
    )?.[1] || "";
    const headless = labelsSource.match(
        /method New\(\) class WebExLabelPDFGenerator([\s\S]*?)return\(self\)/
    )?.[1] || "";
    assert.doesNotMatch(labelsFeature, /WebExFeatureExifReader/);
    assert.doesNotMatch(headless, /WebExFeatureExifReader/);
});
