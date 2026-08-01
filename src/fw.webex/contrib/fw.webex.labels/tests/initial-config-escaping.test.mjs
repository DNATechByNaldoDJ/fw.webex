import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import vm from "node:vm";

const [helperSource, labelsSource, panelSource] = await Promise.all([
    readFile(resolve(
        "src/fw.webex/core/tools/fw.webex.helper.tlpp"
    ), "utf8"),
    readFile(resolve(
        "src/fw.webex/contrib/fw.webex.labels/fw.webex.labels.tlpp"
    ), "utf8"),
    readFile(resolve(
        "src/fw.webex/contrib/fw.webex.labels/fw.webex.label.generator.panel.tlpp"
    ), "utf8")
]);

function methodBlock(name, argument) {
    const pattern = new RegExp(
        `static method ${name}\\(${argument}\\) class WebExHelper([\\s\\S]*?)`+
        `return\\(${argument}\\)`
    );
    const match = pattern.exec(helperSource);
    assert.ok(match, `${name} implementation was not found`);
    return match[1];
}

function escapeForSingleQuotedScript(value, escapeClosingTag) {
    let escaped = String(value);
    if (escapeClosingTag) escaped = escaped.replaceAll("</", "<\\/");
    return escaped
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'")
        .replaceAll('"', '\\"')
        .replaceAll("\r", "\\r")
        .replaceAll("\n", "\\n");
}

test("TLPP JavaScript escaping uses literal backslash counts", () => {
    const htmlBlock = methodBlock("EscapeHTMLScript", "cHTML");
    const javascriptBlock = methodBlock("EscapeJavaScript", "cScript");
    const expected = [
        String.raw`{"\","\\"}`,
        String.raw`{"'","\'"}`,
        String.raw`{'"','\"'}`,
        String.raw`{__cCHR13,"\r"}`,
        String.raw`{__cCHR10,"\n"}`
    ];

    for (const entry of expected) {
        assert.ok(htmlBlock.includes(entry),
            `EscapeHTMLScript must contain ${entry}`);
        assert.ok(javascriptBlock.includes(entry),
            `EscapeJavaScript must contain ${entry}`);
    }
});

test("initial JSON survives the helper and the browser string parser", () => {
    const simple = '{"rotation":0}';
    const simpleScript = `result='${
        escapeForSingleQuotedScript(simple, true)
    }'; result;`;
    assert.equal(vm.runInNewContext(simpleScript), simple);

    const payload = {
        rotation: 90,
        path: "C:\\totvs\\rotulos\\layout.json",
        description: "Rótulo d'água\nsegunda linha",
        markup: "</script><script>ignored()</script>"
    };
    const json = JSON.stringify(payload, null, 2);
    const escaped = escapeForSingleQuotedScript(json, true);
    const script = `result='${escaped}'; result;`;
    const received = vm.runInNewContext(script);

    assert.deepEqual(JSON.parse(received), payload);
    assert.equal(script.toLowerCase().includes("</script"), false,
        "embedded JSON must not terminate its script element");
});

test("initial configuration errors identify the failing input", () => {
    assert.match(labelsSource,
        /function initialJSON\(source,fallback,label\)/);
    assert.ok(labelsSource.includes(String.raw`initialJSON('__OPTIONS_JSON__',{},"op\u00e7\u00f5es")`));
    assert.ok(labelsSource.includes(String.raw`initialJSON('__RECORDS_JSON__',[],"dados")`));
    assert.ok(labelsSource.includes(String.raw`initialJSON('__LAYOUT_JSON__',null,"layout")`));
    assert.ok(panelSource.includes(String.raw`Configura\u00e7\u00e3o inicial inv\u00e1lida em op\u00e7\u00f5es`));
});
