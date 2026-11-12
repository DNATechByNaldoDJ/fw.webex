"use strict";
/* globals window, document, console, MessageChannel, WebSocket, QWebChannel, CustomEvent */

/* jshint ignore:start */
// QWebChannel.min.js
function QObject(e, n, t) { function o(e, n) { var o = e[0], r = e[1]; i[o] = { connect: function(e) { return "function" != typeof e ? void console.error("Bad callback given to connect to signal " + o) : (i.__objectSignals__[r] = i.__objectSignals__[r] || [], i.__objectSignals__[r].push(e), void (n || "destroyed" === o || t.exec({ type: QWebChannelMessageTypes.connectToSignal, object: i.__id__, signal: r }))) }, disconnect: function(e) { if ("function" != typeof e) return void console.error("Bad callback given to disconnect from signal " + o); i.__objectSignals__[r] = i.__objectSignals__[r] || []; var a = i.__objectSignals__[r].indexOf(e); return -1 === a ? void console.error("Cannot find connection of signal " + o + " to " + e.name) : (i.__objectSignals__[r].splice(a, 1), void (n || 0 !== i.__objectSignals__[r].length || t.exec({ type: QWebChannelMessageTypes.disconnectFromSignal, object: i.__id__, signal: r }))) } } } function r(e, n) { var t = i.__objectSignals__[e]; t && t.forEach(function(e) { e.apply(e, n) }) } function a(e) { var n = e[0], o = e[1]; i[n] = function() { for (var e, n = [], r = 0; r < arguments.length; ++r) "function" == typeof arguments[r] ? e = arguments[r] : n.push(arguments[r]); t.exec({ type: QWebChannelMessageTypes.invokeMethod, object: i.__id__, method: o, args: n }, function(n) { if (void 0 !== n) { var t = i.unwrapQObject(n); e && e(t) } }) } } function s(e) { var n = e[0], r = e[1], a = e[2]; i.__propertyCache__[n] = e[3], a && (1 === a[0] && (a[0] = r + "Changed"), o(a, !0)), Object.defineProperty(i, r, { get: function() { var e = i.__propertyCache__[n]; return void 0 === e && console.warn('Undefined value in property cache for property "' + r + '" in object ' + i.__id__), e }, set: function(e) { return void 0 === e ? void console.warn("Property setter for " + r + " called with undefined value!") : (i.__propertyCache__[n] = e, void t.exec({ type: QWebChannelMessageTypes.setProperty, object: i.__id__, property: n, value: e })) } }) } this.__id__ = e, t.objects[e] = this, this.__objectSignals__ = {}, this.__propertyCache__ = {}; var i = this; this.unwrapQObject = function(e) { if (e instanceof Array) { for (var n = new Array(e.length), o = 0; o < e.length; ++o) n[o] = i.unwrapQObject(e[o]); return n } if (!e || !e["__QObject*__"] || void 0 === e.id) return e; var r = e.id; if (t.objects[r]) return t.objects[r]; if (!e.data) return void console.error("Cannot unwrap unknown QObject " + r + " without data."); var a = new QObject(r, e.data, t); return a.destroyed.connect(function() { if (t.objects[r] === a) { delete t.objects[r]; var e = []; for (var n in a) e.push(n); for (var o in e) delete a[e[o]] } }), a.unwrapProperties(), a }, this.unwrapProperties = function() { for (var e in i.__propertyCache__) i.__propertyCache__[e] = i.unwrapQObject(i.__propertyCache__[e]) }, this.propertyUpdate = function(e, n) { for (var t in n) { var o = n[t]; i.__propertyCache__[t] = o } for (var a in e) r(a, e[a]) }, this.signalEmitted = function(e, n) { r(e, n) }, n.methods.forEach(a), n.properties.forEach(s), n.signals.forEach(function(e) { o(e, !1) }); for (var e in n.enums) i[e] = n.enums[e] } var QWebChannelMessageTypes = { signal: 1, propertyUpdate: 2, init: 3, idle: 4, debug: 5, invokeMethod: 6, connectToSignal: 7, disconnectFromSignal: 8, setProperty: 9, response: 10 }, QWebChannel = function(e, n) { if ("object" != typeof e || "function" != typeof e.send) return void console.error("The QWebChannel expects a transport object with a send function and onmessage callback property. Given is: transport: " + typeof e + ", transport.send: " + typeof e.send); var t = this; this.transport = e, this.send = function(e) { "string" != typeof e && (e = JSON.stringify(e)), t.transport.send(e) }, this.transport.onmessage = function(e) { var n = e.data; switch ("string" == typeof n && (n = JSON.parse(n)), n.type) { case QWebChannelMessageTypes.signal: t.handleSignal(n); break; case QWebChannelMessageTypes.response: t.handleResponse(n); break; case QWebChannelMessageTypes.propertyUpdate: t.handlePropertyUpdate(n); break; default: console.error("invalid message received:", e.data) } }, this.execCallbacks = {}, this.execId = 0, this.exec = function(e, n) { return n ? (t.execId === Number.MAX_VALUE && (t.execId = Number.MIN_VALUE), e.hasOwnProperty("id") ? void console.error("Cannot exec message with property id: " + JSON.stringify(e)) : (e.id = t.execId++ , t.execCallbacks[e.id] = n, void t.send(e))) : void t.send(e) }, this.objects = {}, this.handleSignal = function(e) { var n = t.objects[e.object]; n ? n.signalEmitted(e.signal, e.args) : console.warn("Unhandled signal: " + e.object + "::" + e.signal) }, this.handleResponse = function(e) { return e.hasOwnProperty("id") ? (t.execCallbacks[e.id](e.data), void delete t.execCallbacks[e.id]) : void console.error("Invalid response message received: ", JSON.stringify(e)) }, this.handlePropertyUpdate = function(e) { for (var n in e.data) { var o = e.data[n], r = t.objects[o.object]; r ? r.propertyUpdate(o.signals, o.properties) : console.warn("Unhandled property update: " + o.object + "::" + o.signal) } t.exec({ type: QWebChannelMessageTypes.idle }) }, this.debug = function(e) { t.send({ type: QWebChannelMessageTypes.debug, data: e }) }, t.exec({ type: QWebChannelMessageTypes.init }, function(e) { for (var o in e) var r = new QObject(o, e[o], t); for (var o in t.objects) t.objects[o].unwrapProperties(); n && n(t), t.exec({ type: QWebChannelMessageTypes.idle }) }) }; "object" == typeof module && (module.exports = { QWebChannel: QWebChannel });
/* jshint ignore:end */

var getParam = function(queryField) {
    var url = window.location.href;
    queryField = queryField.replace(/[\[\]]/g, "\\$&");

    var regex = new RegExp("[?&]" + queryField + "(=([^&#]*)|&|#|$)", "i"),
        results = regex.exec(url);

    if (!results)
        return null;

    if (!results[2])
        return '';

    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

var origin = getParam('totvstec_remote_origin');
if ((origin === null) || (origin === '')) {
    origin = '*'
}


window.onmessage = function(event) {
    var data = event.data;

    if ((origin !== '*') && (event.origin !== origin)) {
        console.log('unexpected origin', event.origin, origin);
        return;
    }

    if ((data.type ? data.type : '').toUpperCase() !== 'MS_WEBENGINERUNJAVASCRIPT') {
        console.log('unexpected message type');
        return;
    }

    eval(data.value);
}


var twebchannel = {
    // Versao
    version: "1.0.4",

    // Porta do WebSocket
    internalPort: 0,

    // Defines do OpenSettings e TestDevice
    BLUETOOTH_FEATURE: 1,
    NFC_FEATURE: 2,
    WIFI_FEATURE: 3,
    LOCATION_FEATURE: 4,
    CONNECTED_WIFI: 5,
    CONNECTED_MOBILE: 6,

    connect: function(callback) {
        var port = getParam('totvstec_websocket_port'),
            remoteType = getParam('totvstec_remote_type'),
            threadId = getParam('totvstec_threadId');

        this.init(port, remoteType, threadId, callback);
    },

    init: function(port, remoteType, threadId, callback) {
        this.internalPort = Number(port);
        this.remoteType = Number(remoteType);
        this.threadId = threadId;

        var fireEvent = function() {
            var event = new CustomEvent('twebchannelready');

            document.dispatchEvent(event);

            if (typeof callback === 'function')
                callback();
        };

        if (this.remoteType !== 5) {
            this.connectWS(fireEvent);
        }
        else {
            this.connectMessageChannel(fireEvent);
        }
    },

    jsToAdvpl: function(key, value) {
        //console.log('not connected');

        if (this.remoteType !== 5) {
            window.dialog.jsToAdvpl(key, value);
        }
        else {
            this.sendMessageChannel(key, value);
        }
    },

    advplToJs: function(key, value) {
        console.log('not connected');
    },

    // Conecta WebSocket e prepara mensageria global
    connectWS: function(callback) {
        var baseUrl = "ws://127.0.0.1:" + this.internalPort,
            socket = new WebSocket(baseUrl);

        socket.onclose = function() { console.error("WebChannel closed"); };
        socket.onerror = function(error) { console.error("WebChannel error: " + error); };
        socket.onopen = function() {
            new QWebChannel(socket, function(channel) {
                window.dialog = channel.objects.mainDialog;

                // Carrega mensageria global [CSS, JavaScript]
                window.dialog.advplToJs.connect(twebchannel.onReceiveAdvplToJs.bind(twebchannel));

                // Executa callback
                if (typeof callback === 'function')
                    callback();
            });
        };
    },


    onReceiveAdvplToJs: function(key, value) {
        this.advplToJs(key, value);
    },

    connectMessageChannel: function(callback) {
        this.channel = new MessageChannel();

        this.channel.port1.onmessage = function(event) {
            var data = event.data,
                messageType = (data.type || 'UNDEFINED').toUpperCase();

            switch (messageType) {
                case 'CONNECTED':
                    window.dialog = window.dialog || {};
                    window.dialog.jsToAdvpl = twebchannel.sendMessageChannel.bind(twebchannel);

                    if (typeof callback === 'function')
                        callback();

                    //this.queue.setMaxPendingPromises(1);

                    break;
                case 'DISCONNECTED':
                    console.log("received a DISCONNECTED message.", event);

                    break;
                case 'EXEC':
                    twebchannel.onReceiveAdvplToJs(
                        data.value.type,
                        data.value.content
                    );

                    break;
                case 'RETURN':
                    //console.log("received a RETURN message.", event);

                    break;
                default:
                    console.error("invalid message: " + messageType, event);

                    break;
            }
        };

        window.parent.postMessage({
            type: 'CONNECT',
            port: this.internalPort,
            threadId: this.threadId
        }, origin, [this.channel.port2]);
    },

    sendMessageChannel: function(key, value) {
        var message = {
            type: key,
            content: value,
            port: this.internalPort
        };

        this.channel.port1.postMessage(message);
    }

};
