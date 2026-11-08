const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

const PUBLIC = [
    /^\.gitattributes$/,
    /^\.gitignore$/,
    /^\.github\//,
    /^(CHANGELOG|CONTRIBUTING|README|README\.zh-CN)\.md$/,
    /^LICENSE$/,
    /^manifest\.json$/,
    /^_locales\/[A-Za-z_]+\/messages\.json$/,
    /^src\//,
    /^tests\//,
    /^icons\/(icon(16|48|128)\.png|icon\.svg|icon16\.svg|render-icons\.cjs)$/,
    /^scripts\/(package\.ps1|test\.js)$/,
    /^docs\/(PRIVACY\.md|engineering\.md|guides\/reading-layout(\.zh-TW)?\.md|i18n\/README\.zh-TW\.md|images\/conversation-(before|after)\.png)$/
];

const listed = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
if (listed.error || listed.status !== 0) {
    console.log('Skipping repository file check: git is unavailable');
    process.exit(0);
}

const files = listed.stdout.split('\0').filter(Boolean);
assert.ok(files.includes('manifest.json'), 'git ls-files did not list the repository');
const unexpected = files.filter(file => !PUBLIC.some(pattern => pattern.test(file)));
assert.deepStrictEqual(unexpected, [],
    'These files are not on the public list. Move local files to the ignored local/ folder, '
    + 'or add a genuinely public file to tests/repository-files.test.js.');
console.log(`repository file tests passed (${files.length} files)`);
