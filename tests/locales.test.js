const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const LOCALES = ['en', 'zh_CN', 'zh_TW', 'ko', 'ja', 'es'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const messages = Object.fromEntries(LOCALES.map(locale =>
    [locale, JSON.parse(read(`_locales/${locale}/messages.json`))]));
const english = messages.en;
const keys = Object.keys(english);

for (const locale of LOCALES) {
    const own = Object.keys(messages[locale]);
    assert.deepStrictEqual(own.filter(key => !english[key]), [], `${locale} has keys that English lacks`);
    assert.deepStrictEqual(keys.filter(key => !messages[locale][key]), [], `${locale} is missing keys`);
    for (const key of own) {
        assert.ok(typeof messages[locale][key].message === 'string' && messages[locale][key].message.trim(),
            `${locale}.${key} is empty`);
    }
}

for (const key of keys) {
    const tokens = (english[key].message.match(/\{[a-z]+\}/gi) || []).sort();
    for (const locale of LOCALES) {
        const own = (messages[locale][key].message.match(/\{[a-z]+\}/gi) || []).sort();
        assert.deepStrictEqual(own, tokens, `${locale}.${key} placeholders differ from English`);
    }
}

for (const locale of LOCALES) {
    const length = key => [...messages[locale][key].message].length;
    assert.ok(length('appName') <= 75, `${locale}.appName is longer than 75 characters`);
    assert.ok(length('appDesc') <= 132, `${locale}.appDesc is longer than 132 characters`);
    assert.ok(length('brandName') <= 12, `${locale}.brandName is longer than 12 characters`);
}

function walk(directory) {
    return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
        const relative = `${directory}/${entry.name}`;
        return entry.isDirectory() ? walk(relative) : /\.(js|html)$/.test(entry.name) ? [relative] : [];
    });
}
const sourceFiles = walk('src').sort();
assert.ok(sourceFiles.includes('src/popup/popup.js') && sourceFiles.includes('src/background.js'), 'src/ scan finds the scripts');
const sources = ['manifest.json', ...sourceFiles].map(read).join('\n');
const referenced = new Set([
    ...[...sources.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)].map(match => match[1]),
    ...[...sources.matchAll(/data-i18n(?:-[a-z]+)?="([A-Za-z0-9_]+)"/g)].map(match => match[1]),
    ...[...sources.matchAll(/\b(?:t|getMessage)\('([A-Za-z0-9_]+)'/g)].map(match => match[1])
]);
assert.deepStrictEqual([...referenced].filter(key => !english[key]).sort(), [], 'code references missing message keys');
assert.deepStrictEqual(keys.filter(key => !sources.includes(key)), [], 'unused message keys');

console.log(`locale tests passed (${LOCALES.length} locales, ${keys.length} keys)`);
