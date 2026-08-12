import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import vm from "node:vm";

const featurePath = resolve(
    "src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.exifreader.tlpp"
);
const featureSource = await readFile(featurePath, "utf8");
const runtimeSource = [...featureSource.matchAll(
    /beginContent var cRuntime\s*([\s\S]*?)\s*endContent/g
)].map((match) => match[1]).find((source) =>
    source.includes("ImageMetadata") && source.includes("ExifReader")
) || "";

function tag(value, description = String(value)) {
    return {value, computed: value, description};
}

function createHarness(tags, {withLibrary = true, loadError = null} = {}) {
    const calls = [];
    const window = {setTimeout};
    if (withLibrary) {
        window.ExifReader = {
            load(source, options) {
                calls.push({source, options});
                if (loadError) throw loadError;
                return tags;
            }
        };
    }
    const context = vm.createContext({
        window, Promise, Date, Error, Number, Object, Array, String,
        Math, ArrayBuffer, Uint8Array, setTimeout, clearTimeout
    });
    vm.runInContext(runtimeSource, context);
    return {window, calls};
}

test("ExifReader is a generic pinned FWWebEx feature", () => {
    assert.match(featureSource, /class WebExFeatureExifReader from WebExControl/);
    assert.match(featureSource, /exifreader@4\.42\.0\/dist\/exif-reader\.js/);
    assert.match(featureSource, /jObjectsContainer\["script-exifreader"\]/);
    assert.match(featureSource, /jObjectsContainer\["script-exifreader-runtime"\]/);
    assert.match(featureSource, /SetContent\(cRuntime,\s*\.F\.\)/);
    assert.doesNotMatch(featureSource, /FWWebExLabels|WebExLabelDesigner/);
});

test("public API exposes readiness, transparent load and typed dependency errors", async () => {
    const tags = {file: {FileType: tag("png", "PNG")}};
    const ready = createHarness(tags);
    const api = ready.window.FWWebEx.ImageMetadata.ExifReader;

    assert.equal(api.version, "4.42.0");
    assert.equal(api.isReady(), true);
    assert.equal(api.getLibrary(), ready.window.ExifReader);
    assert.equal(await api.whenReady(0), api);
    assert.equal(await api.load(new Uint8Array([1, 2, 3])), tags);
    assert.equal(ready.calls[0].options.expanded, true);
    assert.equal(ready.calls[0].options.computed, true);

    const missing = createHarness({}, {withLibrary: false});
    const missingApi = missing.window.FWWebEx.ImageMetadata.ExifReader;
    assert.equal(missingApi.isReady(), false);
    assert.throws(
        () => missingApi.getLibrary(),
        (error) =>
            error.name === "FWWebExImageMetadataDependencyError" &&
            error.code === "FWIMAGEMETADATA_EXIFREADER_DEPENDENCY_MISSING"
    );
    await assert.rejects(
        missingApi.whenReady(0),
        (error) => error.code === "FWIMAGEMETADATA_EXIFREADER_DEPENDENCY_MISSING"
    );
});

test("runtime initialization is idempotent for the same pinned version", () => {
    const {window} = createHarness({});
    const first = window.FWWebEx.ImageMetadata.ExifReader;
    const context = vm.createContext({
        window, Promise, Date, Error, Number, Object, Array, String,
        Math, ArrayBuffer, Uint8Array, setTimeout, clearTimeout
    });
    vm.runInContext(runtimeSource, context);
    assert.equal(window.FWWebEx.ImageMetadata.ExifReader, first);
    assert.equal(first.version, "4.42.0");
});

test("PNG pHYs is normalized to DPI, millimeters and flat aliases", async () => {
    const tags = {
        file: {FileType: tag("png", "PNG")},
        pngFile: {
            "Image Width": tag(1000, "1000px"),
            "Image Height": tag(500, "500px")
        },
        png: {
            "Pixels Per Unit X": tag(10000),
            "Pixels Per Unit Y": tag(10000),
            "Pixel Units": tag(1, "meters")
        }
    };
    const {window, calls} = createHarness(tags);
    const metadata = await window.FWWebEx.ImageMetadata.ExifReader.inspect(
        {type: "image/png"}, {includeRaw: true, expanded: false, computed: false}
    );

    assert.equal(metadata.provider, "ExifReader");
    assert.equal(metadata.providerVersion, "4.42.0");
    assert.equal(metadata.format, "png");
    assert.equal(metadata.mimeType, "image/png");
    assert.equal(metadata.pixelWidth, 1000);
    assert.equal(metadata.pixelHeight, 500);
    assert.equal(metadata.dpiX, 254);
    assert.equal(metadata.dpiY, 254);
    assert.equal(metadata.physicalWidthMm, 100);
    assert.equal(metadata.physicalHeightMm, 50);
    assert.equal(metadata.resolutionSource, "png-pHYs");
    assert.equal(metadata.resolution.dpiX, metadata.dpiX);
    assert.equal(metadata.physicalSize.widthMm, metadata.physicalWidthMm);
    assert.equal(metadata.raw, tags);
    assert.equal(metadata.warnings.length, 0);
    assert.equal(calls[0].options.expanded, true,
        "inspect() must always request grouped tags from ExifReader");
    assert.equal(calls[0].options.computed, true);
});

test("JPEG prefers EXIF, reports JFIF conflict and applies orientations 5 to 8", async () => {
    const tags = {
        file: {
            FileType: tag("jpeg", "JPEG"),
            "Image Width": tag(1200, "1200px"),
            "Image Height": tag(600, "600px")
        },
        exif: {
            Orientation: tag(5),
            XResolution: {value: [[300, 1]], computed: 300, description: "300"},
            YResolution: {value: [[150, 1]], computed: 150, description: "150"},
            ResolutionUnit: tag(2, "inches")
        },
        jfif: {
            XResolution: tag(72),
            YResolution: tag(72),
            "Resolution Unit": tag(1, "inches")
        }
    };
    const {window} = createHarness(tags);
    const api = window.FWWebEx.ImageMetadata.ExifReader;

    for (const orientation of [5, 6, 7, 8]) {
        tags.exif.Orientation = tag(orientation);
        const metadata = await api.inspect(new ArrayBuffer(16));
        assert.equal(metadata.orientation, orientation);
        assert.equal(metadata.orientationSwapsAxes, true);
        assert.equal(metadata.storedPixelWidth, 1200);
        assert.equal(metadata.storedPixelHeight, 600);
        assert.equal(metadata.pixelWidth, 600);
        assert.equal(metadata.pixelHeight, 1200);
        assert.equal(metadata.storedDpiX, 300);
        assert.equal(metadata.storedDpiY, 150);
        assert.equal(metadata.dpiX, 150);
        assert.equal(metadata.dpiY, 300);
        assert.equal(metadata.physicalWidthMm, 101.6);
        assert.equal(metadata.physicalHeightMm, 101.6);
        assert.equal(metadata.resolutionSource, "exif");
        assert.ok(metadata.warnings.some((item) =>
            item.code === "FWIMAGEMETADATA_RESOLUTION_CONFLICT"));
        assert.ok(metadata.warnings.some((item) =>
            item.code === "FWIMAGEMETADATA_NON_SQUARE_PIXELS"));
    }
});

test("JPEG JFIF centimeters and WebP EXIF are supported as fallbacks", async () => {
    const jpegTags = {
        file: {
            FileType: tag("jpeg", "JPEG"),
            "Image Width": tag(2540),
            "Image Height": tag(1270)
        },
        jfif: {
            XResolution: tag(100),
            YResolution: tag(100),
            "Resolution Unit": tag(2, "cm")
        }
    };
    const jpeg = createHarness(jpegTags);
    const jpegMetadata = await jpeg.window.FWWebEx.ImageMetadata.ExifReader.inspect({});
    assert.equal(jpegMetadata.resolutionSource, "jpeg-jfif");
    assert.equal(jpegMetadata.dpiX, 254);
    assert.equal(jpegMetadata.physicalWidthMm, 254);

    const webpTags = {
        file: {FileType: tag("webp", "WebP")},
        riff: {ImageWidth: tag(800), ImageHeight: tag(1200)},
        exif: {
            Orientation: tag(8),
            XResolution: tag(200), YResolution: tag(100),
            ResolutionUnit: tag(2, "inches")
        }
    };
    const webp = createHarness(webpTags);
    const webpMetadata = await webp.window.FWWebEx.ImageMetadata.ExifReader.inspect(
        {type: "image/webp"}
    );
    assert.equal(webpMetadata.format, "webp");
    assert.equal(webpMetadata.pixelWidth, 1200);
    assert.equal(webpMetadata.pixelHeight, 800);
    assert.equal(webpMetadata.dpiX, 100);
    assert.equal(webpMetadata.dpiY, 200);
    assert.equal(webpMetadata.resolutionSource, "exif");
});

test("missing physical resolution is a warning and failures are typed", async () => {
    const tags = {
        file: {
            FileType: tag("jpeg", "JPEG"),
            "Image Width": tag(640), "Image Height": tag(480)
        }
    };
    const valid = createHarness(tags);
    const api = valid.window.FWWebEx.ImageMetadata.ExifReader;
    const metadata = await api.inspect(new ArrayBuffer(4));
    assert.equal(metadata.dpiX, null);
    assert.equal(metadata.physicalWidthMm, null);
    assert.ok(metadata.warnings.some((item) =>
        item.code === "FWIMAGEMETADATA_RESOLUTION_MISSING"));
    tags.exif = {Orientation: tag(0)};
    const invalidOrientation = await api.inspect(new ArrayBuffer(4));
    assert.equal(invalidOrientation.orientation, 1);
    assert.ok(invalidOrientation.warnings.some((item) =>
        item.code === "FWIMAGEMETADATA_ORIENTATION_INVALID"));
    await assert.rejects(
        api.inspect(null),
        (error) =>
            error.name === "FWWebExImageMetadataSourceError" &&
            error.code === "FWIMAGEMETADATA_SOURCE_INVALID"
    );

    const broken = createHarness({}, {loadError: new Error("arquivo truncado")});
    await assert.rejects(
        broken.window.FWWebEx.ImageMetadata.ExifReader.inspect(new ArrayBuffer(4)),
        (error) =>
            error.name === "FWWebExImageMetadataReadError" &&
            error.code === "FWIMAGEMETADATA_READ_FAILED" &&
            /truncado/.test(error.message)
    );
});

test("runtime initialization rejects a conflicting FWWebEx feature version", () => {
    const window = {
        FWWebEx: {ImageMetadata: {ExifReader: {__fwwebexExifReaderVersion: "0.0.0"}}},
        ExifReader: {load() {}}, setTimeout
    };
    const context = vm.createContext({
        window, Promise, Date, Error, Number, Object, Array, String, Math, setTimeout
    });
    assert.throws(
        () => vm.runInContext(runtimeSource, context),
        (error) =>
            error.name === "FWWebExImageMetadataDependencyError" &&
            error.code === "FWIMAGEMETADATA_EXIFREADER_VERSION_CONFLICT"
    );
});
