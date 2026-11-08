const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sitesSource = fs.readFileSync(path.join(__dirname, '..', 'src/shared/sites.js'), 'utf8');
const utilsSource = fs.readFileSync(path.join(__dirname, '..', 'src/shared/settings-utils.js'), 'utf8');
const contentSource = fs.readFileSync(path.join(__dirname, '..', 'src/content/gemini-content.js'), 'utf8');

function createEventTarget() {
    const listeners = new Map();

    return {
        addEventListener(type, listener, options) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(listener);
            const signal = options && options.signal;
            if (signal) signal.addEventListener('abort', () => {
                listeners.set(type, listeners.get(type).filter(item => item !== listener));
            });
        },
        dispatch(type, event = {}) {
            (listeners.get(type) || []).slice().forEach(listener => listener(event));
        },
        dispatchEvent(event) {
            this.dispatch(event.type, event);
            return true;
        }
    };
}

function createClassList() {
    const values = new Set();

    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        contains(value) {
            return values.has(value);
        },
        toggle(value, enabled) {
            if (enabled) values.add(value);
            else values.delete(value);
            return enabled;
        }
    };
}

function createPage(readyState, { supported = true, deferStorage = false, stored = {}, sharedPage = null } = {}) {
    const rootStyles = new Map();
    const rootPriorities = new Map();
    const timers = new Map();
    const counts = { storageGet: 0, observerStart: 0, observerStop: 0, messageListeners: 0, storageChangeListeners: 0 };
    const pendingStorage = [];
    let deliverMessage;
    let deliverStorage;
    let deliverMutation;
    let nextTimerId = 1;

    const document = sharedPage ? sharedPage.document : {
        ...createEventTarget(),
        readyState,
        documentElement: {
            isConnected: true,
            classList: createClassList(),
            style: {
                setProperty(property, value, priority = '') {
                    rootStyles.set(property, value);
                    rootPriorities.set(property, priority);
                },
                getPropertyValue(property) {
                    return rootStyles.get(property) || '';
                },
                getPropertyPriority(property) {
                    return rootPriorities.get(property) || '';
                },
                removeProperty(property) {
                    rootStyles.delete(property);
                    rootPriorities.delete(property);
                }
            }
        },
        body: {
            classList: createClassList()
        },
        querySelector(selector) {
            return supported && selector.includes('input-container input-area-v2') ? {} : null;
        },
        querySelectorAll() {
            return [];
        }
    };

    const sandbox = {
        ...createEventTarget(),
        document,
        location: { href: 'https://gemini.google.com/app' },
        history: {
            pushState() {},
            replaceState() {}
        },
        chrome: {
            runtime: {
                id: 'test-extension',
                onMessage: {
                    addListener(listener) {
                        counts.messageListeners += 1;
                        deliverMessage = listener;
                    }
                }
            },
            storage: {
                sync: {
                    get(keys, callback) {
                        counts.storageGet += 1;
                        const complete = () => callback({
                            chatWidthSetting: { value: 1200, unit: 'px' },
                            codeWrap: true,
                            ...stored
                        });
                        if (deferStorage) pendingStorage.push(complete);
                        else complete();
                    }
                },
                onChanged: {
                    addListener(listener) {
                        counts.storageChangeListeners += 1;
                        deliverStorage = listener;
                    }
                }
            }
        },
        MutationObserver: class {
            constructor(callback) {
                deliverMutation = callback;
            }
            observe() {
                counts.observerStart += 1;
            }
            disconnect() {
                counts.observerStop += 1;
            }
        },
        Event: class {
            constructor(type) {
                this.type = type;
            }
        },
        AbortController,
        getComputedStyle() {
            return {
                getPropertyValue(property) {
                    return rootStyles.get(property) || '';
                }
            };
        },
        requestAnimationFrame(callback) {
            return sandbox.setTimeout(callback, 16);
        },
        cancelAnimationFrame(id) {
            sandbox.clearTimeout(id);
        },
        setTimeout(callback, delay = 0) {
            const id = nextTimerId;
            nextTimerId += 1;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        console: {
            log() {},
            error() {},
            table() {}
        }
    };

    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    const context = vm.createContext(sandbox);
    vm.runInContext(sitesSource, context, { filename: 'sites.js' });
    vm.runInContext(utilsSource, context, { filename: 'settings-utils.js' });

    return {
        sandbox,
        document,
        rootStyles: sharedPage ? sharedPage.rootStyles : rootStyles,
        counts,
        send(message) {
            let response;
            deliverMessage(message, {}, value => { response = value; });
            return response;
        },
        change(changes) {
            deliverStorage(changes, 'sync');
        },
        setSupported(value) {
            supported = value;
            deliverMutation([]);
        },
        completeStorage() {
            pendingStorage.splice(0).forEach(complete => complete());
        },
        runContentScript() {
            vm.runInContext(contentSource, context, { filename: 'gemini-content.js' });
        },
        runTimers(delay) {
            Array.from(timers.entries())
                .filter(([, timer]) => timer.delay === delay)
                .forEach(([id, timer]) => {
                    timers.delete(id);
                    timer.callback();
                });
        }
    };
}

{
    const page = createPage('loading');
    page.runContentScript();

    assert.strictEqual(page.sandbox.widerGeminiContentLoaded, true, 'content script marks the page as loaded for background.js');
    assert.strictEqual(page.counts.storageGet, 0, 'nothing is applied before the DOM is ready');

    page.document.dispatch('DOMContentLoaded');
    assert.strictEqual(page.counts.storageGet, 1, 'DOMContentLoaded initializes settings once');
    assert.strictEqual(page.counts.observerStart, 1, 'DOMContentLoaded starts one mutation observer');
    assert.strictEqual(page.rootStyles.get('--gemini-chat-width'), '1200px');
    assert.ok(page.document.body.classList.contains('code-wrap-enabled'));

    page.sandbox.dispatch('load');
    assert.strictEqual(page.counts.storageGet, 1, 'load must not initialize the content script a second time');
    assert.strictEqual(page.counts.observerStart, 1, 'load must not attach duplicate observers');

    page.runContentScript();
    page.document.dispatch('DOMContentLoaded');
    page.sandbox.dispatch('load');
    assert.strictEqual(page.counts.storageGet, 1, 're-injection must not reapply settings');
    assert.strictEqual(page.counts.observerStart, 1, 're-injection must not attach duplicate observers');
    assert.strictEqual(page.counts.messageListeners, 1, 're-injection must not register duplicate message listeners');
    assert.strictEqual(page.counts.storageChangeListeners, 1, 're-injection must not register duplicate storage listeners');
}

{
    const page = createPage('complete');
    page.runContentScript();

    assert.strictEqual(page.sandbox.widerGeminiContentLoaded, true);
    assert.strictEqual(page.counts.storageGet, 0, 'initialization is deferred to a macrotask');

    page.runTimers(0);
    assert.strictEqual(page.counts.storageGet, 1, 'late injection applies settings without a page reload');
    assert.strictEqual(page.counts.observerStart, 1, 'late injection starts one mutation observer');
    assert.strictEqual(page.rootStyles.get('--gemini-chat-width'), '1200px');
    assert.ok(page.document.body.classList.contains('code-wrap-enabled'));
}

{
    const oldPage = createPage('complete');
    oldPage.runContentScript();
    oldPage.runTimers(0);
    assert.strictEqual(oldPage.rootStyles.get('--gemini-chat-width'), '1200px');
    oldPage.sandbox.chrome.runtime.id = undefined;

    const newPage = createPage('complete', { sharedPage: oldPage, stored: { chatWidthSetting: { value: 900, unit: 'px' } } });
    newPage.runContentScript();
    assert.strictEqual(oldPage.counts.observerStop, 1, 'the new instance retires the old observer');
    assert.strictEqual(newPage.counts.observerStop, 0, 'the new instance does not retire itself');
    newPage.runTimers(0);
    assert.strictEqual(newPage.counts.observerStart, 1);
    assert.strictEqual(oldPage.rootStyles.get('--gemini-chat-width'), '900px');
    oldPage.setSupported(true);
    oldPage.sandbox.dispatch('resize');
    oldPage.runTimers(0);
    assert.strictEqual(oldPage.rootStyles.get('--gemini-chat-width'), '900px', 'the old instance no longer writes its stale width');
}

{
    const page = createPage('complete');
    page.runContentScript();
    page.runTimers(0);
    page.sandbox.chrome.runtime.id = undefined;
    page.setSupported(true);
    assert.strictEqual(page.counts.observerStop, 1, 'an orphaned instance stops observing on its own');
}

{
    const page = createPage('complete');
    page.runContentScript();
    page.runTimers(0);
    assert.strictEqual(page.send({ action: 'getLayoutStatus' }).status, 'active');
    page.send({ action: 'updateUserFullWidth', enabled: true });
    page.change({ widthEnabled: { newValue: false }, chatWidthSetting: { newValue: { value: 1400, unit: 'px' } } });
    assert.strictEqual(page.send({ action: 'getLayoutStatus' }).status, 'paused');
    assert.strictEqual(page.rootStyles.has('--gemini-chat-width'), false, 'pause removes the owned root width');
    assert.ok(page.document.body.classList.contains('code-wrap-enabled'), 'pause retains code wrap');
    assert.ok(!page.document.body.classList.contains('wider-gemini-user-full-width'), 'pause disables stretched bubbles');
    page.send({ action: 'updateWidthSetting', setting: { value: 1500, unit: 'px' } });
    assert.strictEqual(page.send({ action: 'getLayoutStatus' }).status, 'paused', 'legacy width messages do not re-enable');
    page.send({ action: 'updateWidthEnabled', enabled: true });
    assert.strictEqual(page.rootStyles.get('--gemini-chat-width'), '1500px', 'resume uses the retained width');
    assert.ok(page.document.body.classList.contains('wider-gemini-user-full-width'), 'resume restores bubble preference');
    page.setSupported(false);
    assert.strictEqual(page.send({ action: 'getLayoutStatus' }).status, 'unsupported');
    assert.strictEqual(page.rootStyles.has('--gemini-chat-width'), false, 'unknown layouts keep native width');
    page.setSupported(true);
    assert.strictEqual(page.rootStyles.get('--gemini-chat-width'), '1500px', 'known layouts resume after SPA navigation');
}

{
    const page = createPage('complete', { deferStorage: true });
    page.runContentScript();
    page.runTimers(0);
    page.send({ action: 'updateWidthEnabled', enabled: false });
    page.completeStorage();
    assert.strictEqual(page.send({ action: 'getLayoutStatus' }).status, 'paused');
    assert.strictEqual(page.rootStyles.has('--gemini-chat-width'), false);
    assert.ok(page.document.body.classList.contains('code-wrap-enabled'), 'late storage still loads unrelated preferences');
    page.send({ action: 'updateWidthEnabled', enabled: true });
    assert.strictEqual(page.rootStyles.get('--gemini-chat-width'), '1200px', 'late storage retains the saved width');
}

{
    const page = createPage('complete', { deferStorage: true, stored: { geminiEnabled: false } });
    page.runContentScript();
    page.runTimers(0);
    page.send({ action: 'updateWidthSetting', setting: { value: 1400, unit: 'px' }, enabled: true });
    assert.ok(!page.document.documentElement.classList.contains('wider-gemini-active'),
        'a width message cannot activate before settings load');
    page.completeStorage();
    const paused = page.send({ action: 'getLayoutStatus' });
    assert.strictEqual(paused.status, 'sitePaused');
    assert.strictEqual(paused.pauseReason, 'site');
    assert.strictEqual(paused.enabled, true, 'legacy enabled keeps its width-switch meaning');
    assert.strictEqual(paused.protocolVersion, 2);
    assert.ok(!page.document.documentElement.classList.contains('wider-gemini-active'));
    assert.ok(!page.document.documentElement.classList.contains('wider-gemini-width-enabled'));
    assert.ok(!page.document.body.classList.contains('code-wrap-enabled'), 'saved code wrap stays native while paused');
    assert.strictEqual(page.rootStyles.has('--gemini-chat-width'), false);
    assert.strictEqual(page.rootStyles.has('--gemini-font-scale'), false);

    page.change({ geminiEnabled: { newValue: true } });
    assert.ok(page.document.documentElement.classList.contains('wider-gemini-active'));
    assert.strictEqual(page.rootStyles.get('--gemini-chat-width'), '1400px', 'resume applies the latest width');
    assert.ok(page.document.body.classList.contains('code-wrap-enabled'));

    page.change({ widthEnabled: { newValue: false } });
    assert.ok(page.document.documentElement.classList.contains('wider-gemini-active'));
    assert.strictEqual(page.rootStyles.get('--gemini-font-scale'), '1');
    assert.strictEqual(page.send({ action: 'getLayoutStatus' }).pauseReason, 'width');

    const refreshed = page.send({ action: 'updateSiteEnabled' });
    assert.strictEqual(refreshed.protocolVersion, 2, 'v2 notifications report the protocol version');
}

console.log('gemini-content lifecycle tests passed');
