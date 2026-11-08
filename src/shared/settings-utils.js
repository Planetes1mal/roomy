(function (global) {
    'use strict';

    const sites = global.widerRoomySites;
    const SITE_IDS = sites.sites.map(site => site.id);
    const keysById = Object.fromEntries(SITE_IDS.map(id => [id, sites.getStorageKeys(id)]));
    const keyMap = name => Object.fromEntries(SITE_IDS.map(id => [id, keysById[id][name]]));

    const UNIT_PX = 'px';
    const UNIT_PERCENT = 'percent';
    const PRESET_COUNT = 5;
    const SITE_ENABLED_KEYS = keyMap('enabled');
    const TASK_UNDO_KEYS = keyMap('taskUndo');
    const NAVIGATION_KEYS = keyMap('navigation');
    const SITE_WIDTH_KEYS = keyMap('width');
    const SITE_READING_KEYS = keyMap('reading');
    const SITE_INTRO_KEYS = keyMap('intro');
    const CHATGPT_WIDTH_KEY = SITE_WIDTH_KEYS.chatgpt;
    const CHATGPT_READING_KEY = SITE_READING_KEYS.chatgpt;
    const CHATGPT_INTRO_KEY = SITE_INTRO_KEYS.chatgpt;
    const PROTOCOL_VERSION = 2;
    const DENSITY_KEYS = ['messageCompactness', 'messageSpacingCustom', 'messageLineHeight', 'messageParagraphSpacing'];
    const READING_KEYS = [...DENSITY_KEYS, 'messageFontSize', 'userFullWidth'];
    const GEMINI_WIDTH_KEYS = ['widthEnabled', 'chatWidth', 'chatWidthSetting', 'widthMin', 'widthMax',
        'widthPercentMin', 'widthPercentMax', 'presetsByUnit', 'presets'];
    const TASK_DEFINITIONS = {
        reading: { chatWidthSetting: { value: 1000, unit: 'px' }, messageFontSize: 110, codeWrap: true },
        table: { chatWidthSetting: { value: 90, unit: 'percent' }, messageFontSize: 100, codeWrap: false },
        code: { chatWidthSetting: { value: 90, unit: 'percent' }, messageFontSize: 100, codeWrap: true },
        wide: { chatWidthSetting: { value: 90, unit: 'percent' }, messageFontSize: 100 },
        large: { chatWidthSetting: { value: 1000, unit: 'px' }, messageFontSize: 140, codeWrap: true }
    };
    const TASK_PRESETS = Object.fromEntries(sites.sites.map(site => [site.id, Object.fromEntries(site.tasks.map(task => {
        const preset = { ...TASK_DEFINITIONS[task] };
        if (!hasCapability(site.id, 'codeWrap')) delete preset.codeWrap;
        return [task, preset];
    }))]));
    const SITE_MATCHES = Object.fromEntries(sites.sites.map(site => [site.id, [...site.matches]]));

    function hasCapability(site, capability) {
        const record = sites.get(site);
        return Boolean(record) && record.capabilities.includes(capability);
    }

    const PX_RANGE = { min: 300, max: 5000, step: 50 };
    const PERCENT_RANGE = { min: 10, max: 100, step: 1 };
    const DENSITY_DEFAULT_LINE_HEIGHT = 1.42;
    const DENSITY_DEFAULT_PARAGRAPH_SPACING = 12;
    const DENSITY_APPLIED_MAX_LINE_HEIGHT = 1.4;
    const DENSITY_APPLIED_MIN_LINE_HEIGHT = 1.24;
    const DENSITY_APPLIED_MAX_PARAGRAPH_SPACING = 11;
    const DENSITY_APPLIED_MIN_PARAGRAPH_SPACING = 2;
    const FONT_SIZE_RANGE = { min: 75, max: 200, step: 5 };
    const UI_LANGUAGES = ['auto', 'en', 'zh_CN', 'zh_TW', 'ko', 'ja', 'es'];

    const DEFAULT_PRESETS_BY_UNIT = {
        [UNIT_PX]: [
            { id: 'p1', nameKey: 'btnNarrow', value: 800, unit: UNIT_PX },
            { id: 'p2', nameKey: 'btnDefault', value: 1000, unit: UNIT_PX },
            { id: 'p3', nameKey: 'btnWider', value: 1200, unit: UNIT_PX },
            { id: 'p4', nameKey: 'btnUltra', value: 1350, unit: UNIT_PX },
            { id: 'p5', nameKey: 'btnInsane', value: 2000, unit: UNIT_PX }
        ],
        [UNIT_PERCENT]: [
            { id: 'p1', nameKey: 'btnNarrow', value: 50, unit: UNIT_PERCENT },
            { id: 'p2', nameKey: 'btnDefault', value: 70, unit: UNIT_PERCENT },
            { id: 'p3', nameKey: 'btnWider', value: 80, unit: UNIT_PERCENT },
            { id: 'p4', nameKey: 'btnUltra', value: 90, unit: UNIT_PERCENT },
            { id: 'p5', nameKey: 'btnInsane', value: 100, unit: UNIT_PERCENT }
        ]
    };

    const DEFAULTS = {
        widthEnabled: true,
        widthMin: 700,
        widthMax: 2000,
        widthPercentMin: 50,
        widthPercentMax: 100,
        chatWidthSetting: { value: 1000, unit: UNIT_PX },
        presetsByUnit: DEFAULT_PRESETS_BY_UNIT,
        presets: DEFAULT_PRESETS_BY_UNIT[UNIT_PX],
        codeWrap: false,
        userFullWidth: false,
        messageCompactness: 0,
        messageLineHeight: DENSITY_DEFAULT_LINE_HEIGHT,
        messageParagraphSpacing: DENSITY_DEFAULT_PARAGRAPH_SPACING,
        messageSpacingCustom: false,
        messageFontSize: 100,
        uiLanguage: 'auto'
    };

    function clampNumber(value, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number)) return min;
        return Math.min(Math.max(number, min), max);
    }

    function roundForUnit(value, unit) {
        if (unit === UNIT_PERCENT) return Math.round(value);
        return Math.round(value / PX_RANGE.step) * PX_RANGE.step;
    }

    function normalizeUnit(unit) {
        return unit === UNIT_PERCENT ? UNIT_PERCENT : UNIT_PX;
    }

    function getDefaultPresetsForUnit(unit) {
        return DEFAULT_PRESETS_BY_UNIT[normalizeUnit(unit)].map(preset => ({ ...preset }));
    }

    function normalizeRangeValue(value, fallback, range) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
        return clampNumber(value, range.min, range.max);
    }

    function normalizeRanges(result) {
        let widthMin = normalizeRangeValue(result.widthMin, DEFAULTS.widthMin, PX_RANGE);
        let widthMax = normalizeRangeValue(result.widthMax, DEFAULTS.widthMax, PX_RANGE);
        let widthPercentMin = normalizeRangeValue(
            result.widthPercentMin,
            DEFAULTS.widthPercentMin,
            PERCENT_RANGE
        );
        let widthPercentMax = normalizeRangeValue(
            result.widthPercentMax,
            DEFAULTS.widthPercentMax,
            PERCENT_RANGE
        );

        if (widthMin >= widthMax) {
            widthMin = DEFAULTS.widthMin;
            widthMax = DEFAULTS.widthMax;
        }

        if (widthPercentMin >= widthPercentMax) {
            widthPercentMin = DEFAULTS.widthPercentMin;
            widthPercentMax = DEFAULTS.widthPercentMax;
        }

        return { widthMin, widthMax, widthPercentMin, widthPercentMax };
    }

    function getRangeForUnit(ranges, unit) {
        const normalizedUnit = normalizeUnit(unit);
        if (normalizedUnit === UNIT_PERCENT) {
            return {
                min: ranges.widthPercentMin,
                max: ranges.widthPercentMax,
                step: PERCENT_RANGE.step
            };
        }

        return {
            min: ranges.widthMin,
            max: ranges.widthMax,
            step: PX_RANGE.step
        };
    }

    function normalizeWidthSetting(input, ranges) {
        let unit = UNIT_PX;
        let value = DEFAULTS.chatWidthSetting.value;

        if (input && typeof input === 'object') {
            unit = normalizeUnit(input.unit);
            value = input.value;
        } else if (typeof input === 'number') {
            value = input;
        }

        const range = getRangeForUnit(ranges, unit);
        const clamped = clampNumber(value, range.min, range.max);
        return {
            value: clampNumber(roundForUnit(clamped, unit), range.min, range.max),
            unit
        };
    }

    function normalizePreset(preset, index, ranges, forcedUnit) {
        const unit = forcedUnit ? normalizeUnit(forcedUnit) : normalizeUnit(preset && preset.unit);
        const defaults = DEFAULT_PRESETS_BY_UNIT[unit] || DEFAULT_PRESETS_BY_UNIT[UNIT_PX];
        const fallback = defaults[index] || defaults[0];
        const source = preset && typeof preset === 'object' ? preset : fallback;
        const valueSource = typeof source.value === 'number' ? source.value : source.width;
        const setting = normalizeWidthSetting({
            value: typeof valueSource === 'number' ? valueSource : fallback.value,
            unit
        }, ranges);

        return {
            id: source.id || fallback.id,
            nameKey: source.nameKey || fallback.nameKey,
            name: source.name,
            value: setting.value,
            unit: setting.unit
        };
    }

    function normalizePresets(presets, ranges, unit) {
        const normalizedUnit = normalizeUnit(unit);
        const defaults = DEFAULT_PRESETS_BY_UNIT[normalizedUnit] || DEFAULT_PRESETS_BY_UNIT[UNIT_PX];

        if (!Array.isArray(presets) || presets.length !== PRESET_COUNT) {
            return defaults.map((preset, index) => normalizePreset(preset, index, ranges, normalizedUnit));
        }

        return presets.map((preset, index) => {
            const sourceUnit = preset && preset.unit ? normalizeUnit(preset.unit) : normalizedUnit;
            const source = sourceUnit === normalizedUnit ? preset : defaults[index];
            return normalizePreset(source, index, ranges, normalizedUnit);
        });
    }

    function normalizePresetGroups(source, ranges) {
        const groups = source && typeof source.presetsByUnit === 'object' ? source.presetsByUnit : null;
        return {
            [UNIT_PX]: normalizePresets(groups ? groups[UNIT_PX] : source && source.presets, ranges, UNIT_PX),
            [UNIT_PERCENT]: normalizePresets(groups ? groups[UNIT_PERCENT] : undefined, ranges, UNIT_PERCENT)
        };
    }

    function deriveDensityFromCompactness(compactness) {
        const normalizedCompactness = Math.round(clampNumber(compactness, 0, 100));

        if (normalizedCompactness === 0) {
            return {
                messageCompactness: normalizedCompactness,
                messageLineHeight: DENSITY_DEFAULT_LINE_HEIGHT,
                messageParagraphSpacing: DENSITY_DEFAULT_PARAGRAPH_SPACING
            };
        }

        const ratio = normalizedCompactness / 100;
        const lineHeightRange = DENSITY_APPLIED_MAX_LINE_HEIGHT - DENSITY_APPLIED_MIN_LINE_HEIGHT;
        const paragraphRange = DENSITY_APPLIED_MAX_PARAGRAPH_SPACING - DENSITY_APPLIED_MIN_PARAGRAPH_SPACING;
        const lineHeight = Number((DENSITY_APPLIED_MAX_LINE_HEIGHT - ratio * lineHeightRange).toFixed(2));
        const paragraphSpacing = Math.round(DENSITY_APPLIED_MAX_PARAGRAPH_SPACING - ratio * paragraphRange);

        return {
            messageCompactness: normalizedCompactness,
            messageLineHeight: clampNumber(lineHeight, 1.15, 1.8),
            messageParagraphSpacing: clampNumber(paragraphSpacing, 0, 24)
        };
    }

    function normalizeDensity(result) {
        const messageCompactness = Math.round(clampNumber(result.messageCompactness, 0, 100));
        const derived = deriveDensityFromCompactness(messageCompactness);
        const custom = result.messageSpacingCustom === true;

        if (!custom) {
            return {
                ...derived,
                messageSpacingCustom: false
            };
        }

        return {
            messageCompactness,
            messageLineHeight: Number(clampNumber(result.messageLineHeight, 1.15, 1.8).toFixed(2)),
            messageParagraphSpacing: Math.round(clampNumber(result.messageParagraphSpacing, 0, 24)),
            messageSpacingCustom: true
        };
    }

    function normalizeFontSize(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULTS.messageFontSize;
        return Math.round(clampNumber(value, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max));
    }

    function normalizeUiLanguage(value) {
        return UI_LANGUAGES.indexOf(value) !== -1 ? value : DEFAULTS.uiLanguage;
    }

    function getWidthCssValue(setting) {
        const normalizedUnit = normalizeUnit(setting && setting.unit);
        const value = setting && typeof setting.value === 'number'
            ? setting.value
            : DEFAULTS.chatWidthSetting.value;
        return normalizedUnit === UNIT_PERCENT ? `${value}vw` : `${value}px`;
    }

    function getLegacyChatWidth(setting) {
        if (setting && setting.unit === UNIT_PX && typeof setting.value === 'number') {
            return setting.value;
        }

        return DEFAULTS.chatWidthSetting.value;
    }

    function normalizeStorage(result) {
        const source = result && typeof result === 'object' ? result : {};
        const ranges = normalizeRanges(source);
        const widthSource = source.chatWidthSetting !== undefined
            ? source.chatWidthSetting
            : source.chatWidth;
        const chatWidthSetting = normalizeWidthSetting(widthSource, ranges);
        const presetsByUnit = normalizePresetGroups(source, ranges);
        const presets = presetsByUnit[chatWidthSetting.unit];
        const density = normalizeDensity(source);
        const codeWrap = source.codeWrap !== undefined ? source.codeWrap === true : DEFAULTS.codeWrap;
        const userFullWidth = source.userFullWidth !== undefined
            ? source.userFullWidth === true
            : DEFAULTS.userFullWidth;

        return {
            ...ranges,
            widthEnabled: source.widthEnabled !== false,
            chatWidthSetting,
            legacyChatWidth: getLegacyChatWidth(chatWidthSetting),
            presetsByUnit,
            presets,
            codeWrap,
            userFullWidth,
            messageFontSize: normalizeFontSize(source.messageFontSize),
            uiLanguage: normalizeUiLanguage(source.uiLanguage),
            ...density
        };
    }

    const CODECS = {
        default: {
            storageKeys: keys => [keys.enabled, keys.navigation, keys.width, keys.reading],
            widthSource: (stored, keys) => stored[keys.width],
            readingSource: (stored, keys) => stored[keys.reading],
            widthPayload: (width, keys) => ({ [keys.width]: width }),
            readingPatch: (next, changed, edit, keys) => ({ [keys.reading]: next }),
            taskPatch: (stored, site, chatWidthSetting, reading) => ({
                ...getSiteWidthStoragePayload({ ...normalizeSiteSettings(stored, site), chatWidthSetting }, site),
                ...getSiteReadingPatch(stored, site, reading)
            })
        },
        'gemini-legacy': {
            storageKeys: keys => [keys.enabled, keys.navigation, ...GEMINI_WIDTH_KEYS, ...READING_KEYS, 'codeWrap'],
            widthSource: stored => stored,
            readingSource: stored => stored,
            widthPayload: width => ({
                ...width,
                chatWidth: getLegacyChatWidth(width.chatWidthSetting),
                presets: width.presetsByUnit[UNIT_PX]
            }),
            readingPatch(next, changed, edit) {
                const keys = new Set(changed);
                if (DENSITY_KEYS.some(key => keys.has(key))) DENSITY_KEYS.forEach(key => keys.add(key));
                const patch = Object.fromEntries([...keys].map(key => [key, next[key]]));
                if (Object.hasOwn(edit, 'codeWrap')) patch.codeWrap = edit.codeWrap === true;
                return patch;
            },
            taskPatch: (stored, site, chatWidthSetting, reading, managed) => ({
                chatWidthSetting,
                chatWidth: getLegacyChatWidth(chatWidthSetting),
                ...reading,
                codeWrap: managed.codeWrap === true
            })
        }
    };

    function codecFor(site) {
        const record = sites.get(site);
        return CODECS[record && record.storage] || CODECS.default;
    }

    function keysFor(site) {
        return keysById[site] || sites.getStorageKeys(site);
    }

    function normalizeWidthFields(source) {
        const settings = normalizeStorage(source);
        return {
            widthEnabled: settings.widthEnabled,
            chatWidthSetting: settings.chatWidthSetting,
            widthMin: settings.widthMin,
            widthMax: settings.widthMax,
            widthPercentMin: settings.widthPercentMin,
            widthPercentMax: settings.widthPercentMax,
            presetsByUnit: settings.presetsByUnit
        };
    }

    function normalizeSiteWidthSettings(result, site) {
        const source = result && typeof result === 'object' ? result : {};
        return normalizeWidthFields(codecFor(site).widthSource(source, keysFor(site)));
    }

    function getSiteWidthStoragePayload(settings, site) {
        return codecFor(site).widthPayload(normalizeWidthFields(settings), keysFor(site));
    }

    function normalizeReadingSettings(source) {
        const reading = source && typeof source === 'object' ? source : {};
        return {
            ...normalizeDensity(reading),
            messageFontSize: normalizeFontSize(reading.messageFontSize),
            userFullWidth: reading.userFullWidth === true
        };
    }

    function getReadingSource(stored, site) {
        const source = stored && typeof stored === 'object' ? stored : {};
        return codecFor(site).readingSource(source, keysFor(site));
    }

    function getSiteStorageKeys(site) {
        return codecFor(site).storageKeys(keysFor(site));
    }

    function getSiteKeys(site) {
        return { ...keysFor(site) };
    }

    function normalizeSiteSettings(stored, site) {
        const source = stored && typeof stored === 'object' ? stored : {};
        const keys = keysFor(site);
        const settings = {
            site,
            siteEnabled: source[keys.enabled] !== false,
            navigationEnabled: source[keys.navigation] !== false,
            ...normalizeSiteWidthSettings(source, site),
            ...normalizeReadingSettings(getReadingSource(source, site))
        };
        if (hasCapability(site, 'codeWrap')) settings.codeWrap = (getReadingSource(source, site) || {}).codeWrap === true;
        return settings;
    }

    function getSiteEnabledPatch(site, enabled) {
        return { [keysFor(site).enabled]: enabled === true };
    }

    function getSiteNavigationPatch(site, enabled) {
        return { [keysFor(site).navigation]: enabled === true };
    }

    function getSiteReadingPatch(stored, site, edit) {
        const changed = READING_KEYS.filter(key => Object.hasOwn(edit, key));
        const next = normalizeReadingSettings({
            ...normalizeReadingSettings(getReadingSource(stored, site)),
            ...Object.fromEntries(changed.map(key => [key, edit[key]]))
        });
        return codecFor(site).readingPatch(next, changed, edit, keysFor(site));
    }

    function getTaskManaged(settings, site) {
        const managed = {
            chatWidthSetting: { ...settings.chatWidthSetting },
            messageFontSize: settings.messageFontSize,
            ...normalizeDensity(settings)
        };
        if (hasCapability(site, 'codeWrap')) managed.codeWrap = settings.codeWrap === true;
        return managed;
    }

    function getTaskValues(site, task, ranges) {
        const preset = TASK_PRESETS[site][task];
        return getTaskManaged({
            ...preset,
            chatWidthSetting: normalizeWidthSetting(preset.chatWidthSetting, ranges),
            messageFontSize: normalizeFontSize(preset.messageFontSize)
        }, site);
    }

    function getTaskPatch(stored, site, managed) {
        const current = normalizeSiteSettings(stored, site);
        const chatWidthSetting = normalizeWidthSetting(managed.chatWidthSetting, current);
        const reading = {
            ...normalizeDensity(managed),
            messageFontSize: normalizeFontSize(managed.messageFontSize)
        };
        return codecFor(site).taskPatch(stored, site, chatWidthSetting, reading, managed);
    }

    function isSameManaged(a, b, site) {
        if (!a || !b) return false;
        const key = value => JSON.stringify(getTaskManaged({
            ...value,
            messageFontSize: normalizeFontSize(value.messageFontSize)
        }, site));
        return key(a) === key(b);
    }

    function readUndoRecord(value) {
        if (!value || typeof value !== 'object') return null;
        if (!value.state) return { state: 'ready', snapshot: value };
        return value;
    }

    function reconcileUndoRecord(record, actual, site) {
        if (!record || record.state === 'ready') return { record };
        const applying = record.state === 'applying';
        const { from, to } = record.pending || {};
        if (isSameManaged(actual, to, site)) {
            return { record: applying ? { state: 'ready', snapshot: record.snapshot } : null };
        }
        if (isSameManaged(actual, from, site)) {
            return { record: applying ? record.previous || null : { state: 'ready', snapshot: record.snapshot } };
        }
        return { record, ambiguous: true };
    }

    global.widerGeminiSettings = {
        UNIT_PX,
        UNIT_PERCENT,
        SITE_IDS,
        CHATGPT_WIDTH_KEY,
        CHATGPT_READING_KEY,
        SITE_ENABLED_KEYS,
        NAVIGATION_KEYS,
        TASK_UNDO_KEYS,
        SITE_WIDTH_KEYS,
        SITE_READING_KEYS,
        SITE_INTRO_KEYS,
        CHATGPT_INTRO_KEY,
        TASK_DEFINITIONS,
        TASK_PRESETS,
        PROTOCOL_VERSION,
        SITE_MATCHES,
        READING_KEYS,
        DENSITY_KEYS,
        hasCapability,
        getSiteKeys,
        PX_RANGE,
        PERCENT_RANGE,
        DEFAULTS,
        clampNumber,
        normalizeUnit,
        normalizeStorage,
        normalizeSiteWidthSettings,
        getSiteWidthStoragePayload,
        normalizeReadingSettings,
        normalizeSiteSettings,
        getSiteStorageKeys,
        getSiteEnabledPatch,
        getSiteNavigationPatch,
        getSiteReadingPatch,
        getTaskManaged,
        getTaskValues,
        getTaskPatch,
        isSameManaged,
        readUndoRecord,
        reconcileUndoRecord,
        normalizeWidthSetting,
        normalizePreset,
        normalizePresets,
        normalizePresetGroups,
        getDefaultPresetsForUnit,
        deriveDensityFromCompactness,
        normalizeDensity,
        normalizeFontSize,
        normalizeUiLanguage,
        getRangeForUnit,
        getWidthCssValue,
        getLegacyChatWidth
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
