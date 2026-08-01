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

class FakePDF {
    constructor() {
        this.textCalls = [];
    }

    setTextColor() {}
    setDrawColor() {}
    setFillColor() {}
    setFont() {}
    setFontSize() {}
    setCharSpace() {}
    setLineWidth() {}
    addPage() {}
    saveGraphicsState() {}
    restoreGraphicsState() {}
    setCurrentTransformationMatrix() {}
    save() {}

    splitTextToSize(value) {
        return [String(value)];
    }

    getTextWidth(value) {
        return String(value).length;
    }

    text(lines, x, y, options) {
        this.textCalls.push({lines: plain(lines), x, y, options: plain(options)});
    }

    output(kind) {
        return {kind};
    }

    advancedAPI(callback) {
        callback(this);
    }
}

function loadRuntime() {
    const root = {};
    const context = vm.createContext({
        console,
        document: {
            getElementById: () => root,
            createElement: () => ({})
        },
        window: {
            FWWebEx: {
                PDF: {
                    isReady: () => true,
                    create: () => new FakePDF()
                }
            }
        }
    });

    vm.runInContext(generatorSource, context);
    const labels = context.window.FWWebExLabels;
    return {
        api: {
            generate: labels.renderer.generate,
            normalize: labels.contract.normalize,
            serialize: labels.contract.serialize,
            validate: labels.contract.validate,
            resolveLayout: labels.layout.resolve,
            layout: labels.layout
        },
        context
    };
}

function baseLayout(overrides = {}) {
    return {
        schema: "fwwebex.labels",
        version: 2,
        name: "contract-test",
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

function textElement(id, template, box = {x: 1, y: 1, width: 20, height: 5}) {
    return {
        id,
        type: "text",
        template,
        box,
        rotation: 0,
        zIndex: 0,
        locked: false,
        hidden: false,
        containerId: null,
        style: {
            fontFamily: "helvetica",
            fontSize: 8,
            minFontSize: 4,
            fontStyle: "normal",
            color: "#000000",
            lineHeightFactor: 1,
            letterSpacing: 0,
            align: "left",
            verticalAlign: "top",
            padding: 0,
            margin: 0
        },
        fit: {mode: "none", maxLines: 1, overflow: "error"},
        textOptions: {}
    };
}

test("normalize and validate do not mutate caller-owned layout or records", () => {
    const {api} = loadRuntime();
    const layout = baseLayout({
        background: {
            dataUrl: "data:image/png;base64,AAAA",
            fit: "contain",
            opacity: 0.75,
            locked: false
        },
        variables: [{name: "produto.codigo", required: true, default: "PADRAO"}],
        elements: [textElement("produto", "{{produto.codigo}}")]
    });
    const records = [{produto: {codigo: "ABC"}}];
    const layoutSnapshot = JSON.stringify(layout);
    const recordsSnapshot = JSON.stringify(records);

    const normalized = api.normalize(layout);
    const report = api.validate(layout, records);

    assert.equal(JSON.stringify(layout), layoutSnapshot);
    assert.equal(JSON.stringify(records), recordsSnapshot);
    assert.notEqual(normalized, layout);
    assert.notEqual(normalized.page, layout.page);
    assert.notEqual(report.layout, layout);
});

test("editor metadata never changes validation metrics or PDF content", async () => {
    const {api} = loadRuntime();
    const layout = baseLayout({
        variables: [{name: "produto", type: "string", required: true}],
        elements: [textElement("produto", "{{produto}}")]
    });
    const edited = plain(layout);
    edited.editor = {
        grid: {enabled: true, step: 7},
        snap: {
            enabled: true,
            tolerancePx: 40,
            referenceElementId: "produto",
            chainMode: true
        },
        guides: [{axis: "x", position: 42}],
        foreign: {ignored: true}
    };

    const first = await api.generate(layout, {produto: "DETERGENTE"}, {
        output: "none", returnResult: true
    });
    const second = await api.generate(edited, {produto: "DETERGENTE"}, {
        output: "none", returnResult: true
    });

    assert.deepEqual(plain(second.report.metrics), plain(first.report.metrics));
    assert.deepEqual(second.pdf.textCalls, first.pdf.textCalls);
});

test("background original-size mode offered by the designer is valid", () => {
    const {api} = loadRuntime();
    const report = api.validate(baseLayout({
        background: {
            dataUrl: "data:image/png;base64,AAAA",
            fit: "none",
            opacity: 1,
            locked: true
        }
    }), []);

    assert.equal(
        report.issues.some((item) => item.code === "BACKGROUND_FIT_INVALID"),
        false
    );
});

test("generation applies a nested default without mutating the input record", async () => {
    const {api} = loadRuntime();
    const layout = baseLayout({
        variables: [{
            name: "produto.codigo",
            type: "string",
            required: true,
            default: "SKU-PADRAO"
        }],
        elements: [textElement("produto", "{{produto.codigo}}")]
    });
    const record = {};

    const pdf = await api.generate(layout, record, {});

    assert.deepEqual(record, {});
    assert.equal(pdf.textCalls.length, 1);
    assert.deepEqual(pdf.textCalls[0].lines, ["SKU-PADRAO"]);
});

test("future contract versions and foreign schemas are rejected", () => {
    const {api} = loadRuntime();
    let futureError = null;
    let foreignError = null;

    try {
        api.normalize(baseLayout({version: 3}));
    } catch (error) {
        futureError = error;
    }
    try {
        api.normalize(baseLayout({schema: "another.labels"}));
    } catch (error) {
        foreignError = error;
    }

    assert.equal(futureError?.code, "CONTRACT_VERSION_UNSUPPORTED");
    assert.equal(futureError?.issues?.[0]?.path, "/version");
    assert.equal(foreignError?.code, "CONTRACT_SCHEMA_INVALID");
    assert.equal(foreignError?.issues?.[0]?.path, "/schema");
});

test("unsafe variable and template paths are rejected before resolution", async () => {
    const {api, context} = loadRuntime();
    const unsafeNames = [
        "__proto__.polluted",
        "produto.constructor.polluted",
        "produto.prototype.polluted"
    ];
    const layout = baseLayout({
        variables: unsafeNames.map((name) => ({
            name,
            required: false,
            default: "nao-deve-ser-aplicado"
        })),
        elements: unsafeNames.map((name, index) =>
            textElement(`unsafe-${index}`, `{{${name}}}`, {
                x: 1,
                y: 1 + index * 6,
                width: 30,
                height: 5
            })
        )
    });

    const report = api.validate(layout, {});
    const unsafeIssues = report.errors.filter((item) =>
        item.code === "VARIABLE_PATH_UNSAFE"
    );
    let generationError = null;

    try {
        await api.generate(layout, {}, {});
    } catch (error) {
        generationError = error;
    }

    assert.equal(report.valid, false);
    assert.ok(unsafeIssues.length >= unsafeNames.length);
    for (const path of [
        "/variables/0/name",
        "/variables/1/name",
        "/variables/2/name"
    ]) {
        assert.ok(unsafeIssues.some((item) => item.path === path));
    }
    assert.ok(generationError, "generation must stop before applying defaults");
    assert.equal(vm.runInContext("({}).polluted", context), undefined);
});

test("all structured issue paths use RFC 6901 JSON Pointer", () => {
    const {api} = loadRuntime();
    const report = api.validate(baseLayout({
        variables: [{name: "produto.codigo", required: true}],
        elements: [
            textElement("duplicado", "{{produto.codigo}}"),
            textElement("duplicado", "{{naoDeclarada}}", {
                x: 95,
                y: 1,
                width: 10,
                height: 5
            })
        ]
    }), {});

    assert.ok(report.issues.length > 0);
    assert.ok(report.issues.every((item) =>
        item.path === "" ||
        (/^(?:\/(?:[^~/]|~0|~1)*)+$/.test(item.path) &&
            !item.path.includes("[") &&
            !item.path.includes("."))
    ));
    assert.equal(
        report.errors.find((item) => item.code === "ELEMENT_ID_DUPLICATE").path,
        "/elements/1/id"
    );
    assert.equal(
        report.errors.find((item) => item.code === "ELEMENT_OUTSIDE_PAGE").path,
        "/elements/1/box"
    );
    assert.equal(
        report.errors.find((item) =>
            item.code === "VARIABLE_REQUIRED_MISSING"
        ).path,
        "/variables/0"
    );
});

test("normalization preserves independent padding and margin sides", () => {
    const {api} = loadRuntime();
    const normalized = api.normalize(baseLayout({
        elements: [{
            ...textElement("texto", "{{texto}}"),
            style: {
                ...textElement("modelo", "").style,
                padding: {top: 1, right: 2, bottom: 3, left: 4},
                margin: {top: 5, right: 6, bottom: 7, left: 8}
            }
        }]
    }));

    assert.deepEqual(plain(normalized.elements[0].style.padding), {
        top: 1,
        right: 2,
        bottom: 3,
        left: 4
    });
    assert.deepEqual(plain(normalized.elements[0].style.margin), {
        top: 5,
        right: 6,
        bottom: 7,
        left: 8
    });
});

test("normalization supports horizontal and vertical inset shortcuts", () => {
    const {api} = loadRuntime();
    const normalized = api.normalize(baseLayout({
        elements: [{
            ...textElement("texto", "{{texto}}"),
            style: {
                ...textElement("modelo", "").style,
                padding: {x: 2, y: 1},
                margin: {x: 4, y: 3}
            }
        }]
    }));

    assert.deepEqual(plain(normalized.elements[0].style.padding), {
        top: 1, right: 2, bottom: 1, left: 2
    });
    assert.deepEqual(plain(normalized.elements[0].style.margin), {
        top: 3, right: 4, bottom: 3, left: 4
    });
});

test("v1 child encounter order becomes explicit during migration", () => {
    const {api} = loadRuntime();
    const normalized = api.normalize({
        version: 1,
        page: {width: 100, height: 60, rotation: 0},
        elements: [
            {
                id: "area",
                type: "container",
                x: 1,
                y: 1,
                width: 50,
                height: 40,
                direction: "vertical"
            },
            {
                id: "segundo-no-fluxo",
                type: "text",
                value: "{{segundo}}",
                containerId: "area",
                x: 2,
                y: 10,
                width: 20,
                height: 5
            },
            {
                id: "terceiro-no-fluxo",
                type: "text",
                value: "{{terceiro}}",
                containerId: "area",
                x: 2,
                y: 20,
                width: 20,
                height: 5
            }
        ]
    });

    assert.deepEqual(plain(normalized.elements[0].layout.children), [
        "segundo-no-fluxo",
        "terceiro-no-fluxo"
    ]);
});

test("v2 explicit child order survives normalization exactly", () => {
    const {api} = loadRuntime();
    const container = {
        id: "area",
        type: "container",
        box: {x: 1, y: 1, width: 50, height: 40},
        layout: {
            direction: "vertical",
            padding: 0,
            gap: 1,
            crossAlign: "start",
            mainAlign: "start",
            sizing: "none",
            overflow: "error",
            clipChildren: false,
            children: ["produto", "codigo"]
        }
    };
    const normalized = api.normalize(baseLayout({
        elements: [
            container,
            {...textElement("codigo", "{{codigo}}"), containerId: "area"},
            {...textElement("produto", "{{produto}}"), containerId: "area"}
        ]
    }));

    assert.deepEqual(plain(normalized.elements[0].layout.children), [
        "produto",
        "codigo"
    ]);
});

test("container cycle, empty container and page overflow identify exact nodes", () => {
    const {api} = loadRuntime();
    const container = (id, containerId, children) => ({
        id,
        type: "container",
        containerId,
        box: {x: 1, y: 1, width: 30, height: 20},
        layout: {
            direction: "vertical",
            padding: 0,
            gap: 0,
            crossAlign: "stretch",
            mainAlign: "start",
            sizing: "none",
            overflow: "error",
            clipChildren: false,
            children
        }
    });
    const report = api.validate(baseLayout({
        elements: [
            container("vazio", null, []),
            container("ciclo-a", "ciclo-b", ["ciclo-b"]),
            container("ciclo-b", "ciclo-a", ["ciclo-a"]),
            textElement("fora", "{{fora}}", {
                x: 99,
                y: 59,
                width: 2,
                height: 2
            })
        ]
    }));

    const empty = report.warnings.find((item) => item.code === "CONTAINER_EMPTY");
    const cycle = report.errors.find((item) => item.code === "CONTAINER_CYCLE");
    const outside = report.errors.find((item) =>
        item.code === "ELEMENT_OUTSIDE_PAGE"
    );

    assert.ok(empty);
    assert.equal(empty.elementId, "vazio");
    assert.equal(empty.path, "/elements/0/layout/children");
    assert.ok(cycle);
    assert.ok([
        "/elements/1/containerId",
        "/elements/2/containerId"
    ].includes(cycle.path));
    assert.ok(outside);
    assert.equal(outside.elementId, "fora");
    assert.equal(outside.path, "/elements/3/box");
});

test("nested required values and defaults are validated coherently", () => {
    const {api} = loadRuntime();
    const layout = baseLayout({
        variables: [
            {name: "produto.codigo", required: true},
            {name: "produto.descricao", required: true, default: "SEM DESCRICAO"}
        ],
        elements: [
            textElement("codigo", "{{produto.codigo}}"),
            textElement("descricao", "{{produto.descricao}}", {
                x: 1,
                y: 7,
                width: 30,
                height: 5
            })
        ]
    });

    const valid = api.validate(layout, {
        produto: {codigo: "ABC-123"}
    });
    const missing = api.validate(layout, {produto: {}});

    assert.equal(valid.errors.some((item) =>
        item.code === "VARIABLE_REQUIRED_MISSING"
    ), false);
    assert.equal(missing.errors.filter((item) =>
        item.code === "VARIABLE_REQUIRED_MISSING"
    ).length, 1);
    assert.equal(
        missing.errors.find((item) =>
            item.code === "VARIABLE_REQUIRED_MISSING"
        ).path,
        "/variables/0"
    );
});

test("generation validates the raw v2 contract before applying defaults", async () => {
    const {api} = loadRuntime();
    const raw = baseLayout();
    delete raw.schema;
    raw.page.width = "100";
    let generationError = null;

    try {
        await api.generate(JSON.stringify(raw), {}, {output: "none"});
    } catch (error) {
        generationError = error;
    }

    assert.ok(generationError);
    assert.equal(generationError.name, "FWWebExLabelValidationError");
    assert.ok(generationError.issues.some((item) =>
        item.code === "CONTRACT_SCHEMA_REQUIRED" &&
        item.path === "/schema"
    ));
    assert.ok(generationError.issues.some((item) =>
        item.code === "NUMBER_INVALID" &&
        item.path === "/page/width"
    ));
});

test("invalid layout and data JSON return structured diagnostics", async () => {
    const {api} = loadRuntime();
    const layoutReport = api.validate("{", {});
    const dataReport = api.validate(baseLayout(), "{");
    let generationError = null;

    try {
        await api.generate("{", {}, {output: "none"});
    } catch (error) {
        generationError = error;
    }

    assert.equal(layoutReport.errors[0].code, "CONTRACT_JSON_INVALID");
    assert.equal(dataReport.errors[0].code, "DATA_JSON_INVALID");
    assert.equal(dataReport.errors[0].phase, "data");
    assert.equal(generationError?.code, "CONTRACT_JSON_INVALID");
    assert.ok(generationError?.report);
});

test("nested paths reject empty and unsafe segments", () => {
    const {api} = loadRuntime();
    const report = api.validate(baseLayout({
        variables: [{name: "produto..codigo", required: true}],
        elements: [textElement("produto", "{{produto..codigo}}")]
    }), {produto: {codigo: "ABC"}});

    assert.equal(report.valid, false);
    assert.ok(report.errors.some((item) =>
        item.code === "VARIABLE_PATH_UNSAFE" &&
        item.path === "/variables/0/name"
    ));
    assert.ok(report.errors.some((item) =>
        item.code === "VARIABLE_PATH_UNSAFE" &&
        item.path === "/elements/0/template"
    ));
});

test("equal container sizing aligns against its adjusted total", async () => {
    const {api} = loadRuntime();
    const container = {
        id: "area",
        type: "container",
        box: {x: 1, y: 1, width: 40, height: 40},
        rotation: 0,
        zIndex: 0,
        locked: false,
        hidden: false,
        containerId: null,
        layout: {
            direction: "vertical",
            padding: 1,
            gap: 2,
            crossAlign: "stretch",
            mainAlign: "center",
            sizing: "equal",
            overflow: "error",
            clipChildren: false,
            children: ["primeiro", "segundo"]
        }
    };
    const children = [
        {...textElement("primeiro", "A"), containerId: "area"},
        {...textElement("segundo", "B"), containerId: "area"}
    ];

    const result = await api.generate(baseLayout({
        elements: [container, ...children]
    }), {}, {output: "none", returnResult: true});
    const [first, second] = result.layout.elements.slice(1);

    assert.equal(result.report.errors.some((item) =>
        item.code === "CONTAINER_OVERFLOW"
    ), false);
    assert.deepEqual(plain(first.box), {
        x: 2, y: 2, width: 38, height: 18
    });
    assert.deepEqual(plain(second.box), {
        x: 2, y: 22, width: 38, height: 18
    });
});

test("text margins participate independently in container flow", async () => {
    const {api} = loadRuntime();
    const container = {
        id: "area",
        type: "container",
        box: {x: 0, y: 0, width: 30, height: 30},
        rotation: 0,
        zIndex: 0,
        locked: false,
        hidden: false,
        containerId: null,
        layout: {
            direction: "vertical",
            padding: 1,
            gap: 1,
            crossAlign: "start",
            mainAlign: "start",
            sizing: "none",
            overflow: "error",
            clipChildren: false,
            children: ["primeiro", "segundo"]
        }
    };
    const first = textElement("primeiro", "A");
    first.containerId = "area";
    first.style.margin = {top: 1, right: 0, bottom: 2, left: 3};
    const second = textElement("segundo", "B");
    second.containerId = "area";
    second.style.margin = {top: 2, right: 0, bottom: 1, left: 4};

    const result = await api.generate(baseLayout({
        elements: [container, first, second]
    }), {}, {output: "none", returnResult: true});
    const [, resolvedFirst, resolvedSecond] = result.layout.elements;

    assert.deepEqual(plain(resolvedFirst.box), {
        x: 4, y: 2, width: 20, height: 5
    });
    assert.deepEqual(plain(resolvedSecond.box), {
        x: 5, y: 12, width: 20, height: 5
    });
});

test("malformed templates and AUTO regex rules are rejected structurally", () => {
    const {api} = loadRuntime();
    const report = api.validate(baseLayout({
        barcodeAutoRules: [{
            pattern: "[",
            format: "CODE128"
        }],
        elements: [textElement("produto", "{{produto.codigo")]
    }), {});

    assert.equal(report.valid, false);
    assert.ok(report.errors.some((item) =>
        item.code === "BARCODE_AUTO_PATTERN_INVALID" &&
        item.path === "/barcodeAutoRules/0/pattern"
    ));
    assert.ok(report.errors.some((item) =>
        item.code === "TEMPLATE_SYNTAX_INVALID" &&
        item.path === "/elements/0/template"
    ));
});

test("safe area produces an identifiable warning without clipping", () => {
    const {api} = loadRuntime();
    const layout = baseLayout({
        page: {
            width: 100,
            height: 60,
            rotation: 0,
            margins: {top: 2, right: 3, bottom: 4, left: 5},
            safeArea: 1,
            bleed: 0
        },
        elements: [textElement("borda", "A", {
            x: 1, y: 1, width: 10, height: 5
        })]
    });
    const report = api.validate(layout, {});
    const warning = report.warnings.find((item) =>
        item.code === "ELEMENT_OUTSIDE_SAFE_AREA"
    );

    assert.equal(report.valid, true);
    assert.equal(warning?.elementId, "borda");
    assert.deepEqual(plain(warning?.details.safeBounds), {
        x: 6, y: 3, width: 90, height: 52
    });
});
