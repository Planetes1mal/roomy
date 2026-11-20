const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const runtime = fs.readFileSync(path.join(__dirname, '../src/content/core/runtime.js'), 'utf8');

function page(beforePaint) {
    const document = new EventTarget();
    document.readyState = 'loading';
    document.documentElement = null;
    const window = new EventTarget();
    const observers = [];
    const frames = new Map();
    let serial = 0;
    let read;
    let writes = 0;
    let discoveries = 0;
    let surface = { kind: 'notApplicable' };
    const noop = () => {};
    window.widerRoomySites = { CORE_LOADED_FLAG: 'loaded', CORE_TAKEOVER_EVENT: 'takeover', get: () => ({ modeUrl: true }) };
    window.widerGeminiSettings = {
        getSiteKeys: () => ({}), getSiteStorageKeys: () => ['enabled'],
        normalizeSiteSettings: stored => ({ siteEnabled: stored.enabled !== false })
    };
    const chrome = {
        runtime: { id: 'test', onMessage: { addListener: noop } },
        storage: { sync: { get(keys, callback) { read = callback; } }, onChanged: { addListener: noop } }
    };
    window.widerRoomyCore = { modules: {
        width: () => ({ sync() { writes++; }, retire: noop }),
        reading: () => ({ apply: noop, retire: noop }), navigation: () => ({ queue: noop, retire: noop })
    } };
    class MutationObserver {
        constructor(callback) { this.callback = callback; }
        observe(target) { this.target = target; observers.push(this); }
        disconnect() { this.target = null; }
    }
    vm.runInNewContext(runtime, { window, document, chrome, MutationObserver, AbortController, Event,
        requestAnimationFrame(callback) { frames.set(++serial, callback); return serial; },
        cancelAnimationFrame(id) { frames.delete(id); } });
    const ctx = window.widerRoomyCore.defineSite({
        id: 'fixture',
        watch: { markers: '.surface', beforePaint },
        discover() { discoveries++; return surface; }
    });
    function element(marked = true) {
        const attrs = new Map();
        return {
            nodeType: 1, matches: () => marked, querySelector: () => null,
            contains(node) { return node === this || node.parentElement === this; },
            getAttribute: key => attrs.get(key), setAttribute: (name, value) => attrs.set(name, value), removeAttribute: k => attrs.delete(k),
            classList: { toggle: noop }
        };
    }
    function mutate(record) {
        for (const observer of observers) {
            if (observer.target) observer.callback([record]);
        }
    }
    function insert(node, target = document.documentElement) {
        mutate({ type: 'childList', target, addedNodes: [node], removedNodes: [] });
    }
    return {
        ctx, document, element, frames, observers, insert, mutate,
        get writes() { return writes; },
        get discoveries() { return discoveries; },
        settings(enabled = true) { read({ enabled }); },
        scene(next) { surface = next; },
        ready() { document.readyState = 'interactive'; document.dispatchEvent(new Event('DOMContentLoaded')); },
        frame() {
            for (const [id, callback] of [...frames]) {
                frames.delete(id);
                callback(16);
            }
        }
    };
}

// Storage can finish on either side of mounting the parser-created document element.
for (const storedFirst of [true, false]) {
    const p = page(true);
    assert.equal(p.observers.length, 1);
    assert.equal(p.observers[0].target, p.document);
    if (storedFirst) p.settings();
    const grid = p.document.documentElement = p.element();
    p.scene({ kind: 'chat', root: grid, widthOwners: [grid] });
    p.insert(grid);
    if (!storedFirst) {
        assert.equal(p.ctx.siteActive, false, 'do not apply defaults while the preference is outstanding');
        p.settings();
    }
    assert.equal(p.ctx.siteActive, true);
    assert.equal(p.ctx.surface.root, grid, 'use the saved setting without a frame or DOMContentLoaded');

    const written = p.writes;
    const discovered = p.discoveries;
    for (let i = 0; i < 20; i++) p.insert(p.element(false));
    assert.equal(p.discoveries, discovered, 'streaming text wrappers do not trigger discovery');
    const message = p.element();
    message.parentElement = grid;
    for (let i = 0; i < 20; i++) p.insert(p.element(), message);
    assert.equal(p.discoveries, discovered, 'streamed markers in an existing message leave discovery to the next frame');
    p.insert(grid);
    p.insert(grid);
    assert.equal(p.writes, written, 'unchanged marked surfaces coalesce writes');
    assert.equal(p.frames.size, 1);

    p.scene({ kind: 'notApplicable' });
    p.mutate({ type: 'attributes', attributeName: 'hidden', target: grid });
    assert.equal(p.ctx.siteActive, false, 'retire the departing surface while View Transition pauses frames');
    assert.equal(p.frames.size, 0, 'a synchronous surface change replaces the pending frame');
    p.scene({ kind: 'unknown' });
    p.mutate({ type: 'childList', target: p.document, addedNodes: [], removedNodes: [grid] });
    p.scene({ kind: 'chat', root: grid, nativeWidth: true });
    p.insert(grid);
    p.scene({ kind: 'chat', root: grid, widthOwners: [grid] });
    p.insert(grid);
    assert.equal(p.ctx.surface.widthOwners.length, 1, 'a partially mounted surface becomes eligible in the observer callback');
    p.ready();
    assert.equal(p.observers.length, 1, 'DOMContentLoaded does not register a second observer');
    p.document.dispatchEvent(new Event('takeover'));
    assert.equal(p.observers[0].target, null);
    assert.equal(p.frames.size, 0);
}

const paused = page(true);
const grid = paused.document.documentElement = paused.element();
paused.scene({ kind: 'chat', root: grid, widthOwners: [grid] });
paused.insert(grid);
paused.settings(false);
assert.equal(paused.ctx.siteActive, false, 'saved site pause wins on first mount');

const ordinary = page(false);
ordinary.settings();
assert.equal(ordinary.observers.length, 0, 'other adapters defer observation until DOMContentLoaded');
const root = ordinary.document.documentElement = ordinary.element();
ordinary.ready();
assert.equal(ordinary.observers[0].target, root);
ordinary.scene({ kind: 'chat', root, widthOwners: [root] });
ordinary.insert(root);
assert.equal(ordinary.ctx.surface.root, null);
ordinary.frame();
assert.equal(ordinary.ctx.surface.root, root, 'the default observer still waits for rAF');

console.log('Google AI Mode lifecycle tests passed');
