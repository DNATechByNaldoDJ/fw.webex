import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import vm from "node:vm";

const featurePath = resolve(
    "src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.pdfjs.tlpp"
);
const labelsPath = resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.labels.tlpp"
);

async function optionalSource(path) {
    try {
        return await readFile(path, "utf8");
    } catch (error) {
        if (error && error.code === "ENOENT") return "";
        throw error;
    }
}

const featureSource = await optionalSource(featurePath);
const labelsSource = await readFile(labelsPath, "utf8");
const runtimes = [...featureSource.matchAll(
    /beginContent var cRuntime\s*([\s\S]*?)\s*endContent/g
)].map((match) => match[1]);
const runtimeSource = runtimes.find((source) =>
    source.includes("FWWebEx") && source.includes("PDFViewer")
) || "";

function makeCanvas() {
    const context = {canvas: null};
    const canvas = {
        width: 0,
        height: 0,
        style: {},
        getContext(kind) {
            assert.equal(kind, "2d");
            return context;
        }
    };
    context.canvas = canvas;
    return {canvas, context};
}

function createRuntimeHarness({withLibrary = true} = {}) {
    const calls = {
        documents: [],
        pages: [],
        viewports: [],
        renders: [],
        loadingDestroy: 0,
        documentDestroy: 0,
        pageCleanup: 0
    };
    const page = {
        getViewport(options) {
            calls.viewports.push({...options});
            const scale = Number(options.scale) || 1;
            const rotation = Number(options.rotation) || 0;
            const swap = rotation === 90 || rotation === 270;
            return {
                width: (swap ? 60 : 100) * scale,
                height: (swap ? 100 : 60) * scale,
                scale,
                rotation
            };
        },
        render(options) {
            calls.renders.push(options);
            return {
                promise: Promise.resolve(),
                cancel() {}
            };
        },
        cleanup() {
            calls.pageCleanup += 1;
        }
    };
    const documentHandle = {
        numPages: 1,
        async getPage(pageNumber) {
            calls.pages.push(pageNumber);
            return page;
        },
        async destroy() {
            calls.documentDestroy += 1;
        }
    };
    const pdfjsLib = {
        version: "3.11.174",
        GlobalWorkerOptions: {},
        getDocument(options) {
            calls.documents.push(options);
            return {
                promise: Promise.resolve(documentHandle),
                destroy() {
                    calls.loadingDestroy += 1;
                }
            };
        }
    };
    const window = {setTimeout};
    if (withLibrary) window.pdfjsLib = pdfjsLib;
    const context = vm.createContext({
        window,
        Promise,
        Date,
        Error,
        Number,
        Object,
        ArrayBuffer,
        Uint8Array,
        AbortController,
        DOMException,
        setTimeout,
        clearTimeout
    });
    if (runtimeSource) vm.runInContext(runtimeSource, context);
    return {window, calls, page, documentHandle};
}

test("PDF.js is a generic, separately pinned FWWebEx feature", () => {
    assert.ok(featureSource, "fw.webex.feature.pdfjs.tlpp must exist");
    assert.ok(/class WebExFeaturePDFJS from WebExControl/i.test(featureSource),
        "WebExFeaturePDFJS class must be declared");
    assert.ok(
        /pdfjs-dist@3\.11\.174\/build\/pdf(?:\.min)?\.js/i.test(featureSource),
        "the PDF.js main asset must be pinned to 3.11.174"
    );
    assert.ok(
        /pdfjs-dist@3\.11\.174\/build\/pdf\.worker(?:\.min)?\.js/i
            .test(featureSource),
        "the PDF.js worker must use the same pinned version"
    );
    assert.ok(/script-pdfjs/i.test(featureSource),
        "the global PDF.js script must have a stable feature ID");
    assert.ok(/script-pdfjs-runtime/i.test(featureSource),
        "the PDFViewer runtime must have a stable feature ID");
    assert.ok(/SetContent\(cRuntime,\s*\.F\.\)/.test(featureSource),
        "the runtime must be registered as inline script content");
    assert.equal(/FWWebExLabels|WebExLabelDesigner/.test(featureSource), false,
        "the generic feature cannot depend on Labels");
    assert.equal(
        /pdfjs-dist@|cdnjs[^\n]*pdf\.js|pdf\.worker(?:\.min)?\.js/i
            .test(labelsSource),
        false,
        "Labels must not own PDF.js CDN URLs"
    );
});

test("FWWebEx.PDFViewer exposes readiness, loading and rendering contracts", async () => {
    assert.ok(runtimeSource, "PDFViewer runtime must be embedded in the feature");
    const {window, calls} = createRuntimeHarness();
    const api = window.FWWebEx && window.FWWebEx.PDFViewer;

    assert.ok(api, "FWWebEx.PDFViewer must be initialized");
    assert.equal(api.version, "3.11.174");
    assert.equal(typeof api.workerSrc, "string");
    assert.match(api.workerSrc, /pdf\.worker(?:\.min)?\.js/i);
    assert.equal(window.pdfjsLib.GlobalWorkerOptions.workerSrc, api.workerSrc);
    assert.equal(api.isReady(), true);
    assert.equal(api.getLibrary(), window.pdfjsLib);
    assert.equal(await api.whenReady(0), api);

    const bytes = new Uint8Array([37, 80, 68, 70]);
    const loaded = await api.load(bytes);
    assert.ok(
        loaded === calls.documents[0] || loaded.numPages === 1 ||
            loaded.document === calls.documents[0],
        "load() must resolve a usable PDF document/handle"
    );
    assert.equal(calls.documents.length, 1);
    assert.notEqual(calls.documents[0].data, bytes,
        "load() must not transfer ownership of the caller's TypedArray");
    assert.deepEqual([...calls.documents[0].data], [...bytes]);
});

test("renderPage paints an ArrayBuffer on the caller canvas and returns metrics", async () => {
    assert.ok(runtimeSource, "PDFViewer runtime must be embedded in the feature");
    const {window, calls} = createRuntimeHarness();
    const api = window.FWWebEx.PDFViewer;
    const {canvas, context} = makeCanvas();
    const source = new Uint8Array([37, 80, 68, 70]).buffer;

    const result = await api.renderPage(source, {
        canvas,
        pageNumber: 1,
        scale: 2,
        rotation: 90
    });

    assert.equal(calls.documents.length, 1);
    assert.equal(calls.pages[0], 1);
    assert.deepEqual(
        JSON.parse(JSON.stringify(calls.viewports[0])),
        {scale: 2, rotation: 90}
    );
    assert.equal(calls.renders[0].canvasContext, context);
    assert.equal(calls.renders[0].viewport.width, 120);
    assert.equal(calls.renders[0].viewport.height, 200);
    assert.equal(canvas.width, 120);
    assert.equal(canvas.height, 200);
    assert.equal(result.canvas, canvas);
    assert.equal(result.width, 120);
    assert.equal(result.height, 200);
    assert.equal(result.scale, 2);
    assert.equal(typeof result.destroy, "function");

    await result.destroy();
    assert.ok(calls.documentDestroy + calls.loadingDestroy >= 1,
        "destroy() must release the PDF.js document/loading task");
});

test("target dimensions preserve aspect ratio and missing PDF.js is descriptive", async () => {
    assert.ok(runtimeSource, "PDFViewer runtime must be embedded in the feature");
    const ready = createRuntimeHarness();
    const {canvas} = makeCanvas();
    const result = await ready.window.FWWebEx.PDFViewer.renderPage(
        new Uint8Array([1, 2, 3]),
        {canvas, targetWidth: 250, targetHeight: 100}
    );
    assert.ok(Math.abs(result.width - (100 / 0.6)) < 1e-7);
    assert.ok(Math.abs(result.height - 100) < 1e-7);

    const missing = createRuntimeHarness({withLibrary: false});
    const api = missing.window.FWWebEx.PDFViewer;
    assert.equal(api.isReady(), false);
    assert.throws(
        () => api.getLibrary(),
        (error) =>
            /PDF(?:JS|Viewer).*DependencyError/i.test(error.name) &&
            /DEPENDENCY_MISSING/.test(error.code) &&
            /PDF\.js/i.test(error.message)
    );
    await assert.rejects(
        api.whenReady(0),
        (error) => /DEPENDENCY_MISSING/.test(error.code) && /PDF\.js/i.test(error.message)
    );
});
