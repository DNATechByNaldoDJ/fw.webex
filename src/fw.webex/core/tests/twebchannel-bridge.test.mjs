import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import vm from "node:vm";

const pagePath = resolve(
    "src/fw.webex/core/component/fw.webex.page.tlpp"
);
const pageSource = await readFile(pagePath, "utf8");

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, `Marcador inicial ausente: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(end, -1, `Marcador final ausente: ${endMarker}`);
    return source.slice(start, end);
}

const bridgeSource = sourceBetween(
    pageSource,
    "FWWebEx.TWebChannel = (() => {",
    "* FWWebEx.ready"
)
    .replace(
        "__FWWEBEX_TWEBCHANNEL_PLATFORM_SOURCE__",
        "/platform/twebchannel.js"
    )
    .replace(/\s*\/\*+\s*$/u, "")
    .trim();
const requestHandlerBlock = sourceBetween(
    pageSource,
    "FWWebEx.RequestHandler = (() => {",
    "* FWWebEx.Ready.withDependencies"
);
const requestHandlerSource = requestHandlerBlock.slice(
    0,
    requestHandlerBlock.lastIndexOf("/**")
).trim();

const pageConstructorSource = sourceBetween(
    pageSource,
    "method New(cPageTitle) class WebExPage",
    "method Clean() class WebExPage"
);
const pageRenderSource = sourceBetween(
    pageSource,
    "method RenderHTML() class WebExPage",
    "static function FWWebExScripts()"
);
const scriptsPreludeSource = sourceBetween(
    pageSource,
    "static function FWWebExScripts() as character",
    "//FWWebEx Scripts"
);

class FakeCustomEvent {
    constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
    }
}

class FakeEventTarget {
    #listeners = new Map();

    addEventListener(type, listener) {
        const listeners = this.#listeners.get(type) || new Set();
        listeners.add(listener);
        this.#listeners.set(type, listeners);
    }

    removeEventListener(type, listener) {
        this.#listeners.get(type)?.delete(listener);
    }

    dispatchEvent(event) {
        for (const listener of [...(this.#listeners.get(event.type) || [])]) {
            listener.call(this, event);
        }
        return true;
    }

    listenerCount(type) {
        return this.#listeners.get(type)?.size || 0;
    }
}

class VirtualClock {
    constructor(now = 1000) {
        this.now = now;
        this.nextID = 1;
        this.timers = new Map();
    }

    setTimeout(callback, delay = 0) {
        const id = this.nextID++;
        this.timers.set(id, {
            callback,
            due: this.now + Math.max(0, Number(delay) || 0)
        });
        return id;
    }

    clearTimeout(id) {
        this.timers.delete(id);
    }

    async runNext() {
        await Promise.resolve();
        if (this.timers.size === 0) return false;
        const [id, timer] = [...this.timers.entries()].sort(
            ([leftID, left], [rightID, right]) =>
                left.due - right.due || leftID - rightID
        )[0];
        this.timers.delete(id);
        this.now = timer.due;
        timer.callback();
        await flushMicrotasks();
        return true;
    }

    async runUntilIdle() {
        let idlePasses = 0;
        while (idlePasses < 5) {
            await flushMicrotasks();
            if (this.timers.size === 0) {
                idlePasses += 1;
                continue;
            }
            idlePasses = 0;
            const [id, timer] = [...this.timers.entries()].sort(
                ([leftID, left], [rightID, right]) =>
                    left.due - right.due || leftID - rightID
            )[0];
            this.timers.delete(id);
            this.now = timer.due;
            timer.callback();
        }
    }
}

async function flushMicrotasks(passes = 12) {
    for (let pass = 0; pass < passes; pass += 1) {
        await Promise.resolve();
    }
}

function provider(options = {}) {
    const calls = {
        connect: 0,
        jsToAdvpl: [],
        previousReceiver: []
    };
    const channel = {
        version: options.version || "platform-test",
        connect(callback) {
            calls.connect += 1;
            queueMicrotask(callback);
        },
        jsToAdvpl(key, value) {
            calls.jsToAdvpl.push([key, value]);
        },
        advplToJs(...args) {
            calls.previousReceiver.push(args);
        }
    };
    return {channel, calls};
}

function createHarness(options = {}) {
    const appendedSources = [];
    const removedSources = [];
    const emitted = [];
    const activeIntervals = new Set();
    const consoleMessages = {log: [], warn: [], error: []};
    const runtimeConsole = options.runtimeConsole || {
        log(...args) {
            consoleMessages.log.push(args);
        },
        warn(...args) {
            consoleMessages.warn.push(args);
        },
        error(...args) {
            consoleMessages.error.push(args);
        }
    };
    const document = new FakeEventTarget();
    const elements = new Map([
        ["fwwebex-connection-status", {style: {display: "none"}}],
        ["fwwebex_connection_status_dot1", {style: {visibility: "hidden"}}],
        ["fwwebex_connection_status_dot2", {style: {visibility: "hidden"}}],
        ["fwwebex_connection_status_dot3", {style: {visibility: "hidden"}}]
    ]);
    const window = {
        twebchannel: options.channel || undefined
    };
    const FWWebEx = {
        config: options.config || {},
        Events: {
            emit(name, detail) {
                emitted.push({name, detail});
            }
        }
    };
    window.FWWebEx = FWWebEx;
    document.getElementById = id => elements.get(id) || null;

    document.createElement = tagName => {
        assert.equal(tagName, "script");
        return {
            async: false,
            attributes: {},
            setAttribute(name, value) {
                this.attributes[name] = value;
            },
            remove() {
                removedSources.push(this.src);
            }
        };
    };
    document.head = {
        appendChild(script) {
            appendedSources.push(script.src);
            queueMicrotask(() => {
                const handler = options.scriptHandlers?.get(script.src);
                if (!handler) {
                    script.onerror?.(new Error(`Falha simulada: ${script.src}`));
                    return;
                }
                handler({script, window});
            });
            return script;
        }
    };

    const clock = options.clock;
    const trackedSetInterval = (callback, delay) => {
        const id = setInterval(callback, delay);
        activeIntervals.add(id);
        return id;
    };
    const trackedClearInterval = id => {
        activeIntervals.delete(id);
        clearInterval(id);
    };
    const ClockDate = clock ? class extends Date {
        static now() {
            return clock.now;
        }
    } : Date;
    const context = vm.createContext({
        window,
        document,
        FWWebEx,
        CustomEvent: FakeCustomEvent,
        EventTarget: FakeEventTarget,
        Promise,
        Set,
        Object,
        Number,
        Error,
        TypeError,
        Date: ClockDate,
        console: runtimeConsole,
        queueMicrotask,
        setTimeout: clock ? clock.setTimeout.bind(clock) : setTimeout,
        clearTimeout: clock ? clock.clearTimeout.bind(clock) : clearTimeout,
        setInterval: trackedSetInterval,
        clearInterval: trackedClearInterval
    });
    vm.runInContext(bridgeSource, context, {filename: pagePath});
    vm.runInContext(requestHandlerSource, context, {filename: pagePath});
    FWWebEx.RequestHandler.debug(false);

    return {
        activeIntervals,
        appendedSources,
        consoleMessages,
        removedSources,
        document,
        emitted,
        elements,
        FWWebEx,
        window
    };
}

test("FWWebExScripts aceita AppRoot raiz e monta a origem da plataforma", () => {
    assert.match(
        scriptsPreludeSource,
        /if\s*\(\s*!Empty\(cAPPRootURI\)\s*\)/u
    );
    assert.doesNotMatch(
        scriptsPreludeSource,
        /cAPPRootURI\s*!\s*=\s*["']\/["']/u
    );
    assert.match(
        scriptsPreludeSource,
        /cTWebChannelURI\s*:=\s*cAPPRootURI\s*\+\s*cEnvServer\s*\+\s*["']twebchannel\.js["']/u
    );

    const appRoot = "/";
    assert.equal(
        appRoot + "fwwebex/totvstec/" + "twebchannel.js",
        "/fwwebex/totvstec/twebchannel.js"
    );
    assert.equal(
        appRoot + "preindex_env_homy/" + "twebchannel.js",
        "/preindex_env_homy/twebchannel.js"
    );
});

test("bridge reusa o provider TOTVS presente sem injetar scripts", async () => {
    const current = provider();
    const harness = createHarness({channel: current.channel});

    const loaded = await harness.FWWebEx.TWebChannel.load();

    assert.equal(loaded, current.channel);
    assert.deepEqual(harness.appendedSources, []);
    assert.equal(harness.FWWebEx.TWebChannel.getChannel(), current.channel);
    assert.equal(harness.FWWebEx.TWebChannel.getState().loaded, true);
});

test("EventTarget criado antes do lazy load preserva identidade e listeners", async () => {
    const loaded = provider();
    const providerTarget = new FakeEventTarget();
    loaded.channel.eventTarget = providerTarget;
    const harness = createHarness({
        scriptHandlers: new Map([
            ["/platform/twebchannel.js", ({script, window}) => {
                window.twebchannel = loaded.channel;
                script.onload();
            }]
        ])
    });
    const originalTarget = harness.FWWebEx.TWebChannel.getEventTarget();
    const notifications = [];
    originalTarget.addEventListener("CALLBACK_DATA_RESPONSE", event => {
        notifications.push(event.detail);
    });

    await harness.FWWebEx.TWebChannel.load();

    assert.equal(harness.FWWebEx.TWebChannel.getEventTarget(), originalTarget);
    assert.notEqual(originalTarget, providerTarget);
    assert.equal(loaded.channel.eventTarget, providerTarget);
    originalTarget.dispatchEvent(new FakeCustomEvent("CALLBACK_DATA_RESPONSE", {
        detail: {source: "listener-original"}
    }));
    assert.deepEqual(notifications, [{source: "listener-original"}]);
});

test("chamadas concorrentes compartilham uma unica conexao", async () => {
    const current = provider();
    const harness = createHarness({channel: current.channel});

    const connected = await Promise.all([
        harness.FWWebEx.TWebChannel.connect(),
        harness.FWWebEx.TWebChannel.connect(),
        harness.FWWebEx.TWebChannel.connect()
    ]);

    assert.equal(current.calls.connect, 1);
    assert.ok(connected.every(channel => channel === current.channel));
    assert.equal(current.channel.gotConnection, true);
    assert.equal(harness.FWWebEx.TWebChannel.getState().connected, true);
    assert.equal(
        harness.emitted.filter(event =>
            event.name === "FWWebEx:twebchannel:ready"
        ).length,
        1
    );
});

test("bridge aguarda o preloader presente sem reiniciar a conexao", async () => {
    const current = provider();
    current.channel.gotConnection = false;
    current.channel.channel = {port1: {}};
    const harness = createHarness({channel: current.channel});
    const preloader = setTimeout(() => {
        current.channel.gotConnection = true;
    }, 10);

    try {
        const connected = await harness.FWWebEx.TWebChannel.connect({
            timeout: 300
        });

        assert.equal(connected, current.channel);
        assert.equal(current.calls.connect, 0);
        assert.equal(harness.FWWebEx.TWebChannel.getState().connected, true);
    } finally {
        clearTimeout(preloader);
    }
});

test("gotConnection falso sem transporte inicia uma unica conexao", async () => {
    const current = provider();
    current.channel.gotConnection = false;
    const harness = createHarness({channel: current.channel});
    const options = {timeout: 300};

    const connected = await Promise.all([
        harness.FWWebEx.TWebChannel.connect(options),
        harness.FWWebEx.TWebChannel.connect(options),
        harness.FWWebEx.TWebChannel.connect(options)
    ]);

    assert.equal(current.calls.connect, 1);
    assert.ok(connected.every(channel => channel === current.channel));
    await harness.FWWebEx.TWebChannel.connect(options);
    assert.equal(current.calls.connect, 1);
});

test("forceReconnect reinicia uma unica vez mesmo com transporte do preloader", async () => {
    const current = provider();
    current.channel.gotConnection = false;
    current.channel.channel = {port1: {}};
    const harness = createHarness({channel: current.channel});
    const options = {timeout: 300, forceReconnect: true};

    const connected = await Promise.all([
        harness.FWWebEx.TWebChannel.connect(options),
        harness.FWWebEx.TWebChannel.connect(options)
    ]);

    assert.equal(current.calls.connect, 1);
    assert.ok(connected.every(channel => channel === current.channel));
});

test("forceReconnect apos conexao concluida executa exatamente mais um connect", async () => {
    const current = provider();
    const harness = createHarness({channel: current.channel});

    await harness.FWWebEx.TWebChannel.connect({timeout: 300});
    assert.equal(current.calls.connect, 1);

    const reconnected = await Promise.all([
        harness.FWWebEx.TWebChannel.connect({
            timeout: 300,
            forceReconnect: true
        }),
        harness.FWWebEx.TWebChannel.connect({
            timeout: 300,
            forceReconnect: true
        })
    ]);

    assert.equal(current.calls.connect, 2);
    assert.ok(reconnected.every(channel => channel === current.channel));
    await harness.FWWebEx.TWebChannel.connect({timeout: 300});
    assert.equal(current.calls.connect, 2);
});

test("evento ready tardio nao conclui conexao propria antes do callback", async () => {
    const current = provider();
    let connectionCallback;
    current.channel.connect = callback => {
        current.calls.connect += 1;
        connectionCallback = callback;
    };
    const harness = createHarness({channel: current.channel});
    let settled = false;
    const connection = harness.FWWebEx.TWebChannel.connect({timeout: 300}).then(
        channel => {
            settled = true;
            return channel;
        }
    );

    await Promise.resolve();
    await Promise.resolve();
    assert.equal(typeof connectionCallback, "function");
    harness.document.dispatchEvent(new FakeCustomEvent("twebchannelready"));
    await Promise.resolve();
    assert.equal(settled, false);

    connectionCallback();
    assert.equal(await connection, current.channel);
    assert.equal(settled, true);
    assert.equal(current.calls.connect, 1);
});

test("receiver tratado evita stub anterior e mensagem livre usa fallback", async () => {
    const current = provider();
    const harness = createHarness({channel: current.channel});
    const received = [];
    const unsubscribe = harness.FWWebEx.TWebChannel.onAdvplToJs(
        (...args) => {
            received.push(args);
            return args[0] === "CALLBACK_RESPONSE";
        }
    );

    current.channel.advplToJs("CALLBACK_RESPONSE", "{\"ok\":true}", "grid");
    assert.deepEqual(received, [
        ["CALLBACK_RESPONSE", "{\"ok\":true}", "grid"]
    ]);
    assert.deepEqual(current.calls.previousReceiver, []);

    current.channel.advplToJs("OUTRO_EVENTO", "valor");
    assert.deepEqual(received.at(-1), ["OUTRO_EVENTO", "valor"]);
    assert.deepEqual(current.calls.previousReceiver, [
        ["OUTRO_EVENTO", "valor"]
    ]);

    const target = harness.FWWebEx.TWebChannel.getEventTarget();
    assert.equal(harness.FWWebEx.TWebChannel.getEventTarget(), target);
    assert.equal(current.channel.eventTarget, target);
    let response;
    target.addEventListener("CALLBACK_DATA_RESPONSE", event => {
        response = event.detail;
    });
    target.dispatchEvent(new FakeCustomEvent("CALLBACK_DATA_RESPONSE", {
        detail: {ok: true}
    }));
    assert.deepEqual(response, {ok: true});

    await harness.FWWebEx.TWebChannel.send("CALLBACK_EXEC", "payload");
    assert.equal(current.calls.connect, 1);
    assert.deepEqual(current.calls.jsToAdvpl, [["CALLBACK_EXEC", "payload"]]);

    unsubscribe();
    current.channel.advplToJs("LEGACY", "valor");
    assert.deepEqual(current.calls.previousReceiver, [
        ["OUTRO_EVENTO", "valor"],
        ["LEGACY", "valor"]
    ]);
});

test("twebchannel e carregado somente sob demanda e tenta os fallbacks em ordem", async () => {
    const pinned = provider({version: "cdn-test"});
    const pinnedSource =
        "https://cdn.jsdelivr.net/npm/@totvs/twebchannel-js@1.0.3/twebchannel.js";
    const handlers = new Map([
        ["/custom/twebchannel.js", ({script}) => script.onerror()],
        ["/platform/twebchannel.js", ({script}) => script.onerror()],
        [pinnedSource, ({script, window}) => {
            window.twebchannel = pinned.channel;
            script.onload();
        }]
    ]);
    const harness = createHarness({
        config: {twebchannel: {src: "/custom/twebchannel.js"}},
        scriptHandlers: handlers
    });

    assert.deepEqual(harness.appendedSources, []);
    const [first, second] = await Promise.all([
        harness.FWWebEx.TWebChannel.load(),
        harness.FWWebEx.TWebChannel.load()
    ]);

    assert.equal(first, pinned.channel);
    assert.equal(second, pinned.channel);
    assert.deepEqual(harness.appendedSources, [
        "/custom/twebchannel.js",
        "/platform/twebchannel.js",
        pinnedSource
    ]);
    assert.equal(
        harness.appendedSources.filter(source => source === pinnedSource).length,
        1
    );
});

test("script silencioso expira, libera fallbacks e respeita o timeout total", async () => {
    const loadTimeout = 300;
    const callerTimeout = 600;
    const clock = new VirtualClock();
    const startedAt = clock.now;
    const pinnedSource =
        "https://cdn.jsdelivr.net/npm/@totvs/twebchannel-js@1.0.3/twebchannel.js";
    const stalled = () => {};
    const harness = createHarness({
        clock,
        config: {
            twebchannel: {
                src: "/custom/twebchannel.js",
                loadTimeout
            }
        },
        scriptHandlers: new Map([
            ["/custom/twebchannel.js", stalled],
            ["/platform/twebchannel.js", stalled],
            [pinnedSource, stalled]
        ])
    });
    const outcome = harness.FWWebEx.TWebChannel.load({
        timeout: callerTimeout
    }).then(
        () => ({resolved: true}),
        error => ({resolved: false, error})
    );

    await clock.runUntilIdle();
    const result = await outcome;

    assert.equal(result.resolved, false);
    assert.equal(
        result.error.code,
        "FWWEBEX_TWEBCHANNEL_DEPENDENCY_MISSING"
    );
    assert.equal(result.error.cause?.code, "FWWEBEX_TWEBCHANNEL_LOAD_TIMEOUT");
    assert.deepEqual(harness.appendedSources, [
        "/custom/twebchannel.js",
        "/platform/twebchannel.js",
        pinnedSource
    ]);
    assert.deepEqual(harness.removedSources, harness.appendedSources);
    assert.ok(clock.now - startedAt <= loadTimeout);
    assert.equal(clock.timers.size, 0);
});

test("consumidores concorrentes preservam deadlines individuais sem duplicar script", async () => {
    const clock = new VirtualClock();
    const startedAt = clock.now;
    const loaded = provider({version: "platform-delayed"});
    const completionDelay = 350;
    const harness = createHarness({
        clock,
        scriptHandlers: new Map([
            ["/platform/twebchannel.js", ({script, window}) => {
                clock.setTimeout(() => {
                    window.twebchannel = loaded.channel;
                    script.onload();
                }, completionDelay);
            }]
        ])
    });
    let shortFinishedAt;
    let longFinishedAt;
    const long = harness.FWWebEx.TWebChannel.load({timeout: 800}).then(
        channel => {
            longFinishedAt = clock.now;
            return channel;
        }
    );
    const short = harness.FWWebEx.TWebChannel.load({timeout: 250}).then(
        () => ({resolved: true}),
        error => {
            shortFinishedAt = clock.now;
            return {resolved: false, error};
        }
    );

    await clock.runUntilIdle();
    const [channel, shortResult] = await Promise.all([long, short]);

    assert.equal(channel, loaded.channel);
    assert.equal(longFinishedAt - startedAt, completionDelay);
    assert.equal(shortResult.resolved, false);
    assert.equal(shortResult.error.code, "FWWEBEX_TWEBCHANNEL_LOAD_TIMEOUT");
    assert.equal(shortFinishedAt - startedAt, 250);
    assert.deepEqual(harness.appendedSources, ["/platform/twebchannel.js"]);
});

test("consumidor curto nao cancela carga usada depois por consumidor longo", async () => {
    const clock = new VirtualClock();
    const startedAt = clock.now;
    const loaded = provider({version: "platform-after-short-timeout"});
    const completionDelay = 350;
    const harness = createHarness({
        clock,
        scriptHandlers: new Map([
            ["/platform/twebchannel.js", ({script, window}) => {
                clock.setTimeout(() => {
                    window.twebchannel = loaded.channel;
                    script.onload();
                }, completionDelay);
            }]
        ])
    });
    let shortFinishedAt;
    let longFinishedAt;
    const short = harness.FWWebEx.TWebChannel.load({timeout: 250}).then(
        () => ({resolved: true}),
        error => {
            shortFinishedAt = clock.now;
            return {resolved: false, error};
        }
    );
    const long = harness.FWWebEx.TWebChannel.load({timeout: 800}).then(
        channel => {
            longFinishedAt = clock.now;
            return channel;
        }
    );

    await clock.runUntilIdle();
    const [shortResult, channel] = await Promise.all([short, long]);

    assert.equal(shortResult.resolved, false);
    assert.equal(shortResult.error.code, "FWWEBEX_TWEBCHANNEL_LOAD_TIMEOUT");
    assert.equal(shortFinishedAt - startedAt, 250);
    assert.equal(channel, loaded.channel);
    assert.equal(longFinishedAt - startedAt, completionDelay);
    assert.deepEqual(harness.appendedSources, ["/platform/twebchannel.js"]);
});

test("falha de todas as fontes produz erro tipado e libera nova tentativa", async () => {
    const pinnedSource =
        "https://cdn.jsdelivr.net/npm/@totvs/twebchannel-js@1.0.3/twebchannel.js";
    const handlers = new Map();
    const harness = createHarness({
        config: {twebchannel: {src: "/custom/twebchannel.js"}},
        scriptHandlers: handlers
    });
    let dependencyError;

    await assert.rejects(
        harness.FWWebEx.TWebChannel.load(),
        error => {
            dependencyError = error;
            return error.name === "FWWebExTWebChannelError" &&
                error.code === "FWWEBEX_TWEBCHANNEL_DEPENDENCY_MISSING" &&
                error.cause?.code === "FWWEBEX_TWEBCHANNEL_LOAD_FAILED";
        }
    );

    assert.deepEqual(harness.appendedSources, [
        "/custom/twebchannel.js",
        "/platform/twebchannel.js",
        pinnedSource
    ]);
    assert.equal(harness.FWWebEx.TWebChannel.getState().loading, false);
    assert.equal(harness.FWWebEx.TWebChannel.getState().lastError, dependencyError);
    assert.equal(
        harness.emitted.at(-1).name,
        "FWWebEx:twebchannel:error"
    );

    await assert.rejects(
        harness.FWWebEx.TWebChannel.load(),
        error => error.code === "FWWEBEX_TWEBCHANNEL_DEPENDENCY_MISSING"
    );
    assert.equal(harness.appendedSources.length, 6);

    const recovered = provider({version: "platform-recovered"});
    handlers.set("/custom/twebchannel.js", ({script, window}) => {
        window.twebchannel = recovered.channel;
        script.onload();
    });
    assert.equal(
        await harness.FWWebEx.TWebChannel.load(),
        recovered.channel
    );
    assert.equal(harness.FWWebEx.TWebChannel.getState().lastError, null);
    assert.equal(harness.FWWebEx.TWebChannel.getState().loaded, true);
    assert.equal(harness.appendedSources.length, 7);
});

test("RequestHandler.waitForConnection preserva retorno true", async () => {
    const current = provider();
    const harness = createHarness({channel: current.channel});

    assert.equal(
        await harness.FWWebEx.RequestHandler.waitForConnection(2, 5),
        true
    );
    assert.equal(current.calls.connect, 1);
});

test("RequestHandler entrega payload false e limpa listener e animacao", async () => {
    const clock = new VirtualClock();
    const current = provider();
    const harness = createHarness({clock, channel: current.channel});
    const callbackEvent = "CALLBACK_FALSE";
    const responseTarget = harness.FWWebEx.TWebChannel.getEventTarget();
    const responses = [];
    const operation = harness.FWWebEx.RequestHandler.execute({
        requestData: {operation: "false-payload"},
        callbackEvent,
        responseTimeout: 250,
        maxRetries: 1,
        interval: 1,
        onResponse: payload => responses.push(payload)
    });

    await flushMicrotasks();
    assert.equal(current.calls.jsToAdvpl.length, 1);
    assert.equal(responseTarget.listenerCount(callbackEvent), 1);
    assert.equal(harness.activeIntervals.size, 1);
    assert.equal(
        harness.elements.get("fwwebex-connection-status").style.display,
        "inline"
    );

    responseTarget.dispatchEvent(new FakeCustomEvent(callbackEvent, {
        detail: false
    }));

    assert.equal(await operation, true);
    assert.deepEqual(responses, [false]);
    assert.equal(responseTarget.listenerCount(callbackEvent), 0);
    assert.equal(harness.activeIntervals.size, 0);
    assert.equal(clock.timers.size, 0);
    assert.equal(
        harness.elements.get("fwwebex-connection-status").style.display,
        "none"
    );
});

test("RequestHandler expira resposta com erro tipado e libera recursos", async () => {
    const clock = new VirtualClock();
    const current = provider();
    const harness = createHarness({clock, channel: current.channel});
    const callbackEvent = "CALLBACK_TIMEOUT";
    const responseTarget = harness.FWWebEx.TWebChannel.getEventTarget();
    const errors = [];
    const operation = harness.FWWebEx.RequestHandler.execute({
        requestData: {operation: "without-response"},
        callbackEvent,
        responseTimeout: 250,
        maxRetries: 1,
        interval: 1,
        onError: error => errors.push(error)
    });

    await flushMicrotasks();
    assert.equal(current.calls.jsToAdvpl.length, 1);
    assert.equal(responseTarget.listenerCount(callbackEvent), 1);
    assert.equal(clock.timers.size, 1);
    assert.equal(harness.activeIntervals.size, 1);

    await clock.runUntilIdle();

    assert.equal(await operation, false);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].name, "FWWebExTWebChannelError");
    assert.equal(errors[0].code, "FWWEBEX_TWEBCHANNEL_RESPONSE_TIMEOUT");
    assert.equal(responseTarget.listenerCount(callbackEvent), 0);
    assert.equal(clock.timers.size, 0);
    assert.equal(harness.activeIntervals.size, 0);
    assert.equal(
        harness.elements.get("fwwebex-connection-status").style.display,
        "none"
    );
});

test("RequestHandler serializa callbackEvent ate resposta ou timeout", async () => {
    const clock = new VirtualClock();
    const current = provider();
    const harness = createHarness({clock, channel: current.channel});
    const callbackEvent = "CALLBACK_SERIAL";
    const responseTarget = harness.FWWebEx.TWebChannel.getEventTarget();
    const firstResponses = [];
    const secondResponses = [];
    const secondErrors = [];
    const thirdResponses = [];
    const defaults = {
        callbackEvent,
        responseTimeout: 250,
        maxRetries: 1,
        interval: 1
    };
    const first = harness.FWWebEx.RequestHandler.execute({
        ...defaults,
        requestData: {sequence: 1},
        onResponse: payload => firstResponses.push(payload)
    });
    const second = harness.FWWebEx.RequestHandler.execute({
        ...defaults,
        requestData: {sequence: 2},
        onResponse: payload => secondResponses.push(payload),
        onError: error => secondErrors.push(error)
    });
    const third = harness.FWWebEx.RequestHandler.execute({
        ...defaults,
        requestData: {sequence: 3},
        onResponse: payload => thirdResponses.push(payload)
    });

    await flushMicrotasks();
    assert.equal(current.calls.jsToAdvpl.length, 1);
    assert.equal(responseTarget.listenerCount(callbackEvent), 1);

    responseTarget.dispatchEvent(new FakeCustomEvent(callbackEvent, {
        detail: {sequence: 1}
    }));
    assert.equal(await first, true);
    await flushMicrotasks();
    assert.deepEqual(firstResponses, [{sequence: 1}]);
    assert.deepEqual(secondResponses, []);
    assert.equal(current.calls.jsToAdvpl.length, 2);
    assert.equal(responseTarget.listenerCount(callbackEvent), 1);

    assert.equal(await clock.runNext(), true);
    assert.equal(await second, false);
    assert.equal(secondErrors[0].code, "FWWEBEX_TWEBCHANNEL_RESPONSE_TIMEOUT");
    await flushMicrotasks();
    assert.equal(current.calls.jsToAdvpl.length, 3);
    assert.equal(responseTarget.listenerCount(callbackEvent), 1);

    responseTarget.dispatchEvent(new FakeCustomEvent(callbackEvent, {
        detail: {sequence: 3}
    }));
    assert.equal(await third, true);
    assert.deepEqual(thirdResponses, [{sequence: 3}]);
    assert.equal(responseTarget.listenerCount(callbackEvent), 0);
    assert.equal(harness.activeIntervals.size, 0);
    assert.equal(clock.timers.size, 0);
});

test("RequestHandler permite callbackEvents diferentes em paralelo", async () => {
    const clock = new VirtualClock();
    const current = provider();
    const harness = createHarness({clock, channel: current.channel});
    const responseTarget = harness.FWWebEx.TWebChannel.getEventTarget();
    const responses = [];
    const first = harness.FWWebEx.RequestHandler.execute({
        requestData: {channel: "A"},
        callbackEvent: "CALLBACK_A",
        responseTimeout: 250,
        maxRetries: 1,
        interval: 1,
        onResponse: payload => responses.push(["A", payload])
    });
    const second = harness.FWWebEx.RequestHandler.execute({
        requestData: {channel: "B"},
        callbackEvent: "CALLBACK_B",
        responseTimeout: 250,
        maxRetries: 1,
        interval: 1,
        onResponse: payload => responses.push(["B", payload])
    });

    await flushMicrotasks();
    assert.equal(current.calls.jsToAdvpl.length, 2);
    assert.equal(responseTarget.listenerCount("CALLBACK_A"), 1);
    assert.equal(responseTarget.listenerCount("CALLBACK_B"), 1);

    responseTarget.dispatchEvent(new FakeCustomEvent("CALLBACK_B", {
        detail: {sequence: 2}
    }));
    responseTarget.dispatchEvent(new FakeCustomEvent("CALLBACK_A", {
        detail: {sequence: 1}
    }));

    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.deepEqual(responses, [
        ["B", {sequence: 2}],
        ["A", {sequence: 1}]
    ]);
    assert.equal(responseTarget.listenerCount("CALLBACK_A"), 0);
    assert.equal(responseTarget.listenerCount("CALLBACK_B"), 0);
    assert.equal(harness.activeIntervals.size, 0);
    assert.equal(clock.timers.size, 0);
});

test("HTML montado pela pagina nao inclui totvstec.js nem fwprotheus.js", () => {
    const htmlAssemblySource = pageConstructorSource + pageRenderSource;
    const privateLibrary = String.raw`(?:totvstec|fwprotheus)\.js`;

    assert.doesNotMatch(
        htmlAssemblySource,
        new RegExp(
            String.raw`SetContent\s*\(\s*["'][^"']*${privateLibrary}`,
            "iu"
        )
    );
    assert.doesNotMatch(
        htmlAssemblySource,
        new RegExp(
            String.raw`SetAttr\s*\(\s*["']src["']\s*,\s*["'][^"']*${privateLibrary}`,
            "iu"
        )
    );
    assert.doesNotMatch(
        htmlAssemblySource,
        /jObjectsContainer\s*\[\s*["']script-(?:totvstec|fwprotheus)/iu
    );
    assert.match(pageConstructorSource, /cPageScript:=FWWebExScripts\(\)/u);
});
