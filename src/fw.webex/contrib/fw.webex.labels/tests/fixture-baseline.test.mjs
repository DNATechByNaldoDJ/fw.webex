import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturesDirectory = path.join(testsDirectory, "fixtures");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadCase(caseId) {
  const directory = path.join(fixturesDirectory, caseId);
  const [layout, records, expected] = await Promise.all([
    readJson(path.join(directory, "layout.json")),
    readJson(path.join(directory, "records.json")),
    readJson(path.join(directory, "expected.json"))
  ]);
  return { layout, records, expected };
}

function assertFiniteNumber(value, message) {
  assert.equal(Number.isFinite(value), true, message);
}

function assertV1Layout(caseId, layout, records) {
  assert.equal(layout.version, 1, `${caseId}: fixture must remain version 1`);
  assert.equal(layout.unit, "mm", `${caseId}: canonical unit must be mm`);
  assert.equal(typeof layout.name, "string");
  assert.ok(layout.name.length > 0);
  assert.equal(typeof layout.page, "object");
  assertFiniteNumber(layout.page.width, `${caseId}: page.width must be finite`);
  assertFiniteNumber(layout.page.height, `${caseId}: page.height must be finite`);
  assert.ok(layout.page.width > 0);
  assert.ok(layout.page.height > 0);
  assert.ok([0, 90, 180, 270].includes(layout.page.rotation));
  assert.ok(layout.background === null || typeof layout.background === "string");
  assert.ok(Array.isArray(layout.variables));
  assert.ok(Array.isArray(layout.barcodeAutoRules));
  assert.ok(Array.isArray(layout.elements));
  assert.ok(Array.isArray(records));
  assert.ok(records.length > 0);

  const ids = new Set();
  for (const [index, element] of layout.elements.entries()) {
    const prefix = `${caseId}: elements[${index}]`;
    assert.equal(typeof element.id, "string", `${prefix}.id must be a string`);
    assert.ok(element.id.length > 0, `${prefix}.id must not be empty`);
    assert.equal(ids.has(element.id), false, `${prefix}.id must be unique`);
    ids.add(element.id);
    assert.ok(["text", "barcode", "container"].includes(element.type));
    for (const property of ["x", "y", "width", "height"]) {
      assertFiniteNumber(element[property], `${prefix}.${property} must be finite`);
    }
    assert.ok(element.width > 0, `${prefix}.width must be positive`);
    assert.ok(element.height > 0, `${prefix}.height must be positive`);
    assert.ok(element.x >= 0, `${prefix} must start inside the page`);
    assert.ok(element.y >= 0, `${prefix} must start inside the page`);
    assert.ok(
      element.x + element.width <= layout.page.width,
      `${prefix} must not exceed page width`
    );
    assert.ok(
      element.y + element.height <= layout.page.height,
      `${prefix} must not exceed page height`
    );
  }
}

function rotatedPage(width, height, rotation) {
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

function rotatedBoundingBox(element, page, rotation) {
  const { x, y, width, height } = element;
  if (rotation === 90) {
    return [page.height - y - height, x, height, width];
  }
  if (rotation === 180) {
    return [page.width - x - width, page.height - y - height, width, height];
  }
  if (rotation === 270) {
    return [y, page.width - x - width, height, width];
  }
  return [x, y, width, height];
}

function decodeDataUri(dataUri) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri);
  assert.ok(match, "background must be a base64 Data URI");
  return { mimeType: match[1], bytes: Buffer.from(match[2], "base64") };
}

const manifest = await readJson(path.join(testsDirectory, "manifest.json"));

test("manifest lists unique and loadable fixture cases", async () => {
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.cases));
  assert.equal(manifest.cases.length, 4);
  const ids = manifest.cases.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const caseId of ids) {
    const fixture = await loadCase(caseId);
    assertV1Layout(caseId, fixture.layout, fixture.records);
    assert.equal(typeof fixture.expected, "object");
  }
});

test("v1 minimal fixture establishes the compatibility baseline", async () => {
  const { layout, expected } = await loadCase("v1-minimal");
  assert.equal(expected.mustLoadWithoutManualMigration, true);
  assert.equal(layout.version, expected.contractVersion);
  assert.equal(layout.unit, expected.canonicalUnit);
  assert.deepEqual(layout.page, expected.page);
  assert.equal(layout.elements.length, expected.elementCount);
  assert.equal(layout.background, expected.background);
  assert.deepEqual(JSON.parse(JSON.stringify(layout)), layout);
});

test("v1 Data URI survives JSON and v1-to-v2 background round-trips exactly", async () => {
  const { layout, expected } = await loadCase("v1-background-data-uri");
  assert.equal(layout.background, expected.dataUri);

  const jsonRoundTrip = JSON.parse(JSON.stringify(layout));
  assert.equal(jsonRoundTrip.background, expected.dataUri);

  const normalizedV2Background = { dataUrl: layout.background };
  assert.equal(normalizedV2Background.dataUrl, expected.dataUri);
  assert.equal(expected.roundTrip.mustPreserveExactDataUri, true);
  assert.equal(expected.roundTrip.v2Path, "background.dataUrl");

  const decoded = decodeDataUri(layout.background);
  assert.equal(decoded.mimeType, expected.decodedImage.mimeType);
  assert.equal(decoded.bytes.length, expected.decodedImage.byteLength);
  assert.deepEqual(
    [...decoded.bytes.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10]
  );
  assert.equal(decoded.bytes.toString("ascii", 12, 16), "IHDR");
  assert.equal(decoded.bytes.readUInt32BE(16), expected.decodedImage.width);
  assert.equal(decoded.bytes.readUInt32BE(20), expected.decodedImage.height);
});

test("asymmetric fixture fixes page, matrix and bounding-box rotation oracles", async () => {
  const { layout, expected } = await loadCase("v1-asymmetric-rotation");
  const sourcePage = {
    width: layout.page.width,
    height: layout.page.height
  };
  assert.deepEqual(sourcePage, expected.sourcePage);

  const matrices = {
    0: [1, 0, 0, 1, 0, 0],
    90: [0, 1, -1, 0, sourcePage.height, 0],
    180: [-1, 0, 0, -1, sourcePage.width, sourcePage.height],
    270: [0, -1, 1, 0, 0, sourcePage.width]
  };

  for (const rotation of [0, 90, 180, 270]) {
    const oracle = expected.rotations[String(rotation)];
    assert.deepEqual(
      rotatedPage(sourcePage.width, sourcePage.height, rotation),
      oracle.page
    );
    assert.deepEqual(matrices[rotation], oracle.matrix);

    for (const element of layout.elements) {
      assert.deepEqual(
        rotatedBoundingBox(element, sourcePage, rotation),
        oracle.boxes[element.id],
        `${element.id} bounding box at ${rotation} degrees`
      );
    }
  }

  const ownRotation = layout.elements.find(
    (element) => element.id === expected.elementRotationArgument.elementId
  );
  assert.ok(ownRotation);
  assert.equal(ownRotation.rotation, expected.elementRotationArgument.degrees);
  assert.equal(
    expected.elementRotationArgument.mustRemainRelativeAtEveryPageRotation,
    true
  );
});

test("produto regression has 16.03 x 1 mm useful area and an 8 pt floor", async () => {
  const { layout, expected } = await loadCase("v1-product-min-font");
  const product = layout.elements.find(
    (element) => element.id === expected.elementId
  );
  assert.ok(product);

  const usefulBox = {
    width: product.width - product.padding * 2,
    height: product.height - product.padding * 2
  };
  assert.deepEqual(usefulBox, expected.usefulBox);
  assert.equal(product.fontSize, expected.font.requestedSize);
  assert.equal(product.minFontSize, expected.font.minimumSize);
  assert.equal(expected.font.expectedFinalSize, product.minFontSize);
  assert.equal(expected.font.mustNeverGoBelowMinimum, true);

  const millimetresPerPoint = 25.4 / 72;
  const minimumContentHeight =
    product.minFontSize * millimetresPerPoint * product.lineHeightFactor;
  const minimumBoxHeight = minimumContentHeight + product.padding * 2;
  assert.ok(
    Math.abs(
      minimumContentHeight - expected.fit.minimumSingleLineContentHeight
    ) < 0.00001
  );
  assert.ok(
    Math.abs(minimumBoxHeight - expected.fit.minimumBoxHeightWithPadding) <
      0.00001
  );
  assert.ok(minimumContentHeight > usefulBox.height);
  assert.equal(expected.fit.fitsAtMinimum, false);
  assert.equal(expected.fit.mustReportOverflow, true);

  const requiredIssueFields = new Set(
    expected.validationIssue.requiredFields
  );
  for (const field of [
    "code",
    "severity",
    "path",
    "elementId",
    "message",
    "suggestion"
  ]) {
    assert.equal(requiredIssueFields.has(field), true);
  }
});
