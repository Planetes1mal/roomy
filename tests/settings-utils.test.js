const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sitesPath = path.join(__dirname, '..', 'src/shared/sites.js');
const utilsPath = path.join(__dirname, '..', 'src/shared/settings-utils.js');
const source = fs.readFileSync(utilsPath, 'utf8');
const sandbox = { console, Object, Array, Number, Math, parseInt, parseFloat, isFinite: Number.isFinite };
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(sitesPath, 'utf8'), sandbox, { filename: 'sites.js' });
vm.runInNewContext(source, sandbox, { filename: 'settings-utils.js' });

const utils = sandbox.widerGeminiSettings;
const plain = value => JSON.parse(JSON.stringify(value));
assert.ok(utils, 'settings utils are exposed');

{
    const normalized = utils.normalizeStorage({
        chatWidth: 1350,
        presets: [
            { id: 'p1', nameKey: 'btnNarrow', width: 800 },
            { id: 'p2', nameKey: 'btnDefault', width: 1000 },
            { id: 'p3', nameKey: 'btnWider', width: 1200 },
            { id: 'p4', nameKey: 'btnUltra', width: 1350 },
            { id: 'p5', nameKey: 'btnInsane', width: 2000 }
        ]
    });

    assert.strictEqual(normalized.chatWidthSetting.value, 1350);
    assert.strictEqual(normalized.chatWidthSetting.unit, 'px');
    assert.strictEqual(normalized.presets[0].value, 800);
    assert.strictEqual(normalized.presets[0].unit, 'px');
    assert.strictEqual(normalized.presetsByUnit.px[3].value, 1350);
    assert.strictEqual(normalized.presetsByUnit.percent[1].value, 70);
    assert.strictEqual(normalized.presetsByUnit.percent[1].unit, 'percent');
    assert.strictEqual(normalized.legacyChatWidth, 1350);
}

{
    const normalized = utils.normalizeStorage({
        chatWidthSetting: { value: 125, unit: 'percent' },
        widthPercentMin: 40,
        widthPercentMax: 95
    });

    assert.strictEqual(normalized.chatWidthSetting.value, 95);
    assert.strictEqual(normalized.chatWidthSetting.unit, 'percent');
    assert.strictEqual(utils.getWidthCssValue(normalized.chatWidthSetting), '95vw');
    assert.strictEqual(normalized.legacyChatWidth, 1000);
    assert.strictEqual(utils.normalizeWidthSetting({ value: 2000, unit: 'px' }, {
        ...utils.DEFAULTS,
        widthMax: 1425
    }).value, 1425, 'rounding must not exceed a custom range limit');
}

{
    const normalized = utils.normalizeStorage({
        presetsByUnit: {
            px: [
                { id: 'p1', nameKey: 'btnNarrow', value: 800, unit: 'px' },
                { id: 'p2', nameKey: 'btnDefault', value: 1000, unit: 'px' },
                { id: 'p3', nameKey: 'btnWider', value: 1200, unit: 'px' },
                { id: 'p4', nameKey: 'btnUltra', value: 1350, unit: 'px' },
                { id: 'p5', nameKey: 'btnInsane', value: 9000, unit: 'px' }
            ],
            percent: [
                { id: 'p1', name: 'Small', value: 40, unit: 'percent' },
                { id: 'p2', nameKey: 'btnDefault', value: 70, unit: 'percent' },
                { id: 'p3', nameKey: 'btnWider', value: 80, unit: 'percent' },
                { id: 'p4', nameKey: 'btnUltra', value: 90, unit: 'percent' },
                { id: 'p5', nameKey: 'btnInsane', value: 125, unit: 'percent' }
            ]
        }
    });

    assert.strictEqual(normalized.presetsByUnit.percent[0].value, 50);
    assert.strictEqual(normalized.presetsByUnit.percent[0].unit, 'percent');
    assert.strictEqual(normalized.presetsByUnit.percent[4].value, 100);
    assert.strictEqual(normalized.presetsByUnit.percent[4].unit, 'percent');
    assert.strictEqual(normalized.presetsByUnit.px[4].value, 2000);
    assert.strictEqual(normalized.presetsByUnit.px[4].unit, 'px');
}

{
    const normalized = utils.normalizeStorage({
        presets: [
            { id: 'p1', nameKey: 'btnNarrow', value: 800, unit: 'px' },
            { id: 'p2', nameKey: 'btnDefault', value: 1000, unit: 'px' },
            { id: 'p3', nameKey: 'btnWider', value: 1200, unit: 'px' },
            { id: 'p4', nameKey: 'btnUltra', value: 70, unit: 'percent' },
            { id: 'p5', nameKey: 'btnInsane', value: 2000, unit: 'px' }
        ]
    });

    assert.strictEqual(normalized.presetsByUnit.px[3].value, 1350);
    assert.strictEqual(normalized.presetsByUnit.px[3].unit, 'px');
    assert.strictEqual(normalized.presetsByUnit.percent[1].value, 70);
    assert.strictEqual(normalized.presetsByUnit.percent[3].value, 90);
}

{
    const density = utils.deriveDensityFromCompactness(50);
    assert.strictEqual(density.messageCompactness, 50);
    assert.strictEqual(density.messageLineHeight, 1.32);
    assert.strictEqual(density.messageParagraphSpacing, 7);
}

{
    const off = utils.deriveDensityFromCompactness(0);
    const low = utils.deriveDensityFromCompactness(5);
    const medium = utils.deriveDensityFromCompactness(50);
    const high = utils.deriveDensityFromCompactness(100);

    assert.strictEqual(off.messageLineHeight, 1.42);
    assert.strictEqual(off.messageParagraphSpacing, 12);
    assert.ok(low.messageLineHeight <= 1.4, 'low compactness must not be looser than Gemini native line height');
    assert.ok(low.messageParagraphSpacing < off.messageParagraphSpacing);
    assert.ok(low.messageLineHeight > medium.messageLineHeight);
    assert.ok(low.messageParagraphSpacing > medium.messageParagraphSpacing);
    assert.ok(medium.messageLineHeight > high.messageLineHeight);
    assert.ok(medium.messageParagraphSpacing > high.messageParagraphSpacing);
    assert.strictEqual(high.messageLineHeight, 1.24);
    assert.strictEqual(high.messageParagraphSpacing, 2);
}

{
    const normalized = utils.normalizeDensity({
        messageCompactness: 100,
        messageLineHeight: 4,
        messageParagraphSpacing: -5,
        messageSpacingCustom: true
    });

    assert.strictEqual(normalized.messageCompactness, 100);
    assert.strictEqual(normalized.messageLineHeight, 1.8);
    assert.strictEqual(normalized.messageParagraphSpacing, 0);
    assert.strictEqual(normalized.messageSpacingCustom, true);
}

{
    assert.strictEqual(
        utils.getWidthCssValue({ value: 1200, unit: 'px' }),
        '1200px'
    );
    assert.strictEqual(
        utils.getWidthCssValue({ value: 88, unit: 'percent' }),
        '88vw'
    );
}

{
    assert.strictEqual(utils.normalizeStorage({}).widthEnabled, true, 'existing installs remain enabled');
    assert.strictEqual(utils.normalizeStorage({ widthEnabled: false }).widthEnabled, false);
    assert.strictEqual(utils.normalizeStorage({ widthEnabled: 'false' }).widthEnabled, true);
    assert.strictEqual(utils.normalizeStorage({ widthEnabled: 0 }).widthEnabled, true);
    assert.strictEqual(utils.normalizeStorage({}).userFullWidth, false);
    assert.strictEqual(utils.normalizeStorage({ userFullWidth: true }).userFullWidth, true);
    assert.strictEqual(utils.normalizeStorage({ userFullWidth: 'yes' }).userFullWidth, false);
}

{
    assert.strictEqual(utils.normalizeFontSize(undefined), 100);
    assert.strictEqual(utils.normalizeFontSize('abc'), 100);
    assert.strictEqual(utils.normalizeFontSize(50), 75);
    assert.strictEqual(utils.normalizeFontSize(250), 200);
    assert.strictEqual(utils.normalizeFontSize(150), 150);
    assert.strictEqual(utils.normalizeStorage({}).messageFontSize, 100);
    assert.strictEqual(utils.normalizeStorage({ messageFontSize: 130 }).messageFontSize, 130);
    assert.strictEqual(utils.normalizeStorage({ messageFontSize: 30 }).messageFontSize, 75);
    assert.strictEqual(utils.normalizeStorage({ messageFontSize: 999 }).messageFontSize, 200);
}

{
    assert.strictEqual(utils.normalizeUiLanguage(undefined), 'auto');
    assert.strictEqual(utils.normalizeUiLanguage('auto'), 'auto');
    assert.strictEqual(utils.normalizeUiLanguage('en'), 'en');
    assert.strictEqual(utils.normalizeUiLanguage('zh_CN'), 'zh_CN');
    assert.strictEqual(utils.normalizeUiLanguage('zh_TW'), 'zh_TW');
    assert.strictEqual(utils.normalizeUiLanguage('ko'), 'ko');
    assert.strictEqual(utils.normalizeUiLanguage('ja'), 'ja');
    assert.strictEqual(utils.normalizeUiLanguage('es'), 'es');
    assert.strictEqual(utils.normalizeUiLanguage('fr'), 'auto');
    assert.strictEqual(utils.normalizeStorage({}).uiLanguage, 'auto');
    assert.strictEqual(utils.normalizeStorage({ uiLanguage: 'en' }).uiLanguage, 'en');
    assert.strictEqual(utils.normalizeStorage({ uiLanguage: 'zh_TW' }).uiLanguage, 'zh_TW');
    assert.strictEqual(utils.normalizeStorage({ uiLanguage: 'ko' }).uiLanguage, 'ko');
    assert.strictEqual(utils.normalizeStorage({ uiLanguage: 'ja' }).uiLanguage, 'ja');
    assert.strictEqual(utils.normalizeStorage({ uiLanguage: 'es' }).uiLanguage, 'es');
    assert.strictEqual(utils.normalizeStorage({ uiLanguage: 'fr' }).uiLanguage, 'auto');
}

{
    const stored = {
        widthEnabled: false,
        chatWidth: 1350,
        widthMin: 900,
        widthMax: 1800,
        presets: utils.getDefaultPresetsForUnit('px').map(preset => ({ ...preset, name: 'Gemini preset' }))
    };
    const gemini = utils.normalizeSiteWidthSettings(stored, 'gemini');
    const chatgpt = utils.normalizeSiteWidthSettings(stored, 'chatgpt');
    assert.strictEqual(gemini.chatWidthSetting.value, 1350, 'Gemini keeps its legacy width');
    assert.strictEqual(gemini.widthEnabled, false);
    assert.strictEqual(chatgpt.widthEnabled, true, 'Gemini pause must not disable ChatGPT');
    assert.strictEqual(gemini.presetsByUnit.px[0].name, 'Gemini preset');
    assert.strictEqual(chatgpt.chatWidthSetting.value, 1000, 'ChatGPT starts independently');
    assert.strictEqual(chatgpt.widthMin, 700);
    assert.strictEqual(chatgpt.presetsByUnit.px[0].name, undefined);

    const payload = utils.getSiteWidthStoragePayload({
        ...chatgpt,
        widthEnabled: false,
        chatWidthSetting: { value: 95, unit: 'percent' },
        widthPercentMin: 40,
        widthPercentMax: 90,
        presetsByUnit: {
            ...chatgpt.presetsByUnit,
            percent: chatgpt.presetsByUnit.percent.map(preset => ({ ...preset, name: 'ChatGPT preset' }))
        },
        codeWrap: true,
        uiLanguage: 'ja'
    }, 'chatgpt');
    assert.deepStrictEqual(Object.keys(payload), [utils.CHATGPT_WIDTH_KEY]);
    const updated = utils.normalizeSiteWidthSettings({ ...stored, ...payload }, 'chatgpt');
    assert.strictEqual(updated.chatWidthSetting.value, 90, 'ChatGPT uses its own range');
    assert.strictEqual(updated.widthEnabled, false, 'ChatGPT pause survives width normalization');
    assert.strictEqual(payload[utils.CHATGPT_WIDTH_KEY].widthEnabled, false);
    assert.strictEqual(updated.presetsByUnit.percent[0].name, 'ChatGPT preset');
    assert.strictEqual(updated.presetsByUnit.percent[4].value, 90);
    assert.strictEqual(payload[utils.CHATGPT_WIDTH_KEY].codeWrap, undefined);
    assert.strictEqual(payload[utils.CHATGPT_WIDTH_KEY].uiLanguage, undefined);
    assert.strictEqual(payload[utils.CHATGPT_WIDTH_KEY].chatWidth, undefined);
    assert.strictEqual(payload[utils.CHATGPT_WIDTH_KEY].presets, undefined);
    assert.strictEqual(utils.normalizeSiteWidthSettings({ ...stored, ...payload }, 'gemini').chatWidthSetting.value, 1350);

    const legacyPayload = utils.getSiteWidthStoragePayload(gemini, 'gemini');
    assert.strictEqual(legacyPayload.widthEnabled, false);
    assert.strictEqual(legacyPayload.chatWidth, 1350);
    assert.strictEqual(legacyPayload.presets[0].name, 'Gemini preset');
    assert.strictEqual(legacyPayload[utils.CHATGPT_WIDTH_KEY], undefined);
    const invalid = utils.normalizeSiteWidthSettings({
        [utils.CHATGPT_WIDTH_KEY]: { widthMin: 1800, widthMax: 900, presetsByUnit: { px: [] } }
    }, 'chatgpt');
    assert.strictEqual(invalid.widthMin, 700);
    assert.strictEqual(invalid.widthMax, 2000);
    assert.strictEqual(invalid.presetsByUnit.px.length, 5);
}

{
    const legacy = { widthEnabled: false, messageFontSize: 120, codeWrap: true,
        [utils.CHATGPT_WIDTH_KEY]: { widthEnabled: false, chatWidthSetting: { value: 1200, unit: 'px' } } };
    const gemini = utils.normalizeSiteSettings(legacy, 'gemini');
    const chatgpt = utils.normalizeSiteSettings(legacy, 'chatgpt');
    assert.strictEqual(gemini.siteEnabled, true);
    assert.strictEqual(gemini.widthEnabled, false);
    assert.strictEqual(gemini.messageFontSize, 120);
    assert.strictEqual(chatgpt.siteEnabled, true);
    assert.strictEqual(chatgpt.messageFontSize, 100, 'ChatGPT does not inherit Gemini reading values');
    assert.strictEqual(chatgpt.messageCompactness, 0);
    assert.strictEqual(chatgpt.messageSpacingCustom, false);
    assert.strictEqual(chatgpt.userFullWidth, false);
    assert.strictEqual(chatgpt.codeWrap, undefined, 'ChatGPT has no extension code-wrap field');
    assert.strictEqual(utils.normalizeSiteSettings({ chatgptEnabled: false }, 'chatgpt').siteEnabled, false);
    assert.strictEqual(utils.normalizeSiteSettings({ chatgptEnabled: false }, 'gemini').siteEnabled, true);
    assert.deepStrictEqual(Object.keys(utils.getSiteEnabledPatch('chatgpt', false)), ['chatgptEnabled']);

    const stored = { ...legacy, [utils.CHATGPT_READING_KEY]: { messageFontSize: 130, userFullWidth: true } };
    const readingPatch = utils.getSiteReadingPatch(stored, 'chatgpt', { messageCompactness: 40, codeWrap: true });
    assert.deepStrictEqual(Object.keys(readingPatch), [utils.CHATGPT_READING_KEY]);
    const reading = readingPatch[utils.CHATGPT_READING_KEY];
    assert.strictEqual(reading.messageFontSize, 130);
    assert.strictEqual(reading.userFullWidth, true);
    assert.strictEqual(reading.messageCompactness, 40);
    assert.strictEqual(reading.codeWrap, undefined);
    const widthPatch = utils.getSiteWidthStoragePayload(utils.normalizeSiteSettings(stored, 'chatgpt'), 'chatgpt');
    const afterWidth = utils.normalizeSiteSettings({ ...stored, ...widthPatch }, 'chatgpt');
    assert.strictEqual(afterWidth.messageFontSize, 130, 'width writes keep ChatGPT reading values');
    assert.strictEqual(afterWidth.userFullWidth, true);

    const geminiPatch = utils.getSiteReadingPatch(stored, 'gemini', { messageFontSize: 150 });
    assert.deepStrictEqual(plain(geminiPatch), { messageFontSize: 150 }, 'partial Gemini edit writes only that field');
    const densityPatch = utils.getSiteReadingPatch(stored, 'gemini', { messageCompactness: 50 });
    assert.deepStrictEqual(Object.keys(densityPatch).sort(),
        ['messageCompactness', 'messageLineHeight', 'messageParagraphSpacing', 'messageSpacingCustom']);
}

{
    const stored = {
        [utils.CHATGPT_WIDTH_KEY]: { widthEnabled: false, widthPercentMax: 80,
            chatWidthSetting: { value: 800, unit: 'px' } },
        [utils.CHATGPT_READING_KEY]: { userFullWidth: true, messageFontSize: 90 }
    };
    const current = utils.normalizeSiteSettings(stored, 'chatgpt');
    const values = utils.getTaskValues('chatgpt', 'wide', current);
    assert.deepStrictEqual(plain(values.chatWidthSetting), { value: 80, unit: 'percent' }, 'task width respects the range');
    assert.strictEqual(values.codeWrap, undefined);
    const patch = utils.getTaskPatch(stored, 'chatgpt', values);
    const applied = utils.normalizeSiteSettings({ ...stored, ...patch }, 'chatgpt');
    assert.ok(utils.isSameManaged(utils.getTaskManaged(applied, 'chatgpt'), values, 'chatgpt'));
    assert.strictEqual(applied.widthEnabled, false, 'tasks keep the width switch');
    assert.strictEqual(applied.userFullWidth, true, 'tasks keep user full width');
    assert.strictEqual(applied.widthPercentMax, 80, 'tasks keep ranges');
    assert.deepStrictEqual(Object.keys(utils.TASK_PRESETS.chatgpt), ['reading', 'wide', 'large']);
    assert.deepStrictEqual(Object.keys(utils.TASK_PRESETS.gemini), ['reading', 'table', 'code', 'large']);

    const snapshot = utils.getTaskManaged(current, 'chatgpt');
    const restored = utils.normalizeSiteSettings({ ...stored, ...patch,
        ...utils.getTaskPatch({ ...stored, ...patch }, 'chatgpt', snapshot) }, 'chatgpt');
    assert.ok(utils.isSameManaged(utils.getTaskManaged(restored, 'chatgpt'), snapshot, 'chatgpt'));

    const legacyUndo = utils.readUndoRecord({ chatWidthSetting: { value: 1000, unit: 'px' }, messageFontSize: 100 });
    assert.strictEqual(legacyUndo.state, 'ready', 'bare legacy snapshots are ready');
    const previous = { state: 'ready', snapshot: { ...snapshot, messageFontSize: 120 } };
    const applying = { state: 'applying', snapshot, previous, pending: { from: snapshot, to: values } };
    assert.deepStrictEqual(plain(utils.reconcileUndoRecord(applying, values, 'chatgpt').record),
        plain({ state: 'ready', snapshot }), 'applied task finishes the record');
    assert.strictEqual(utils.reconcileUndoRecord(applying, snapshot, 'chatgpt').record, previous,
        'an apply that never reached sync keeps the previous undo');
    const unknown = utils.reconcileUndoRecord(applying, { ...values, messageFontSize: 175 }, 'chatgpt');
    assert.strictEqual(unknown.ambiguous, true, 'mismatched pending state is not treated as ready');
    const restoring = { state: 'restoring', snapshot, pending: { from: values, to: snapshot } };
    assert.strictEqual(utils.reconcileUndoRecord(restoring, snapshot, 'chatgpt').record, null);
    assert.strictEqual(utils.reconcileUndoRecord(restoring, values, 'chatgpt').record.state, 'ready');
}

{
    assert.strictEqual(utils.normalizeSiteSettings({}, 'gemini').navigationEnabled, true);
    assert.strictEqual(utils.normalizeSiteSettings({ chatgptMessageNavigationEnabled: false }, 'chatgpt').navigationEnabled, false);
    assert.strictEqual(utils.normalizeSiteSettings({ chatgptMessageNavigationEnabled: false }, 'gemini').navigationEnabled, true);
    assert.deepStrictEqual(Object.keys(utils.getSiteNavigationPatch('gemini', false)), ['geminiMessageNavigationEnabled']);
    assert.ok(utils.getSiteStorageKeys('chatgpt').includes('chatgptMessageNavigationEnabled'));
    const managed = utils.getTaskManaged(utils.normalizeSiteSettings({}, 'chatgpt'), 'chatgpt');
    assert.strictEqual(managed.navigationEnabled, undefined, 'navigation is not task-managed');
}

console.log('settings-utils tests passed');
