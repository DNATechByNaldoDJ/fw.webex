import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import vm from "node:vm";

const featureSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.jspdf.tlpp"
), "utf8");
const labelsSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.labels.tlpp"
), "utf8");
const featureCoreSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.features/core/fw.webex.features.tlpp"
), "utf8");

const runtimes = [...featureSource.matchAll(
    /beginContent var cRuntime\s*([\s\S]*?)\s*endContent/g
)].map((match) => match[1]);

test("generic PDF feature owns the pinned jsPDF asset", () => {
    assert.match(featureSource, /class WebExFeatureJsPDF from WebExControl/);
    assert.match(featureSource, /script-jspdf/);
    assert.match(featureSource, /jspdf@4\.2\.1\/dist\/jspdf\.umd\.min\.js/);
    assert.doesNotMatch(labelsSource, /jspdf(?:@|\/)[0-9]/i);
    assert.match(labelsSource, /WebExFeatureJsPDF\(\):Enable\(30\)/);
    assert.match(labelsSource, /window\.FWWebEx&&window\.FWWebEx\.PDF/);
});

test("base runtime exposes the official FWWebEx.PDF namespace", () => {
    class FakePDF {
        constructor(options) {
            this.options = options;
        }

        output(type) {
            return type === "blob" ?
                {type: "application/pdf"} :
                new ArrayBuffer(8);
        }
    }
    const window = {
        jspdf: {jsPDF: FakePDF},
        setTimeout
    };
    const context = vm.createContext({window, Promise, Date, Error, Number});

    vm.runInContext(runtimes[0], context);

    assert.equal(window.FWWebEx.PDF.version, "4.2.1");
    assert.equal(window.FWWebEx.PDF.isReady(), true);
    assert.equal(window.FWWebEx.PDF.getConstructor(), FakePDF);
    const document = window.FWWebEx.PDF.create({unit: "mm"});
    assert.ok(document instanceof FakePDF);
    assert.deepEqual(document.options, {unit: "mm"});
    assert.equal(document.output("blob").type, "application/pdf");
    assert.equal(document.output("arraybuffer").byteLength, 8);
    assert.equal(window.FWWebEx.PDF.renderElement, undefined);
});

test("feature registration and runtime initialization are idempotent", () => {
    class FakePDF {}
    const window = {
        jspdf: {jsPDF: FakePDF},
        setTimeout
    };
    const context = vm.createContext({window, Promise, Date, Error, Number});

    vm.runInContext(runtimes[0], context);
    const namespace = window.FWWebEx.PDF;
    vm.runInContext(runtimes[0], context);

    assert.equal(window.FWWebEx.PDF, namespace);
    assert.equal(window.FWWebEx.PDF.version, "4.2.1");
    assert.match(featureSource, /jObjectsContainer\["script-jspdf"\]/);
    assert.match(featureSource, /SetContent\(cRuntime,\s*\.F\.\)/);
    assert.match(featureCoreSource, /static __jGlobalFeatures/);
    assert.match(featureCoreSource, /cFeatureID:=cClassName/);
});

test("base runtime rejects a conflicting FWWebEx jsPDF version", () => {
    const window = {
        FWWebEx: {
            PDF: {
                __fwwebexJsPDFVersion: "0.0.0"
            }
        },
        setTimeout
    };
    const context = vm.createContext({window, Promise, Date, Error, Number});

    assert.throws(
        () => vm.runInContext(runtimes[0], context),
        (error) =>
            error.name === "FWWebExPDFDependencyError" &&
            error.code === "FWPDF_VERSION_CONFLICT"
    );
});

test("base runtime reports a descriptive missing jsPDF dependency", async () => {
    const window = {setTimeout};
    const context = vm.createContext({window, Promise, Date, Error, Number});

    vm.runInContext(runtimes[0], context);

    assert.equal(window.FWWebEx.PDF.isReady(), false);
    assert.throws(
        () => window.FWWebEx.PDF.getConstructor(),
        (error) =>
            error.name === "FWWebExPDFDependencyError" &&
            error.code === "FWPDF_DEPENDENCY_MISSING" &&
            /jsPDF 4\.2\.1/.test(error.message)
    );
    await assert.rejects(
        window.FWWebEx.PDF.whenReady(0),
        (error) => error.code === "FWPDF_DEPENDENCY_MISSING"
    );
});

test("HTML adapter is opt-in and extends the same namespace", async () => {
    let renderedSource;
    const renderedDocument = {
        html(source, options) {
            renderedSource = source;
            options.callback(this);
            return Promise.resolve(this);
        }
    };
    const window = {
        FWWebEx: {
            PDF: {
                create: () => renderedDocument,
                whenReady: () => Promise.resolve()
            }
        },
        html2canvas() {},
        DOMPurify: {
            sanitize(value) {
                return `sanitized:${value}`;
            }
        },
        setTimeout
    };
    const context = vm.createContext({
        window, Promise, Error, Object, Number, Date
    });

    vm.runInContext(runtimes[1], context);

    assert.equal(window.FWWebEx.PDF.hasHTMLSupport(), true);
    const result = await window.FWWebEx.PDF.renderElement("<h1>Documento</h1>");
    assert.equal(result, renderedDocument);
    assert.equal(renderedSource, "sanitized:<h1>Documento</h1>");
});

test("HTML adapter reports readiness and renderer failures explicitly", async () => {
    const window = {
        FWWebEx: {
            PDF: {
                create: () => ({
                    html() {
                        throw new Error("imagem bloqueada por CORS");
                    }
                }),
                whenReady: () => Promise.resolve()
            }
        },
        html2canvas() {},
        DOMPurify: {
            sanitize(value) {
                return value;
            }
        },
        setTimeout
    };
    const context = vm.createContext({
        window, Promise, Error, Object, Number, Date
    });

    vm.runInContext(runtimes[1], context);

    await assert.rejects(
        window.FWWebEx.PDF.renderElement("<img>"),
        (error) =>
            error.name === "FWWebExPDFRenderError" &&
            error.code === "FWPDF_HTML_RENDER_FAILED" &&
            /CORS/.test(error.message)
    );
});
