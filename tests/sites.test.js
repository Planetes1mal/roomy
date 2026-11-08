const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const sandbox = { console, URL, Intl };
sandbox.globalThis = sandbox;
vm.runInNewContext(read('src/shared/sites.js'), sandbox, { filename: 'sites.js' });
vm.runInNewContext(read('src/shared/settings-utils.js'), sandbox, { filename: 'settings-utils.js' });
const registry = sandbox.widerRoomySites;
const utils = sandbox.widerGeminiSettings;
const sites = registry.sites;
const plain = value => JSON.parse(JSON.stringify(value));
const exists = file => fs.existsSync(path.join(root, file));
const packaged = file => /^src\/.+\.(js|css|html)$/.test(file);

assert.ok(sites.length >= 2, 'the registry lists the supported sites');
assert.ok(sites.some(site => site.id === 'gemini') && sites.some(site => site.id === 'chatgpt'));

const ids = sites.map(site => site.id);
assert.deepStrictEqual([...new Set(ids)], plain(ids), 'site ids are unique');
for (const site of sites) {
    assert.match(site.id, /^[a-z][a-z0-9]*$/, `${site.id}: id is lowercase ASCII`);
    assert.ok(site.name.trim(), `${site.id}: name`);
    assert.match(site.url, /^https:\/\/[^/]+\/$/, `${site.id}: url is an https origin`);
    assert.ok(Array.isArray(site.matches) && site.matches.length, `${site.id}: matches`);
    for (const pattern of site.matches) assert.match(pattern, /^https:\/\/[^/*]+\/\*$/, `${site.id}: match pattern ${pattern}`);
    assert.ok(registry.matchesUrl(site.matches[0], site.url), `${site.id}: url matches its own pattern`);
    assert.ok(['required', 'optional'].includes(site.access), `${site.id}: access`);
    assert.match(site.since, /^\d+\.\d+\.\d+$/, `${site.id}: since`);
    const [major, minor] = manifest.version.split('.').map(Number);
    assert.ok(registry.compareVersions(site.since, `${major}.${minor + 1}.0`) <= 0, `${site.id}: since ${site.since} is later than the next release ${major}.${minor + 1}.0`);
    assert.ok(['core', 'legacy'].includes(site.runtime), `${site.id}: runtime`);
    assert.ok(['default', 'gemini-legacy'].includes(site.storage), `${site.id}: storage codec`);
    assert.ok(site.capabilities.length && site.capabilities.every(c => registry.CAPABILITIES.includes(c)), `${site.id}: capabilities`);
    assert.ok(site.capabilities.includes('width') && site.capabilities.includes('navigation'), `${site.id}: width and navigation are the minimum`);
    assert.ok(site.tasks.length && site.tasks.every(task => utils.TASK_DEFINITIONS[task]), `${site.id}: tasks are defined`);
    assert.deepStrictEqual(Object.keys(utils.TASK_PRESETS[site.id]), plain(site.tasks), `${site.id}: task presets follow the registry`);
    if (site.runtime === 'core') {
        assert.ok(site.adapter && exists(site.adapter.js) && packaged(site.adapter.js), `${site.id}: adapter script exists and is packaged`);
        if (site.adapter.css) assert.ok(exists(site.adapter.css) && packaged(site.adapter.css), `${site.id}: adapter stylesheet`);
        const adapter = read(site.adapter.js);
        assert.ok(adapter.includes('widerRoomyCore.defineSite('), `${site.id}: adapter registers with the core`);
        assert.ok(/\bselectors\b/.test(adapter) && /defineSite\(\{[\s\S]*\bselectors\b/.test(adapter), `${site.id}: adapter names its selectors`);
        const fixtures = `tests/e2e/fixtures/${site.id}`;
        assert.ok(exists(`${fixtures}/page.html`) && exists(`${fixtures}/expected.json`), `${site.id}: fixture page and expected values`);
        JSON.parse(read(`${fixtures}/expected.json`));
    } else {
        assert.ok(site.legacy && site.legacy.loadedFlag && site.legacy.takeoverEvent, `${site.id}: legacy markers`);
        for (const file of [...site.legacy.js, ...site.legacy.css]) {
            assert.ok(exists(file) && packaged(file), `${site.id}: legacy file ${file}`);
        }
        const content = read(site.legacy.js[site.legacy.js.length - 1]);
        assert.ok(content.includes(`window.${site.legacy.loadedFlag} = true`), `${site.id}: content script sets its loaded flag`);
        assert.ok(content.includes(`'${site.legacy.takeoverEvent}'`), `${site.id}: content script dispatches its takeover event`);
    }
    const script = registry.getContentScript(site.id);
    assert.strictEqual(script.id, `wider-${site.id}`);
    assert.deepStrictEqual(plain(script.js.slice(0, 2)), ['src/shared/sites.js', 'src/shared/settings-utils.js'], `${site.id}: registry and settings load first`);
    for (const file of [...script.js, ...script.css]) assert.ok(exists(file), `${site.id}: ${file} exists`);
}
for (const file of [...registry.CORE_JS, ...registry.CORE_CSS]) assert.ok(exists(file) && packaged(file), `core file ${file}`);

assert.deepStrictEqual(manifest.host_permissions, plain(registry.required().flatMap(site => site.matches)), 'required hosts');
assert.deepStrictEqual(manifest.optional_host_permissions, plain(registry.optional().flatMap(site => site.matches)), 'optional hosts');
assert.ok(!manifest.permissions.includes('tabs'), 'tabs permission would add a browsing-history warning');
assert.deepStrictEqual(manifest.permissions, ['storage', 'scripting', 'activeTab'], 'permissions stay as they are');
assert.deepStrictEqual(manifest.content_scripts, plain(registry.required().map(site => {
    const script = registry.getContentScript(site.id);
    return { matches: script.matches, js: script.js, css: script.css, run_at: script.runAt };
})), 'static content scripts come from the registry');
assert.strictEqual(registry.required().length, 1, 'only Gemini is a required site');
assert.strictEqual(registry.required()[0].id, 'gemini');

for (const site of sites) {
    assert.strictEqual(registry.forUrl(site.url), site);
    assert.strictEqual(registry.forUrl(`${site.url}chat/abc?x=1#y`), site);
}
assert.strictEqual(registry.forUrl('https://example.com/'), null);
assert.strictEqual(registry.forUrl('http://gemini.google.com/'), null, 'only https matches');
assert.strictEqual(registry.forUrl('https://gemini.google.com.evil.example/'), null, 'host must match exactly');
assert.strictEqual(registry.forUrl(undefined), null);
assert.ok(registry.matchesUrl('https://*.example.com/*', 'https://a.b.example.com/x'));
assert.ok(!registry.matchesUrl('https://*.example.com/*', 'https://example.org/'));

const GLOBAL_KEYS = ['uiLanguage'];
const geminiTopLevel = utils.getSiteStorageKeys('gemini');
const syncKeys = [];
const localKeys = [];
for (const site of sites) {
    const keys = registry.getStorageKeys(site.id);
    assert.deepStrictEqual(Object.keys(keys).sort(), ['enabled', 'intro', 'navigation', 'reading', 'taskUndo', 'width']);
    for (const [name, key] of Object.entries(keys)) {
        if (key === null) {
            assert.strictEqual(site.storage, 'gemini-legacy', `${site.id}: only the Gemini codec uses top-level ${name} fields`);
            continue;
        }
        (name === 'taskUndo' || name === 'intro' ? localKeys : syncKeys).push(key);
        assert.ok(!GLOBAL_KEYS.includes(key), `${site.id}: ${key} collides with a global key`);
        if (site.storage !== 'gemini-legacy') {
            assert.ok(key.startsWith(site.id), `${site.id}: ${key} follows the naming rule`);
            assert.ok(!geminiTopLevel.includes(key), `${site.id}: ${key} collides with a Gemini top-level field`);
        }
    }
    assert.deepStrictEqual(plain(utils.getSiteKeys(site.id)), plain(keys), `${site.id}: settings layer exposes the same keys`);
    const own = utils.getSiteStorageKeys(site.id);
    assert.ok(own.includes(keys.enabled) && own.includes(keys.navigation), `${site.id}: storage keys include the switches`);
}
assert.deepStrictEqual([...new Set(syncKeys)], syncKeys, 'sync keys are unique');
assert.deepStrictEqual([...new Set(localKeys)], localKeys, 'local keys are unique');
for (const site of sites.filter(site => site.storage !== 'gemini-legacy')) {
    for (const other of sites.filter(other => other !== site)) {
        const overlap = utils.getSiteStorageKeys(site.id).filter(key => utils.getSiteStorageKeys(other.id).includes(key));
        assert.deepStrictEqual(plain(overlap), [], `${site.id} and ${other.id} share no storage keys`);
    }
}
assert.strictEqual(utils.CHATGPT_INTRO_KEY, 'chatgptIntroPending', 'ChatGPT keeps its 3.0 intro key');
assert.strictEqual(utils.CHATGPT_WIDTH_KEY, 'chatgptWidthSettings');
assert.strictEqual(utils.CHATGPT_READING_KEY, 'chatgptReadingSettings');
assert.strictEqual(utils.TASK_UNDO_KEYS.gemini, 'taskPresetUndo', 'Gemini keeps its legacy undo key');
assert.strictEqual(utils.TASK_UNDO_KEYS.chatgpt, 'chatgptTaskPresetUndo');

for (const site of sites) {
    const defaults = utils.normalizeSiteSettings({}, site.id);
    assert.strictEqual(defaults.siteEnabled, true);
    assert.strictEqual(defaults.navigationEnabled, true);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(defaults.chatWidthSetting)), { value: 1000, unit: 'px' });
    assert.strictEqual(defaults.messageFontSize, 100);
    assert.strictEqual(defaults.userFullWidth, false);
    assert.strictEqual('codeWrap' in defaults, site.capabilities.includes('codeWrap'), `${site.id}: codeWrap follows the capability`);
    const paused = utils.getSiteEnabledPatch(site.id, false);
    for (const other of sites) {
        assert.strictEqual(utils.normalizeSiteSettings(paused, other.id).siteEnabled, other === site ? false : true,
            `${site.id} pause does not pause ${other.id}`);
    }
    const reading = utils.getSiteReadingPatch({}, site.id, { messageFontSize: 130 });
    for (const other of sites.filter(other => other !== site)) {
        assert.strictEqual(utils.normalizeSiteSettings(reading, other.id).messageFontSize, 100,
            `${site.id} reading write does not reach ${other.id}`);
    }
    const width = utils.getSiteWidthStoragePayload({ chatWidthSetting: { value: 1200, unit: 'px' } }, site.id);
    for (const other of sites.filter(other => other !== site)) {
        assert.strictEqual(utils.normalizeSiteSettings(width, other.id).chatWidthSetting.value, 1000,
            `${site.id} width write does not reach ${other.id}`);
    }
    assert.strictEqual(utils.normalizeSiteSettings({ ...width, ...reading }, site.id).messageFontSize, 130,
        `${site.id}: width writes keep reading values`);
    for (const task of site.tasks) {
        const values = utils.getTaskValues(site.id, task, defaults);
        const patch = utils.getTaskPatch({}, site.id, values);
        const applied = utils.normalizeSiteSettings(patch, site.id);
        assert.ok(utils.isSameManaged(utils.getTaskManaged(applied, site.id), values, site.id), `${site.id}: task ${task} round-trips`);
    }
}

const longName = 'x'.repeat(40);
let total = 0;
for (const site of sites) {
    const settings = utils.normalizeSiteSettings({}, site.id);
    const presetsByUnit = Object.fromEntries(Object.entries(settings.presetsByUnit).map(([unit, presets]) =>
        [unit, presets.map(preset => ({ ...preset, name: longName }))]));
    const payload = {
        ...utils.getSiteWidthStoragePayload({ ...settings, presetsByUnit }, site.id),
        ...utils.getSiteReadingPatch({}, site.id, { messageFontSize: 150, messageCompactness: 50 }),
        ...utils.getSiteEnabledPatch(site.id, false),
        ...utils.getSiteNavigationPatch(site.id, false)
    };
    for (const [key, value] of Object.entries(payload)) {
        const size = key.length + JSON.stringify(value).length;
        assert.ok(size < 8192, `${site.id}: ${key} stays under the 8 KB per-item quota (${size})`);
        total += size;
    }
}
assert.ok(total < 80 * 1024, `storage.sync estimate ${total} bytes stays under 80 KB`);

assert.ok(registry.compareVersions('3.1.0', '3.0.1') > 0);
assert.ok(registry.compareVersions('3.0.1', '3.1.0') < 0);
assert.strictEqual(registry.compareVersions('3.1', '3.1.0'), 0);
assert.ok(registry.compareVersions('10.0.0', '9.9.9') > 0);
assert.deepStrictEqual(plain(registry.addedSince('2.8.0').map(site => site.id)), plain(registry.optional().map(site => site.id)));
assert.deepStrictEqual(plain(registry.addedSince('99.0.0')), []);
assert.strictEqual(registry.joinNames(['Gemini', 'ChatGPT', 'Claude'], 'en'), 'Gemini, ChatGPT, and Claude');
assert.strictEqual(registry.joinNames(['Gemini', 'ChatGPT'], 'zh-CN'), 'Gemini和ChatGPT');

console.log(`sites tests passed (${sites.length} sites: ${ids.join(', ')})`);
