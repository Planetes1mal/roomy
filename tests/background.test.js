const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const backgroundSource = read(manifest.background.service_worker);
const sitesSource = read('src/shared/sites.js');
const declared = manifest.content_scripts[0];
const plain = value => JSON.parse(JSON.stringify(value));

assert.strictEqual(manifest.background.service_worker, 'src/background.js');
assert.ok(manifest.permissions.includes('scripting'), 'scripting permission is required for executeScript/insertCSS');
assert.deepStrictEqual(manifest.host_permissions, manifest.content_scripts.flatMap(script => script.matches),
    'host permissions must match the declared sites');
assert.ok(!manifest.permissions.includes('tabs'), 'tabs permission would add a browsing-history warning');
assert.ok(manifest.permissions.includes('activeTab'), 'toolbar popup must recognize an ungranted optional site tab');
assert.deepStrictEqual(manifest.host_permissions, ['https://gemini.google.com/*']);
assert.strictEqual(manifest.content_scripts.length, 1, 'optional sites must not have a static content script');
assert.ok(backgroundSource.startsWith("importScripts('shared/sites.js')"),
    'background loads the registry');
assert.ok(read('src/content/gemini-content.js').includes('window.widerGeminiContentLoaded = true'),
    'Gemini content script must set the loaded flag');

const registrySandbox = { globalThis: {} };
registrySandbox.globalThis = registrySandbox;
vm.runInNewContext(sitesSource, registrySandbox);
const registry = registrySandbox.widerRoomySites;
const optional = registry.optional();
assert.ok(optional.length >= 1 && optional[0].id === 'chatgpt', 'ChatGPT is the first optional site');
const scriptFor = site => plain(registry.getContentScript(site.id));
const introKey = site => registry.getStorageKeys(site.id).intro;

const tabs = [
    { id: 1, url: 'https://gemini.google.com/app', loaded: false },
    { id: 2, url: 'https://gemini.google.com/app/abc123', loaded: true },
    { id: 3, url: 'https://gemini.google.com/app', loaded: false, discarded: true },
    { id: 4, url: 'https://gemini.google.com/app', loaded: false, fails: true },
    { id: 7, url: 'https://example.com/', loaded: false }
];
const siteTabs = {};
let nextId = 10;
for (const site of optional) {
    siteTabs[site.id] = [nextId, nextId + 1];
    tabs.push({ id: nextId++, url: `${site.url}c/example`, loaded: false, site: site.id });
    tabs.push({ id: nextId++, url: site.url, loaded: true, site: site.id });
}
const tabsById = new Map(tabs.map(tab => [tab.id, tab]));
const listeners = {};
const calls = [];
const queries = [];
const granted = Object.fromEntries(optional.map(site => [site.id, false]));
let registered = [];
let registrations = 0;
const localStore = {};
let badgeText = '';
let popupOpens = 0;
let popupFails = false;

function siteOf(origins) {
    const site = optional.find(site => plain(site.matches).join() === Array.from(origins).join());
    assert.ok(site, `permissions are checked per site: ${Array.from(origins)}`);
    return site;
}

const sandbox = {
    console: { log() {}, error() {} },
    importScripts(file) {
        assert.strictEqual(file, 'shared/sites.js');
        vm.runInContext(sitesSource, context, { filename: 'sites.js' });
    },
    chrome: {
        permissions: {
            async contains(request) { return granted[siteOf(request.origins).id]; },
            onAdded: { addListener(listener) { listeners.onAdded = listener; } },
            onRemoved: { addListener(listener) { listeners.onRemoved = listener; } }
        },
        runtime: {
            getManifest() { return manifest; },
            onStartup: { addListener(listener) { listeners.onStartup = listener; } },
            onInstalled: { addListener(listener) { listeners.onInstalled = listener; } }
        },
        i18n: { getMessage: key => (key === 'badgeNew' ? 'NEW' : '') },
        storage: {
            local: {
                async get(keys) {
                    const list = Array.isArray(keys) ? keys : [keys];
                    return Object.fromEntries(list.filter(key => key in localStore).map(key => [key, localStore[key]]));
                },
                async set(values) { Object.assign(localStore, values); },
                async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete localStore[key]; }
            }
        },
        action: {
            async setBadgeBackgroundColor() {},
            async setBadgeText(details) { badgeText = details.text; },
            async openPopup() {
                if (popupFails) throw new Error('Browser window is not active.');
                popupOpens++;
            }
        },
        tabs: {
            async query(queryInfo) {
                queries.push(queryInfo);
                return tabs.filter(tab => queryInfo.url.some(pattern => tab.url.startsWith(pattern.slice(0, -1))))
                    .map(({ id, url, discarded }) => ({ id, url, discarded }));
            }
        },
        scripting: {
            async getRegisteredContentScripts({ ids }) { return registered.filter(script => ids.includes(script.id)); },
            async registerContentScripts(scripts) {
                registrations++;
                registered = registered.concat(scripts);
            },
            async unregisterContentScripts({ ids }) { registered = registered.filter(script => !ids.includes(script.id)); },
            async executeScript(injection) {
                const tab = tabsById.get(injection.target.tabId);

                if (injection.func) {
                    const flags = { widerGeminiContentLoaded: tab.site ? true : tab.loaded };
                    for (const site of optional) {
                        const flag = scriptFor(site).loadedFlag;
                        if (tab.site === site.id) flags[flag] = tab.loaded;
                        else if (!(flag in flags)) flags[flag] = true;
                    }
                    sandbox.window = flags;
                    const result = injection.func(...injection.args);
                    delete sandbox.window;
                    calls.push({ tabId: tab.id, type: 'check', immediate: injection.injectImmediately });
                    return [{ result }];
                }

                if (tab.fails) throw new Error('Frame with ID 0 was removed.');
                calls.push({ tabId: tab.id, type: 'js', files: injection.files, immediate: injection.injectImmediately });
                tab.loaded = true;
                return [{ result: undefined }];
            },
            async insertCSS(injection) {
                const tab = tabsById.get(injection.target.tabId);
                if (tab.fails) throw new Error('Frame with ID 0 was removed.');
                calls.push({ tabId: tab.id, type: 'css', files: injection.files });
            }
        }
    }
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const context = vm.createContext(sandbox);
vm.runInContext(backgroundSource, context, { filename: 'background.js' });

assert.ok(listeners.onStartup, 'browser startup must trigger re-injection');
assert.ok(listeners.onInstalled, 'install/update must trigger re-injection');

function typesFor(tabId) {
    return calls.filter(call => call.tabId === tabId).map(call => call.type);
}

function filesFor(tabId, type) {
    return plain(calls.find(call => call.tabId === tabId && call.type === type).files);
}

(async () => {
    await listeners.onStartup();

    assert.strictEqual(queries.length, 1, 'ungranted optional sites are not queried or injected');
    queries.forEach(query => assert.deepStrictEqual(Object.keys(query), ['url']));
    assert.deepStrictEqual(plain(queries[0].url), declared.matches);
    assert.strictEqual(registered.length, 0);
    for (const site of optional) assert.deepStrictEqual(typesFor(siteTabs[site.id][0]), [], `${site.id} stays native`);

    assert.deepStrictEqual(typesFor(1), ['check', 'css', 'js']);
    const css = calls.find(call => call.tabId === 1 && call.type === 'css');
    const js = calls.find(call => call.tabId === 1 && call.type === 'js');
    assert.deepStrictEqual(css.files, declared.css);
    assert.deepStrictEqual(js.files, declared.js);
    assert.strictEqual(js.immediate, true, 'injection must not wait for document_idle');

    assert.deepStrictEqual(typesFor(2), ['check']);

    assert.deepStrictEqual(typesFor(3), []);

    assert.deepStrictEqual(typesFor(4), ['check']);

    for (const site of optional) {
        calls.length = 0;
        granted[site.id] = true;
        await listeners.onAdded();
        const expected = scriptFor(site);
        const own = plain(registered.find(script => script.id === expected.id));
        assert.ok(own, `${site.id} is registered`);
        assert.deepStrictEqual(own.matches, plain(site.matches));
        assert.strictEqual(own.runAt, 'document_start');
        assert.strictEqual(own.persistAcrossSessions, true);
        assert.deepStrictEqual(own.js, expected.js);
        assert.deepStrictEqual(own.css, expected.css);
        assert.strictEqual(own.loadedFlag, undefined, 'registry-only fields are not passed to Chrome');
        assert.deepStrictEqual(own.js.slice(0, 2), ['src/shared/sites.js', 'src/shared/settings-utils.js']);
        const [fresh, loaded] = siteTabs[site.id];
        assert.deepStrictEqual(typesFor(fresh), ['check', 'css', 'js']);
        assert.deepStrictEqual(filesFor(fresh, 'css'), expected.css);
        assert.deepStrictEqual(filesFor(fresh, 'js'), expected.js);
        assert.deepStrictEqual(typesFor(loaded), ['check']);
        assert.deepStrictEqual(typesFor(7), [], 'unrelated sites must not be injected');
        assert.deepStrictEqual(typesFor(1), [], `${site.id} grant does not touch Gemini`);
        for (const other of optional.filter(other => other !== site && !granted[other.id])) {
            assert.deepStrictEqual(typesFor(siteTabs[other.id][0]), [], `${site.id} grant does not touch ${other.id}`);
            assert.ok(!registered.some(script => script.id === scriptFor(other).id), `${other.id} stays unregistered`);
        }
        granted[site.id] = false;
        await listeners.onRemoved();
        assert.ok(!registered.some(script => script.id === expected.id), `${site.id} revoke unregisters it`);
    }
    granted.chatgpt = true;
    await listeners.onAdded();
    assert.strictEqual(registered.length, 1);

    calls.length = 0;
    const before = registrations;
    await listeners.onInstalled();
    assert.deepStrictEqual(typesFor(1), ['check']);
    assert.deepStrictEqual(typesFor(siteTabs.chatgpt[0]), ['check']);
    await listeners.onStartup();
    assert.strictEqual(registrations, before, 'startup and install registration must be idempotent');

    registered = [];
    await listeners.onStartup();
    assert.strictEqual(registrations, before + 1);
    calls.length = 0;
    granted.chatgpt = false;
    await listeners.onRemoved();
    assert.strictEqual(registered.length, 0);
    assert.strictEqual(calls.length, 0);
    await listeners.onInstalled();
    assert.deepStrictEqual(typesFor(siteTabs.chatgpt[0]), [], 'revoked ChatGPT access must remain native');
    assert.strictEqual(popupOpens, 0, 'restoring scripts alone must not open the popup');
    assert.strictEqual(badgeText, '');

    const settingsSandbox = { globalThis: {} };
    settingsSandbox.globalThis = settingsSandbox;
    vm.runInNewContext(sitesSource, settingsSandbox);
    vm.runInNewContext(read('src/shared/settings-utils.js'), settingsSandbox);
    assert.strictEqual(settingsSandbox.widerGeminiSettings.CHATGPT_INTRO_KEY, introKey(optional[0]));
    assert.strictEqual(introKey(optional[0]), 'chatgptIntroPending', 'ChatGPT keeps the 3.0 intro key');

    const flagged = () => plain(optional.filter(site => localStore[introKey(site)]).map(site => site.id));
    const clearFlags = () => optional.forEach(site => delete localStore[introKey(site)]);
    const since = version => plain(registry.addedSince(version).map(site => site.id));
    await listeners.onInstalled({ reason: 'update', previousVersion: '2.8.0' });
    assert.deepStrictEqual(flagged(), plain(optional.map(site => site.id)), 'updating from 2.x flags every optional site');
    assert.ok(flagged().every(id => localStore[introKey({ id })] === 'update'));
    assert.strictEqual(badgeText, 'NEW');
    assert.strictEqual(popupOpens, 0, 'updates must not open the popup');

    badgeText = '';
    await listeners.onStartup();
    assert.strictEqual(badgeText, 'NEW');
    granted.chatgpt = true;
    await listeners.onAdded();
    assert.ok(!(introKey(optional[0]) in localStore), 'granting ChatGPT clears its flag');
    assert.deepStrictEqual(flagged(), since('3.0.0').filter(id => id !== 'chatgpt'));
    assert.strictEqual(badgeText, flagged().length ? 'NEW' : '', 'badge stays only while another ungranted site is flagged');
    for (const site of optional) granted[site.id] = true;
    await listeners.onAdded();
    assert.deepStrictEqual(flagged(), [], 'granting every site clears every flag');
    assert.strictEqual(badgeText, '');

    await listeners.onInstalled({ reason: 'install' });
    assert.strictEqual(popupOpens, 0);
    assert.strictEqual(badgeText, '');
    for (const site of optional) granted[site.id] = false;
    await listeners.onRemoved();

    await listeners.onInstalled({ reason: 'update', previousVersion: '3.0.1' });
    assert.deepStrictEqual(flagged(), since('3.0.1'), 'updating from 3.0.1 flags only sites added later');
    assert.strictEqual(badgeText, flagged().length ? 'NEW' : '');
    assert.strictEqual(popupOpens, 0);
    clearFlags();
    badgeText = '';
    const current = optional.reduce((latest, site) => registry.compareVersions(site.since, latest) > 0 ? site.since : latest, manifest.version);
    for (const details of [{ reason: 'update', previousVersion: current },
        { reason: 'update', previousVersion: '99.0.0' }, { reason: 'update' }, { reason: 'chrome_update' }]) {
        await listeners.onInstalled(details);
    }
    assert.deepStrictEqual(flagged(), []);
    assert.strictEqual(badgeText, '');

    await listeners.onInstalled({ reason: 'install' });
    assert.strictEqual(popupOpens, 1);
    assert.deepStrictEqual(flagged(), plain(optional.map(site => site.id)));
    assert.ok(flagged().every(id => localStore[introKey({ id })] === 'install'));
    assert.strictEqual(badgeText, 'NEW');

    clearFlags();
    badgeText = '';
    popupFails = true;
    calls.length = 0;
    await listeners.onInstalled({ reason: 'install' });
    assert.strictEqual(popupOpens, 1);
    assert.deepStrictEqual(flagged(), plain(optional.map(site => site.id)));
    assert.strictEqual(badgeText, 'NEW');
    assert.deepStrictEqual(typesFor(1), ['check']);

    console.log(`background tests passed (${optional.length} optional sites)`);
})().catch(error => {
    console.error(error);
    process.exit(1);
});
