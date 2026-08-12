import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import vm from "node:vm";

const labelsSource = await readFile(resolve(
    "src/fw.webex/contrib/fw.webex.labels/fw.webex.labels.tlpp"
), "utf8");

const contents = [...labelsSource.matchAll(
    /beginContent var \w+\s*([\s\S]*?)\s*endContent/g
)].map((match) => match[1]);
const designerSource = contents.find((source) => source.includes(
    "root.__labelDesigner={addText:function"
));
const canonicalRuntimeSource = contents.find((source) =>
    source.includes("function normalizeLayout") &&
    source.includes("window.FWWebExLabels.renderer.generate=generate")
);
const designerStyle = contents.find((source) =>
    source.includes(".fwwebex-label-tablist") &&
    source.includes("@media(min-width:1400px)")
);

assert.ok(designerSource, "embedded Labels designer runtime was not found");
assert.ok(canonicalRuntimeSource, "canonical Labels runtime was not found");
assert.ok(designerStyle, "embedded Labels designer stylesheet was not found");

const shellMatch = designerSource.match(
    /root\.insertAdjacentHTML\("afterbegin",`([\s\S]*?)`\);/
);
assert.ok(shellMatch, "designer tabbed shell markup was not found");
const shellMarkup = shellMatch[1];

const expectedGroups = {
    toolbar: ["document", "selection", "view"],
    sidebar: ["add", "layers"],
    inspector: ["element", "geometry", "appearance", "layout", "barcode"],
    drawers: ["data", "contract", "problems"]
};
let activeFakeElement = null;

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function attribute(tag, name) {
    const match = tag.match(new RegExp(
        `\\s${name}=(?:"([^"]*)"|'([^']*)')`
    ));
    return match ? match[1] ?? match[2] : null;
}

function openingTags(markup, name) {
    return [...markup.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))]
        .map((match) => ({tag: match[0], index: match.index}));
}

const tabButtons = openingTags(shellMarkup, "button")
    .filter(({tag}) => attribute(tag, "role") === "tab");
const tabPanels = openingTags(shellMarkup, "div")
    .filter(({tag}) => attribute(tag, "role") === "tabpanel");
const tabLists = openingTags(shellMarkup, "div")
    .filter(({tag}) => attribute(tag, "role") === "tablist");

function entriesFor(entries, group, targetAttribute) {
    return entries
        .filter(({tag}) => attribute(tag, "data-tab-group") === group)
        .map(({tag}) => attribute(tag, targetAttribute));
}

function panelSegment(group, target) {
    const panel = tabPanels.find(({tag}) =>
        attribute(tag, "data-tab-group") === group &&
        attribute(tag, "data-tab-panel") === target
    );
    assert.ok(panel, `missing ${group}/${target} panel`);
    const next = tabPanels.find(({index}) => index > panel.index);
    return shellMarkup.slice(panel.index, next ? next.index : shellMarkup.length);
}

function occurrences(source, text) {
    return source.split(text).length - 1;
}

test("designer shell groups each feature category in an accessible tab contract", () => {
    assert.equal(tabLists.length, 4, "one tablist is required per feature group");
    tabLists.forEach(({tag}) => {
        assert.ok(attribute(tag, "aria-label"), "every tablist needs an aria-label");
    });

    for (const [group, targets] of Object.entries(expectedGroups)) {
        assert.deepEqual(
            entriesFor(tabButtons, group, "data-tab-target"),
            targets,
            `${group} tab order changed unexpectedly`
        );
        assert.deepEqual(
            entriesFor(tabPanels, group, "data-tab-panel"),
            targets,
            `${group} tabs and panels must remain one-to-one`
        );

        const buttons = tabButtons.filter(({tag}) =>
            attribute(tag, "data-tab-group") === group
        );
        assert.equal(
            buttons.filter(({tag}) => attribute(tag, "aria-selected") === "true").length,
            1,
            `${group} must declare exactly one initial tab`
        );
        buttons.forEach(({tag}) => {
            const selected = attribute(tag, "aria-selected") === "true";
            assert.equal(attribute(tag, "tabindex"), selected ? "0" : "-1");
        });
    }
    assert.match(
        shellMarkup,
        /data-tab-group="sidebar" data-tab-target="add"[\s\S]*?>Componentes<\/button>/
    );
    assert.match(
        shellMarkup,
        /data-tab-target="add"[\s\S]*?aria-selected="true" tabindex="0"/
    );

    const typedInspectorTabs = new Map(tabButtons
        .filter(({tag}) => attribute(tag, "data-tab-group") === "inspector")
        .map(({tag}) => [
            attribute(tag, "data-tab-target"),
            attribute(tag, "data-tab-type")
        ]));
    assert.equal(typedInspectorTabs.get("appearance"), "text");
    assert.equal(typedInspectorTabs.get("layout"), "container");
    assert.equal(typedInspectorTabs.get("barcode"), "barcode");

    const categorizedActions = {
        "toolbar/document": ["background", "apply-page", "export", "import"],
        "toolbar/selection": ["remove", "duplicate", "lock", "align"],
        "toolbar/view": ["grid", "snap", "print-overlay", "discover-variables"],
        "sidebar/add": ["add-text", "add-barcode", "add-container"],
        "sidebar/layers": ["layer-up", "layer-down"],
        "drawers/data": ["generate-sample-records"],
        "drawers/contract": ["format-json", "apply-json", "discard-json"]
    };
    for (const [key, actions] of Object.entries(categorizedActions)) {
        const [group, target] = key.split("/");
        const segment = panelSegment(group, target);
        for (const action of actions) {
            const token = `data-action="${action}"`;
            assert.equal(
                occurrences(shellMarkup, token),
                1,
                `${action} must have one owner category`
            );
            assert.equal(
                occurrences(segment, token),
                1,
                `${action} must remain in ${key}`
            );
        }
    }
});

test("designer stylesheet preserves Elementos, canvas and Inspetor desktop order", () => {
    assert.match(designerStyle, /@media\(min-width:1400px\)/);
    assert.match(
        designerStyle,
        /grid-template-areas:"layers canvas inspector"/
    );
    assert.match(designerStyle, /@media\(max-width:899px\)/);
    assert.match(
        designerStyle,
        /\[data-elements-collapsed=true\][^{]*\{[^}]*grid-template-areas:"canvas inspector"/
    );
    assert.match(
        designerStyle,
        /\[data-elements-minimized=true\][^{]*\{[^}]*grid-template-columns:48px[^}]*grid-template-areas:"layers canvas inspector"/
    );
    assert.match(
        designerStyle,
        /\.fwwebex-label-layers\[data-minimized=true\]>\.fwwebex-label-panel-body\{display:none\}/
    );
    assert.match(
        designerStyle,
        /\[data-show-layers=false\]\[data-show-inspector=false\]/
    );
    assert.match(
        designerStyle,
        /grid-template-areas:"canvas" "layers" "inspector"/
    );
    assert.match(
        designerStyle,
        /\.fwwebex-label-drawers\[data-collapsed=true\][^{]*\{[^}]*resize:none/
    );
    assert.match(
        designerStyle,
        /\.fwwebex-label-drawers\[data-collapsed=true\] \.fwwebex-label-drawer-content\{display:none\}/
    );

    assert.match(
        shellMarkup,
        /data-role="drawers" data-collapsed="false"/
    );
    assert.match(
        shellMarkup,
        /data-action="toggle-drawers" aria-expanded="true"[\s\S]*?>Recolher<\/button>/
    );
    assert.equal(occurrences(shellMarkup, 'data-action="toggle-elements"'), 1);
    assert.equal(occurrences(shellMarkup, 'data-action="toggle-elements-size"'), 1);
    assert.ok(
        shellMarkup.indexOf('data-action="toggle-elements"') >
            shellMarkup.indexOf('data-role="workspace"'),
        "the Elements trigger must remain available after its panel is hidden"
    );
    assert.match(
        shellMarkup,
        /data-role="workspace"[\s\S]*?data-show-layers="true" data-show-inspector="true" data-elements-collapsed="false"[\s\S]*?data-elements-minimized="false"/
    );
    assert.match(designerSource, /workspace\.dataset\.showLayers=String\(showLayers\)/);
    assert.match(designerSource, /workspace\.dataset\.showInspector=String\(showInspector\)/);
    assert.match(designerSource, /workspace\.dataset\.elementsCollapsed=String\(hidden\)/);
    assert.match(designerSource, /workspace\.dataset\.elementsMinimized=String\(state\.elementsMinimized\)/);
});

class FakeClassList {
    constructor(node) {
        this.node = node;
    }

    contains(name) {
        return this.node.className.split(/\s+/).filter(Boolean).includes(name);
    }

    toggle(name, force) {
        const names = new Set(this.node.className.split(/\s+/).filter(Boolean));
        const enabled = force === undefined ? !names.has(name) : force === true;
        if (enabled) names.add(name);
        else names.delete(name);
        this.node.className = [...names].join(" ");
        return enabled;
    }
}

function dataProperty(name) {
    return name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function nodeAttribute(node, name) {
    if (name === "class") return node.className;
    if (name === "id") return node.id || null;
    if (name.startsWith("data-")) return node.dataset[dataProperty(name)] ?? null;
    if (name === "open") return node.open === true ? "" : null;
    return node.getAttribute(name);
}

function matchesSimple(node, selector) {
    const tag = selector.match(/^[A-Za-z][A-Za-z0-9-]*/);
    if (tag && node.tagName !== tag[0].toUpperCase()) return false;
    for (const match of selector.matchAll(/\.([A-Za-z0-9_-]+)/g)) {
        if (!node.classList.contains(match[1])) return false;
    }
    for (const match of selector.matchAll(
        /\[([^\]=\s]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/g
    )) {
        const actual = nodeAttribute(node, match[1]);
        if (actual === null || actual === undefined) return false;
        const expected = match[2] ?? match[3] ?? match[4];
        if (expected !== undefined && String(actual) !== expected.trim()) return false;
    }
    return true;
}

function matchesSelector(node, selector) {
    return selector.split(",").some((candidate) => {
        const parts = candidate.trim().split(/\s+/);
        let current = node;
        if (!matchesSimple(current, parts.pop())) return false;
        while (parts.length) {
            const part = parts.pop();
            current = current.parentElement;
            while (current && !matchesSimple(current, part)) {
                current = current.parentElement;
            }
            if (!current) return false;
        }
        return true;
    });
}

class FakeNode {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentElement = null;
        this.dataset = {};
        this.attributes = new Map();
        this.className = "";
        this.classList = new FakeClassList(this);
        this.style = {
            setProperty(name, value) {
                this[name] = value;
            }
        };
        this.hidden = false;
        this.disabled = false;
        this.readOnly = false;
        this.open = false;
        this.value = "";
        this.textContent = "";
        this.tabIndex = 0;
        this.options = [];
        this.listeners = new Map();
        this.dispatched = [];
        this.clientWidth = 1000;
        this.clientHeight = 600;
        this.scrollWidth = 0;
        this.scrollHeight = 0;
        this.focusCount = 0;
        this._src = "";
    }

    set src(value) {
        this._src = String(value ?? "");
    }

    get src() {
        return this._src;
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        if (this.tagName === "SELECT" && child.tagName === "OPTION") {
            this.options.push(child);
        }
        return child;
    }

    replaceChildren(...children) {
        this.children.forEach((child) => {
            child.parentElement = null;
        });
        this.children = [];
        this.options = [];
        children.forEach((child) => this.appendChild(child));
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
        if (name === "src") this._src = "";
    }

    querySelectorAll(selector) {
        const result = [];
        const visit = (node) => {
            node.children.forEach((child) => {
                if (matchesSelector(child, selector)) result.push(child);
                visit(child);
            });
        };
        visit(this);
        return result;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    closest(selector) {
        let current = this;
        while (current) {
            if (matchesSelector(current, selector)) return current;
            current = current.parentElement;
        }
        return null;
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    removeEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        this.listeners.set(type, listeners.filter((entry) => entry !== listener));
    }

    dispatch(type, event = {}) {
        let prevented = false;
        const payload = {
            target: this,
            currentTarget: this,
            key: "",
            shiftKey: false,
            ctrlKey: false,
            metaKey: false,
            altKey: false,
            pointerId: 1,
            clientX: 0,
            clientY: 0,
            preventDefault() {
                prevented = true;
            },
            stopPropagation() {},
            ...event
        };
        for (const listener of this.listeners.get(type) || []) listener(payload);
        payload.defaultPrevented = prevented;
        return payload;
    }

    dispatchEvent(event) {
        this.dispatched.push(event);
        for (const listener of this.listeners.get(event.type) || []) {
            listener(event);
        }
        return true;
    }

    focus() {
        this.focusCount += 1;
        activeFakeElement = this;
    }

    contains(node) {
        let current = node;
        while (current) {
            if (current === this) return true;
            current = current.parentElement;
        }
        return false;
    }

    getBoundingClientRect() {
        return {
            left: 0,
            top: 0,
            width: this.clientWidth,
            height: this.clientHeight,
            right: this.clientWidth,
            bottom: this.clientHeight
        };
    }

    getContext() {
        return null;
    }

    setPointerCapture() {}
    releasePointerCapture() {}

    set innerHTML(value) {
        if (value === "") this.replaceChildren();
    }

    get innerHTML() {
        return "";
    }
}

function appendTabGroup(root, group, targets, initial, types = {}) {
    const buttons = new Map();
    const panels = new Map();
    for (const target of targets) {
        const selected = target === initial;
        const button = new FakeNode("button");
        button.setAttribute("role", "tab");
        button.dataset.tabGroup = group;
        button.dataset.tabTarget = target;
        if (types[target]) button.dataset.tabType = types[target];
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
        root.appendChild(button);
        buttons.set(target, button);

        const panel = new FakeNode("div");
        panel.setAttribute("role", "tabpanel");
        panel.dataset.tabGroup = group;
        panel.dataset.tabPanel = target;
        if (types[target]) panel.dataset.tabType = types[target];
        panel.hidden = !selected;
        root.appendChild(panel);
        panels.set(target, panel);
    }
    return {buttons, panels};
}

function createRoot(id) {
    const root = new FakeNode("section");
    root.id = id;

    const workspace = new FakeNode("div");
    workspace.dataset.role = "workspace";
    workspace.dataset.showLayers = "true";
    workspace.dataset.showInspector = "true";
    workspace.dataset.elementsCollapsed = "false";
    workspace.dataset.elementsMinimized = "false";
    root.appendChild(workspace);

    const elementsPane = new FakeNode("aside");
    elementsPane.className = "fwwebex-label-pane fwwebex-label-layers";
    elementsPane.dataset.minimized = "false";
    const elementsHead = new FakeNode("div");
    elementsHead.className = "fwwebex-label-panel-head";
    const toggleElementsSize = new FakeNode("button");
    toggleElementsSize.dataset.action = "toggle-elements-size";
    toggleElementsSize.setAttribute("aria-expanded", "true");
    toggleElementsSize.setAttribute("aria-label", "Recolher painel Elementos");
    toggleElementsSize.textContent = "Recolher";
    elementsHead.appendChild(toggleElementsSize);
    elementsPane.appendChild(elementsHead);
    const elementsBody = new FakeNode("div");
    elementsBody.className = "fwwebex-label-panel-body";
    const layers = new FakeNode("ul");
    layers.dataset.role = "layers";
    elementsBody.appendChild(layers);
    elementsPane.appendChild(elementsBody);
    workspace.appendChild(elementsPane);

    const toggleElements = new FakeNode("button");
    toggleElements.dataset.action = "toggle-elements";
    toggleElements.setAttribute("aria-expanded", "true");
    toggleElements.setAttribute("aria-label", "Ocultar painel Elementos");
    toggleElements.textContent = "Ocultar Elementos";
    workspace.appendChild(toggleElements);

    const stageViewport = new FakeNode("div");
    stageViewport.dataset.role = "stage-viewport";
    stageViewport.clientWidth = 600;
    stageViewport.clientHeight = 600;
    const stage = new FakeNode("div");
    stage.dataset.role = "stage";
    const background = new FakeNode("img");
    background.dataset.role = "background";
    const fields = new FakeNode("div");
    fields.dataset.role = "fields";
    stage.appendChild(background);
    stage.appendChild(fields);
    stageViewport.appendChild(stage);
    workspace.appendChild(stageViewport);

    const inspectorPane = new FakeNode("aside");
    inspectorPane.className = "fwwebex-label-pane fwwebex-label-inspector";
    const inspectorBody = new FakeNode("div");
    inspectorBody.dataset.role = "inspector";
    inspectorPane.appendChild(inspectorBody);
    workspace.appendChild(inspectorPane);

    const groups = {
        toolbar: appendTabGroup(
            root, "toolbar", expectedGroups.toolbar, "document"
        ),
        sidebar: appendTabGroup(
            root, "sidebar", expectedGroups.sidebar, "add"
        ),
        inspector: appendTabGroup(
            inspectorBody,
            "inspector",
            expectedGroups.inspector,
            "element",
            {appearance: "text", layout: "container", barcode: "barcode"}
        )
    };

    const drawers = new FakeNode("section");
    drawers.dataset.role = "drawers";
    drawers.dataset.collapsed = "false";
    const toggle = new FakeNode("button");
    toggle.dataset.action = "toggle-drawers";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Recolher painel inferior");
    toggle.textContent = "Recolher";
    drawers.appendChild(toggle);
    root.appendChild(drawers);
    groups.drawers = appendTabGroup(
        drawers, "drawers", expectedGroups.drawers, "data"
    );

    return {
        root, stageViewport, stage, background, fields, inspectorPane, inspectorBody,
        workspace, elementsPane, elementsBody, layers, toggleElements,
        toggleElementsSize, drawers, toggle, groups
    };
}

function createHarness() {
    activeFakeElement = null;
    const first = createRoot("designer-tabs-a");
    const second = createRoot("designer tabs/b");
    const roots = new Map([
        [first.root.id, first.root],
        [second.root.id, second.root]
    ]);
    const sharedWindow = {
        prompt: () => null,
        requestAnimationFrame(callback) {
            callback(0);
            return 1;
        },
        cancelAnimationFrame() {},
        setTimeout,
        clearTimeout
    };
    const context = vm.createContext({
        console,
        CustomEvent: class {
            constructor(type, options) {
                this.type = type;
                this.detail = options && options.detail;
            }
        },
        document: {
            createElement: (tagName) => new FakeNode(tagName),
            getElementById: (id) => roots.get(id) || null,
            get activeElement() {
                return activeFakeElement;
            }
        },
        window: sharedWindow,
        setTimeout,
        clearTimeout
    });

    vm.runInContext(canonicalRuntimeSource, context);
    for (const entry of [first, second]) {
        vm.runInContext(
            designerSource
                .replaceAll("__ID__", entry.root.id)
                .replaceAll("__WIDTH__", "100")
                .replaceAll("__HEIGHT__", "60"),
            context
        );
    }
    return {first, second};
}

function selectedTargets(entry, group) {
    return [...entry.groups[group].buttons]
        .filter(([, button]) => button.getAttribute("aria-selected") === "true")
        .map(([target]) => target);
}

function visiblePanels(entry, group) {
    return [...entry.groups[group].panels]
        .filter(([, panel]) => panel.hidden !== true)
        .map(([target]) => target);
}

function assertSingleActive(entry, group, target) {
    assert.deepEqual(selectedTargets(entry, group), [target]);
    assert.deepEqual(visiblePanels(entry, group), [target]);
    for (const [name, button] of entry.groups[group].buttons) {
        assert.equal(button.tabIndex, name === target ? 0 : -1);
    }
}

test("tab APIs generate instance-scoped ARIA IDs and keep state independent", () => {
    const {first, second} = createHarness();
    const firstDesigner = first.root.__labelDesigner;
    const secondDesigner = second.root.__labelDesigner;

    assert.deepEqual(plain(firstDesigner.getActiveTabs()), {
        toolbar: "document",
        sidebar: "add",
        inspector: "element",
        drawers: "data"
    });
    assert.deepEqual(plain(secondDesigner.getActiveTabs()), {
        toolbar: "document",
        sidebar: "add",
        inspector: "element",
        drawers: "data"
    });

    for (const entry of [first, second]) {
        for (const group of Object.keys(expectedGroups)) {
            for (const target of expectedGroups[group]) {
                const button = entry.groups[group].buttons.get(target);
                const panel = entry.groups[group].panels.get(target);
                assert.ok(button.id, `${group}/${target} tab needs an ID`);
                assert.ok(panel.id, `${group}/${target} panel needs an ID`);
                assert.equal(button.getAttribute("aria-controls"), panel.id);
                assert.equal(panel.getAttribute("aria-labelledby"), button.id);
            }
        }
    }

    const firstIds = new Set(first.root.querySelectorAll("[id]").map((node) => node.id));
    const secondIds = new Set(second.root.querySelectorAll("[id]").map((node) => node.id));
    assert.ok([...firstIds].every((id) => !secondIds.has(id)));
    assert.ok([...firstIds].every((id) => id.startsWith("designer-tabs-a-")));
    assert.ok([...secondIds].every((id) => id.startsWith("designer-tabs-b-")));

    assert.equal(firstDesigner.selectTab("toolbar", "view", true), true);
    assertSingleActive(first, "toolbar", "view");
    assert.equal(first.groups.toolbar.buttons.get("view").focusCount, 1);
    assert.equal(firstDesigner.getActiveTabs().toolbar, "view");
    assert.equal(secondDesigner.getActiveTabs().toolbar, "document");
    assertSingleActive(second, "toolbar", "document");

    assert.equal(firstDesigner.selectTab("toolbar", "does-not-exist"), true);
    assert.equal(firstDesigner.getActiveTabs().toolbar, "view");
});

test("mouse and keyboard tabs keep one active control per category", () => {
    const {first} = createHarness();
    const add = first.groups.sidebar.buttons.get("add");
    first.root.dispatch("click", {target: add});
    assertSingleActive(first, "sidebar", "add");
    assert.equal(first.root.__labelDesigner.getActiveTabs().sidebar, "add");

    const documentTab = first.groups.toolbar.buttons.get("document");
    const right = first.root.dispatch("keydown", {
        target: documentTab,
        key: "ArrowRight"
    });
    assert.equal(right.defaultPrevented, true);
    assertSingleActive(first, "toolbar", "selection");
    assert.equal(first.groups.toolbar.buttons.get("selection").focusCount, 1);

    const end = first.root.dispatch("keydown", {
        target: first.groups.toolbar.buttons.get("selection"),
        key: "End"
    });
    assert.equal(end.defaultPrevented, true);
    assertSingleActive(first, "toolbar", "view");

    const wrap = first.root.dispatch("keydown", {
        target: first.groups.toolbar.buttons.get("view"),
        key: "ArrowRight"
    });
    assert.equal(wrap.defaultPrevented, true);
    assertSingleActive(first, "toolbar", "document");
});

test("Elements supports independent minimize and hide states with canvas refit", () => {
    const {first} = createHarness();
    const designer = first.root.__labelDesigner;

    assert.equal(first.elementsPane.hidden, false);
    assert.equal(first.elementsBody.hidden, false);
    assert.equal(first.workspace.dataset.elementsCollapsed, "false");
    assert.equal(first.workspace.dataset.elementsMinimized, "false");
    assert.equal(first.toggleElements.getAttribute("aria-expanded"), "true");
    assert.equal(first.toggleElementsSize.getAttribute("aria-expanded"), "true");
    assert.equal(
        first.toggleElements.getAttribute("aria-controls"),
        first.elementsPane.id
    );
    assert.equal(
        first.toggleElementsSize.getAttribute("aria-controls"),
        first.elementsBody.id
    );

    const layerControl = new FakeNode("button");
    first.elementsBody.appendChild(layerControl);
    layerControl.focus();
    first.stageViewport.clientWidth = 700;
    assert.equal(designer.setElementsMinimized(true), true);
    assert.equal(first.elementsPane.hidden, false);
    assert.equal(first.elementsBody.hidden, true);
    assert.equal(first.elementsPane.dataset.minimized, "true");
    assert.equal(first.workspace.dataset.elementsMinimized, "true");
    assert.equal(first.toggleElementsSize.getAttribute("aria-expanded"), "false");
    assert.equal(first.toggleElementsSize.getAttribute("aria-label"),
        "Expandir painel Elementos");
    assert.equal(first.toggleElementsSize.textContent, "\u203a");
    assert.equal(activeFakeElement, first.toggleElementsSize);
    assert.equal(first.stage.style.width, "668px");

    first.stageViewport.clientWidth = 600;
    first.root.dispatch("click", {target: first.toggleElementsSize});
    assert.equal(first.elementsBody.hidden, false);
    assert.equal(first.elementsPane.dataset.minimized, "false");
    assert.equal(first.workspace.dataset.elementsMinimized, "false");
    assert.equal(first.toggleElementsSize.getAttribute("aria-expanded"), "true");
    assert.equal(first.toggleElementsSize.textContent, "Recolher");
    assert.equal(first.stage.style.width, "568px");

    layerControl.focus();
    first.stageViewport.clientWidth = 800;
    assert.equal(designer.setElementsCollapsed(true), true);
    assert.equal(first.elementsPane.hidden, true);
    assert.equal(first.workspace.dataset.elementsCollapsed, "true");
    assert.equal(first.toggleElements.getAttribute("aria-expanded"), "false");
    assert.equal(first.toggleElements.textContent, "Mostrar Elementos");
    assert.equal(activeFakeElement, first.toggleElements);
    assert.equal(first.stage.style.width, "768px");

    first.stageViewport.clientWidth = 600;
    first.root.dispatch("click", {target: first.toggleElements});
    assert.equal(first.elementsPane.hidden, false);
    assert.equal(first.workspace.dataset.elementsCollapsed, "false");
    assert.equal(first.toggleElements.getAttribute("aria-expanded"), "true");
    assert.equal(first.toggleElements.textContent, "Ocultar Elementos");
    assert.equal(first.stage.style.width, "568px");

    designer.setOptions({showLayers: false});
    assert.equal(first.elementsPane.hidden, true);
    assert.equal(first.toggleElements.hidden, true);
    assert.equal(first.workspace.dataset.elementsCollapsed, "true");
    designer.setOptions({showLayers: true});
    assert.equal(first.elementsPane.hidden, false);
    assert.equal(first.toggleElements.hidden, false);
    assert.equal(first.workspace.dataset.elementsCollapsed, "false");

    first.stageViewport.clientWidth = 750;
    designer.setOptions({showInspector: false});
    assert.equal(first.inspectorPane.hidden, true);
    assert.equal(first.workspace.dataset.showInspector, "false");
    assert.equal(first.stage.style.width, "718px");
    first.stageViewport.clientWidth = 600;
    designer.setOptions({showInspector: true});
    assert.equal(first.inspectorPane.hidden, false);
    assert.equal(first.workspace.dataset.showInspector, "true");
    assert.equal(first.stage.style.width, "568px");
});

test("setOptions does not replay stale transient tab and drawer preferences", () => {
    const {first} = createHarness();
    const designer = first.root.__labelDesigner;

    designer.setOptions({
        showToolbar: false,
        showInspector: true,
        tabs: {toolbar: "selection"},
        drawersCollapsed: true,
        elementsCollapsed: true,
        elementsMinimized: true
    });
    assert.equal(first.elementsPane.hidden, true);
    assert.equal(first.workspace.dataset.elementsCollapsed, "true");
    assert.equal(first.workspace.dataset.elementsMinimized, "true");
    assertSingleActive(first, "toolbar", "selection");

    designer.selectTab("toolbar", "view");
    designer.setDrawersCollapsed(false);
    designer.setElementsCollapsed(false);
    designer.setElementsMinimized(false);
    designer.setOptions({fileName: "changed-without-ui-reset.pdf"});

    assertSingleActive(first, "toolbar", "view");
    assert.equal(first.drawers.dataset.collapsed, "false");
    assert.equal(first.elementsPane.hidden, false);
    assert.equal(first.workspace.dataset.elementsCollapsed, "false");
    assert.equal(first.workspace.dataset.elementsMinimized, "false");
});

test("contextual inspector fallback moves focus away from a hidden type tab", () => {
    const {first} = createHarness();
    const designer = first.root.__labelDesigner;
    const appearance = first.groups.inspector.buttons.get("appearance");
    const element = first.groups.inspector.buttons.get("element");

    designer.addText();
    assert.equal(appearance.hidden, false);
    designer.selectTab("inspector", "appearance", true);
    assert.equal(activeFakeElement, appearance);

    designer.addBarcode();
    assert.equal(appearance.hidden, true);
    assertSingleActive(first, "inspector", "element");
    assert.equal(activeFakeElement, element);
});

test("lower drawer collapses, expands and reopens when its tab is selected", () => {
    const {first} = createHarness();
    const designer = first.root.__labelDesigner;

    assert.equal(first.drawers.dataset.collapsed, "false");
    assert.equal(first.toggle.getAttribute("aria-expanded"), "true");
    assert.equal(designer.setDrawersCollapsed(true), true);
    assert.equal(first.drawers.dataset.collapsed, "true");
    assert.equal(first.toggle.getAttribute("aria-expanded"), "false");
    assert.equal(first.toggle.getAttribute("aria-label"), "Expandir painel inferior");
    assert.equal(first.toggle.textContent, "Expandir");

    const contract = first.groups.drawers.buttons.get("contract");
    first.root.dispatch("click", {target: contract});
    assertSingleActive(first, "drawers", "contract");
    assert.equal(first.drawers.dataset.collapsed, "false");
    assert.equal(first.toggle.getAttribute("aria-expanded"), "true");
    assert.equal(first.toggle.textContent, "Recolher");

    first.root.dispatch("click", {target: first.toggle});
    assert.equal(first.drawers.dataset.collapsed, "true");

    designer.setDrawersCollapsed(false);
    const editor = new FakeNode("textarea");
    first.groups.drawers.panels.get("data").appendChild(editor);
    editor.focus();
    assert.equal(activeFakeElement, editor);
    designer.setDrawersCollapsed(true);
    assert.equal(activeFakeElement, first.toggle);
});
