const RANGE_MIN = settingsUtils.PX_RANGE.min;
const RANGE_MAX = settingsUtils.PX_RANGE.max;
const PERCENT_RANGE_MIN = settingsUtils.PERCENT_RANGE.min;
const PERCENT_RANGE_MAX = settingsUtils.PERCENT_RANGE.max;
const TASK_LABELS = { reading: 'taskReading', table: 'taskTable', code: 'taskCode', wide: 'taskWide', large: 'taskLarge' };
const PRESET_ICONS = ['S', 'D', 'W', 'U', 'M'];

let widthUpdateTimer = null;
let readingUpdateTimer = null;
let pendingReadingEdit = null;
let isEditMode = false;

let currentWidthSetting = { ...DEFAULTS.chatWidthSetting };
let currentWidthEnabled = DEFAULTS.widthEnabled;
let currentWidthMin = DEFAULTS.widthMin;
let currentWidthMax = DEFAULTS.widthMax;
let currentWidthPercentMin = DEFAULTS.widthPercentMin;
let currentWidthPercentMax = DEFAULTS.widthPercentMax;
let currentDensity = settingsUtils.normalizeDensity({});
let currentFontSize = DEFAULTS.messageFontSize;
let currentPresetsByUnit = settingsUtils.normalizePresetGroups({}, DEFAULTS);
let currentPresets = currentPresetsByUnit[settingsUtils.UNIT_PX];

const widthSlider = document.getElementById('widthSlider');
const widthValue = document.getElementById('widthValue');
const widthMinInput = document.getElementById('widthMinInput');
const widthMaxInput = document.getElementById('widthMaxInput');
const widthUnitLabel = document.getElementById('widthUnitLabel');
const unitPxBtn = document.getElementById('unitPxBtn');
const unitPercentBtn = document.getElementById('unitPercentBtn');
const compactnessSlider = document.getElementById('compactnessSlider');
const compactnessValue = document.getElementById('compactnessValue');
const advancedDensityToggle = document.getElementById('advancedDensityToggle');
const advancedDensityBody = document.getElementById('advancedDensityBody');
const densitySummary = document.getElementById('densitySummary');
const lineHeightSlider = document.getElementById('lineHeightSlider');
const lineHeightValue = document.getElementById('lineHeightValue');
const paragraphSpacingSlider = document.getElementById('paragraphSpacingSlider');
const paragraphSpacingValue = document.getElementById('paragraphSpacingValue');
const fontSizeSlider = document.getElementById('fontSizeSlider');
const fontSizeValue = document.getElementById('fontSizeValue');
const resetFontSizeBtn = document.getElementById('resetFontSizeBtn');
const resetDensityBtn = document.getElementById('resetDensityBtn');
const codeWrapCard = document.getElementById('codeWrapCard');
const codeWrapToggle = document.getElementById('codeWrapToggle');
const userFullWidthCard = document.getElementById('userFullWidthCard');
const userFullWidthToggle = document.getElementById('userFullWidthToggle');
const navigationToggle = document.getElementById('navigationToggle');
const taskPresetSelect = document.getElementById('taskPresetSelect');
const applyTaskPreset = document.getElementById('applyTaskPreset');
const restoreTaskPreset = document.getElementById('restoreTaskPreset');
const taskPresetStatus = document.getElementById('taskPresetStatus');
const settingsControls = document.getElementById('settingsControls');
const widthControls = document.getElementById('widthControls');
const widthEnabledToggle = document.getElementById('widthEnabledToggle');
const widthEnabledLabel = document.getElementById('widthEnabledLabel');
const siteEnabledToggle = document.getElementById('siteEnabledToggle');
const siteTitle = document.getElementById('siteTitle');
const sitePowerState = document.getElementById('sitePowerState');
const sitePermission = document.getElementById('sitePermission');
const sitePermissionHint = document.getElementById('sitePermissionHint');
const grantSitePermission = document.getElementById('grantSitePermission');
const introLine = document.getElementById('introLine');
const introLineText = document.getElementById('introLineText');
const readingSummary = document.getElementById('readingSummary');
const managePresetsToggle = document.getElementById('managePresetsToggle');
const managePresetsBody = document.getElementById('managePresetsBody');
const editPresetsBtn = document.getElementById('editPresetsBtn');
const donePresetsBtn = document.getElementById('donePresetsBtn');

function hasCapability(capability) {
    return settingsUtils.hasCapability(currentSite, capability);
}

function getPresetName(preset) {
    return preset.name || (preset.nameKey ? t(preset.nameKey) : '');
}

function formatWidthValue(setting) {
    const unitLabel = setting.unit === settingsUtils.UNIT_PERCENT ? '%' : 'px';
    return `${setting.value} ${unitLabel}`;
}

function isSameWidthSetting(a, b) {
    return a && b && a.unit === b.unit && Number(a.value) === Number(b.value);
}

function getTaskRanges() {
    return {
        widthMin: currentWidthMin,
        widthMax: currentWidthMax,
        widthPercentMin: currentWidthPercentMin,
        widthPercentMax: currentWidthPercentMax
    };
}

function getActiveRange() {
    return settingsUtils.getRangeForUnit(getTaskRanges(), currentWidthSetting.unit);
}

function getUnitFallbackValue(unit) {
    return unit === settingsUtils.UNIT_PERCENT ? 70 : DEFAULTS.chatWidthSetting.value;
}

function getUnitLabel(unit) {
    return settingsUtils.normalizeUnit(unit) === settingsUtils.UNIT_PERCENT ? '%' : 'px';
}

function getPresetGroup(unit) {
    const normalizedUnit = settingsUtils.normalizeUnit(unit);
    return currentPresetsByUnit[normalizedUnit] || settingsUtils.getDefaultPresetsForUnit(normalizedUnit);
}

function setPresetGroup(unit, presets) {
    const normalizedUnit = settingsUtils.normalizeUnit(unit);
    currentPresetsByUnit = {
        ...currentPresetsByUnit,
        [normalizedUnit]: presets
    };
    currentPresets = presets;
}

function getCurrentWidthSettings() {
    return settingsUtils.normalizeSiteWidthSettings({
        ...getTaskRanges(),
        widthEnabled: currentWidthEnabled,
        chatWidthSetting: currentWidthSetting,
        presetsByUnit: currentPresetsByUnit
    }, 'gemini');
}

function clamp(val, min, max) {
    return Math.min(Math.max(Number(val), min), max);
}

function renderPresetButtons(presets, widthMin, widthMax, currentSetting) {
    const container = document.getElementById('presetButtonsContainer');
    if (!container) return;
    container.classList.remove('preset-buttons--edit');
    container.innerHTML = '';
    (presets || currentPresets).forEach((preset, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset-btn';
        btn.dataset.value = preset.value;
        btn.dataset.unit = preset.unit;
        const name = getPresetName(preset);
        const icon = PRESET_ICONS[i] || 'W';
        btn.innerHTML = `<span class="btn-icon">${icon}</span><span class="btn-text"></span><span class="btn-value">${formatWidthValue(preset)}</span>`;
        btn.querySelector('.btn-text').textContent = name;
        if (isSameWidthSetting(currentSetting, preset)) btn.classList.add('preset-btn-active');
        container.appendChild(btn);
    });
}

function renderPresetsForMode(presets) {
    const activePresets = presets || getPresetGroup(currentWidthSetting.unit);
    currentPresets = activePresets;

    if (isEditMode) {
        renderPresetButtonsEditMode(activePresets);
        return;
    }

    renderPresetButtons(activePresets, currentWidthMin, currentWidthMax, currentWidthSetting);
}

function renderPresetButtonsEditMode(presets) {
    const container = document.getElementById('presetButtonsContainer');
    if (!container) return;
    container.classList.add('preset-buttons--edit');
    container.innerHTML = '';
    (presets || currentPresets).forEach((preset, i) => {
        const row = document.createElement('div');
        row.className = 'preset-edit-row';
        const name = getPresetName(preset);
        const range = getActiveRange();
        row.innerHTML = `
            <span class="preset-edit-label"></span>
            <input type="number" class="preset-edit-width" data-index="${i}" value="${preset.value}" min="${range.min}" max="${range.max}" step="${range.step}">
            <span class="preset-edit-unit" data-index="${i}">${getUnitLabel(currentWidthSetting.unit)}</span>
        `;
        const label = row.querySelector('.preset-edit-label');
        label.textContent = name;
        label.title = name;
        const input = row.querySelector('.preset-edit-width');
        input.addEventListener('blur', function () {
            const originalValue = parseFloat(this.value);
            const normalized = settingsUtils.normalizeWidthSetting({
                value: originalValue,
                unit: currentWidthSetting.unit
            }, getTaskRanges());
            this.value = normalized.value;
            if (originalValue !== normalized.value) showClampedHint();
        });
        container.appendChild(row);
    });
}

function showClampedHint() {
    let el = document.getElementById('clampedHint');
    if (!el) {
        el = document.createElement('span');
        el.id = 'clampedHint';
        el.className = 'clamped-hint';
        document.getElementById('presetButtonsContainer').appendChild(el);
    }
    el.textContent = t('clampedHint', 'Clamped to range');
    el.classList.add('show');
    clearTimeout(showClampedHint._tid);
    showClampedHint._tid = setTimeout(() => el.classList.remove('show'), 2500);
}

function saveManagePresetsFromRows() {
    const rows = document.querySelectorAll('#managePresetsRows .manage-row');
    if (rows.length !== 5) return;
    const nextPresets = currentPresets.map((p, i) => {
        const row = rows[i];
        const nameInput = row && row.querySelector('.manage-name');
        const widthInput = row && row.querySelector('.manage-width');
        const name = nameInput ? nameInput.value.trim() : getPresetName(p);
        const defaultName = t(p.nameKey || DEFAULTS.presets[i].nameKey, '');
        const customName = name && name !== defaultName ? name : undefined;
        const value = widthInput ? parseFloat(widthInput.value) : p.value;
        return settingsUtils.normalizePreset({
            id: p.id, nameKey: p.nameKey, name: customName, value, unit: currentWidthSetting.unit
        }, i, getTaskRanges());
    });
    setPresetGroup(currentWidthSetting.unit, nextPresets);
    saveWidthSettings();
    renderPresetsForMode(nextPresets);
    document.getElementById('managePresetsSummary').textContent = t('managePresetsSummary', '5 presets customized');
}

function renderManagePresetsRows(presets) {
    const container = document.getElementById('managePresetsRows');
    if (!container) return;
    container.innerHTML = '';
    (presets || currentPresets).forEach((preset, i) => {
        const row = document.createElement('div');
        row.className = 'manage-row';
        const defaultName = t(preset.nameKey || DEFAULTS.presets[i].nameKey, '');
        const displayName = preset.name != null && preset.name !== '' ? preset.name : defaultName;
        const range = getActiveRange();
        row.innerHTML = `
            <input type="text" class="manage-name" data-index="${i}">
            <input type="number" class="manage-width" value="${preset.value}" min="${range.min}" max="${range.max}" step="${range.step}" data-index="${i}">
            <span class="manage-unit" data-index="${i}">${getUnitLabel(currentWidthSetting.unit)}</span>
            <button type="button" class="secondary-btn reset-preset-btn" data-index="${i}">${t('resetToDefault', 'Reset to default')}</button>
        `;
        const nameInput = row.querySelector('.manage-name');
        nameInput.value = displayName;
        nameInput.placeholder = defaultName;
        const widthInput = row.querySelector('.manage-width');
        const save = () => saveManagePresetsFromRows();
        nameInput.addEventListener('blur', save);
        widthInput.addEventListener('blur', function () {
            const normalized = settingsUtils.normalizeWidthSetting({
                value: parseFloat(this.value),
                unit: currentWidthSetting.unit
            }, getTaskRanges());
            this.value = normalized.value;
            save();
        });
        row.querySelector('.reset-preset-btn').addEventListener('click', function () {
            const def = DEFAULTS.presets[i];
            const unitDefault = settingsUtils.getDefaultPresetsForUnit(currentWidthSetting.unit)[i] || def;
            nameInput.value = t(def.nameKey, '');
            widthInput.value = unitDefault.value;
            save();
        });
        container.appendChild(row);
    });
    document.getElementById('managePresetsSummary').textContent = t('managePresetsSummary', '5 presets customized');
}

managePresetsToggle.addEventListener('click', function () {
    const open = managePresetsBody.hidden;
    managePresetsBody.hidden = !open;
    managePresetsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
        renderManagePresetsRows(currentPresets);
    }
});

function saveWidthSettings() {
    const site = currentSite;
    const settings = getCurrentWidthSettings();
    const message = {
        action: 'updateWidthSetting',
        setting: { ...settings.chatWidthSetting },
        ranges: getTaskRanges(),
        enabled: settings.widthEnabled
    };
    return writePatch(site, () => settingsUtils.getSiteWidthStoragePayload(settings, site), message);
}

function saveReading(site, edit) {
    return writePatch(site, async () => {
        const latest = await chrome.storage.sync.get(settingsUtils.getSiteStorageKeys(site));
        return settingsUtils.getSiteReadingPatch(latest, site, edit);
    }, { action: 'updateReadingSettings' });
}

async function flushPendingChanges() {
    if (isEditMode) savePresetEdits();
    if (widthUpdateTimer !== null) updateWidthSetting(currentWidthSetting);
    if (readingUpdateTimer !== null) commitReadingEdit();
    await writeQueue;
    if (failedSinceFlush) {
        failedSinceFlush = false;
        throw new Error('A pending settings write failed');
    }
}

function syncRangeProgress(input) {
    if (!input) return;
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const value = parseFloat(input.value) || min;
    const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--slider-progress', `${clamp(progress, 0, 100)}%`);
}

function syncAllRangeProgress() {
    [widthSlider, compactnessSlider, lineHeightSlider, paragraphSpacingSlider, fontSizeSlider].forEach(syncRangeProgress);
}

function applyEnabledUi() {
    const settings = siteSettings[currentSite];
    const name = siteName(currentSite);
    const enabled = settings ? settings.siteEnabled : true;
    siteTitle.textContent = name;
    siteEnabledToggle.checked = enabled;
    siteEnabledToggle.setAttribute('aria-label', fillTemplate(t('siteEnabledA11y', 'Enable Roomy on {site}'), { site: name }));
    sitePowerState.textContent = t('sitePaused', 'Paused');
    sitePowerState.hidden = enabled;
    document.getElementById('settingsLegend').textContent = name;
    widthEnabledLabel.textContent = fillTemplate(t('widthEnabledSite', 'Widen {site} conversations'), { site: name });
    widthEnabledToggle.checked = currentWidthEnabled;
    const locked = enabled && !currentWidthEnabled;
    widthControls.disabled = locked;
    unitPxBtn.disabled = locked;
    unitPercentBtn.disabled = locked;
    document.querySelector('.width-switch').title = widthEnabledLabel.textContent;
}

function applyWidthUi(settings) {
    if (settings.widthEnabled !== undefined) currentWidthEnabled = settings.widthEnabled;
    currentWidthMin = settings.widthMin;
    currentWidthMax = settings.widthMax;
    currentWidthPercentMin = settings.widthPercentMin;
    currentWidthPercentMax = settings.widthPercentMax;
    currentWidthSetting = { ...settings.chatWidthSetting };
    if (settings.presetsByUnit) {
        currentPresetsByUnit = settings.presetsByUnit;
    }
    currentPresets = getPresetGroup(currentWidthSetting.unit);
    applyEnabledUi();

    const range = getActiveRange();
    widthMinInput.value = range.min;
    widthMaxInput.value = range.max;
    widthMinInput.min = currentWidthSetting.unit === settingsUtils.UNIT_PERCENT ? PERCENT_RANGE_MIN : RANGE_MIN;
    widthMaxInput.min = widthMinInput.min;
    widthMaxInput.max = currentWidthSetting.unit === settingsUtils.UNIT_PERCENT ? PERCENT_RANGE_MAX : RANGE_MAX;
    widthMinInput.max = widthMaxInput.max;
    widthMinInput.step = range.step;
    widthMaxInput.step = range.step;
    widthSlider.min = range.min;
    widthSlider.max = range.max;
    widthSlider.step = range.step;
    widthSlider.value = currentWidthSetting.value;
    widthValue.textContent = currentWidthSetting.value;
    widthUnitLabel.textContent = getUnitLabel(currentWidthSetting.unit);
    syncRangeProgress(widthSlider);

    unitPxBtn.classList.toggle('segment-active', currentWidthSetting.unit === settingsUtils.UNIT_PX);
    unitPercentBtn.classList.toggle('segment-active', currentWidthSetting.unit === settingsUtils.UNIT_PERCENT);
    unitPxBtn.setAttribute('aria-pressed', String(currentWidthSetting.unit === settingsUtils.UNIT_PX));
    unitPercentBtn.setAttribute('aria-pressed', String(currentWidthSetting.unit === settingsUtils.UNIT_PERCENT));
    renderPresetsForMode(currentPresets);
    if (!managePresetsBody.hidden) {
        renderManagePresetsRows(currentPresets);
    }
    updateTaskPreview();
}

function applyDensityUi(settings) {
    currentDensity = settingsUtils.normalizeDensity(settings);
    compactnessSlider.value = currentDensity.messageCompactness;
    compactnessValue.textContent = currentDensity.messageCompactness;
    lineHeightSlider.value = currentDensity.messageLineHeight;
    lineHeightValue.textContent = currentDensity.messageLineHeight.toFixed(2);
    paragraphSpacingSlider.value = currentDensity.messageParagraphSpacing;
    paragraphSpacingValue.textContent = currentDensity.messageParagraphSpacing;
    densitySummary.textContent = currentDensity.messageSpacingCustom
        ? t('customSpacing', 'Custom') : t('autoSpacing', 'Auto');
    syncAllRangeProgress();
    renderReadingSummary();
}

function applyFontSizeUi(fontSize) {
    currentFontSize = fontSize;
    fontSizeSlider.value = currentFontSize;
    fontSizeValue.textContent = currentFontSize;
    syncRangeProgress(fontSizeSlider);
    renderReadingSummary();
}

function renderReadingSummary() {
    const spacing = currentDensity.messageSpacingCustom
        ? t('customSpacing', 'Custom')
        : `${t('autoSpacing', 'Auto')} ${currentDensity.messageCompactness}`;
    readingSummary.textContent = `${currentFontSize}% · ${spacing}`;
}

function renderTaskOptions() {
    const value = taskPresetSelect.value;
    taskPresetSelect.innerHTML = '';
    for (const task of Object.keys(settingsUtils.TASK_PRESETS[currentSite] || {})) {
        const option = document.createElement('option');
        option.value = task;
        option.textContent = t(TASK_LABELS[task]);
        taskPresetSelect.appendChild(option);
    }
    if (settingsUtils.TASK_PRESETS[currentSite] && settingsUtils.TASK_PRESETS[currentSite][value]) taskPresetSelect.value = value;
}

function renderPermission() {
    const record = siteRegistry.get(currentSite);
    const needsAccess = Boolean(record) && record.access === 'optional' && !isGranted(currentSite);
    sitePermission.hidden = !needsAccess;
    if (needsAccess) {
        sitePermissionHint.textContent = fillTemplate(t('sitePermissionHint', '{site} access is optional. Allow access to apply these settings.'), { site: record.name });
        grantSitePermission.textContent = fillTemplate(t('grantSitePermission', 'Allow {site} access'), { site: record.name });
    }
    const fresh = introSites().filter(site => site !== currentSite).map(siteName);
    introLine.hidden = fresh.length === 0;
    if (fresh.length) {
        introLineText.textContent = fillTemplate(t('siteIntroLine', 'New: {sites} supported'), { sites: formatSites(fresh) });
    }
}

function renderSite() {
    const settings = siteSettings[currentSite];
    if (!settings) return;
    renderPermission();
    renderTaskOptions();
    applyWidthUi(settings);
    applyDensityUi(settings);
    applyFontSizeUi(settings.messageFontSize);
    codeWrapCard.hidden = !hasCapability('codeWrap');
    codeWrapToggle.checked = settings.codeWrap === true;
    userFullWidthCard.hidden = !hasCapability('userFullWidth');
    userFullWidthToggle.checked = settings.userFullWidth;
    navigationToggle.checked = settings.navigationEnabled;
    renderTaskState();
}

grantSitePermission.addEventListener('click', function () {
    requestSiteAccess(currentSite, grantSitePermission);
});

function updateTaskPreview() {
    const task = taskPresetSelect.value;
    const presets = settingsUtils.TASK_PRESETS[currentSite];
    if (!presets || !presets[task]) return;
    const values = settingsUtils.getTaskValues(currentSite, task, getTaskRanges());
    const parts = [formatWidthValue(values.chatWidthSetting), `${values.messageFontSize}%`,
        t('taskSpacingNative', 'Native spacing')];
    if (hasCapability('codeWrap')) parts.push(t(values.codeWrap ? 'taskWrapOn' : 'taskWrapOff'));
    document.getElementById('taskPresetPreview').textContent = parts.join(' · ');
}

function renderTaskState(message) {
    const undo = taskUndo[currentSite];
    if (message !== undefined) taskPresetStatus.textContent = message;
    else taskPresetStatus.textContent = undo && undo.ambiguous ? t('taskPendingUnknown') : '';
    setTaskBusy(taskBusy);
}

function setTaskBusy(busy) {
    taskBusy = busy;
    const undo = currentSite ? taskUndo[currentSite] : null;
    settingsControls.disabled = busy || !settingsLoaded;
    siteEnabledToggle.disabled = busy || !settingsLoaded;
    document.getElementById('backToSites').disabled = busy;
    uiLanguageSelect.disabled = busy || !settingsLoaded;
    taskPresetSelect.disabled = busy || !settingsLoaded;
    applyTaskPreset.disabled = busy || !settingsLoaded;
    restoreTaskPreset.disabled = busy || !settingsLoaded || !undo || undo.ambiguous || undo.record.state !== 'ready';
    for (const site of Object.keys(siteRows)) {
        siteRows[site].input.disabled = busy || !settingsLoaded;
        siteRows[site].row.querySelector('.site-open').disabled = busy;
    }
}

function afterTaskWrite(site) {
    siteSettings[site] = settingsUtils.normalizeSiteSettings(storedSettings, site);
    renderSiteRow(site);
    if (site === currentSite) renderSite();
    notifySiteTabs(site, { action: 'refreshSettings' });
}

async function applyTask(site, task) {
    const key = settingsUtils.TASK_UNDO_KEYS[site];
    const stored = await readSite(site);
    const current = settingsUtils.normalizeSiteSettings(stored, site);
    const snapshot = settingsUtils.getTaskManaged(current, site);
    const values = settingsUtils.getTaskValues(site, task, current);
    const previousUndo = taskUndo[site];
    const previous = previousUndo && !previousUndo.ambiguous && previousUndo.record.state === 'ready'
        ? previousUndo.record : null;
    const pending = { state: 'applying', snapshot, previous, pending: { from: snapshot, to: values } };
    await chrome.storage.local.set({ [key]: pending });
    const patch = settingsUtils.getTaskPatch(stored, site, values);
    try {
        await chrome.storage.sync.set(patch);
    } catch (error) {
        await (previous ? chrome.storage.local.set({ [key]: previous }) : chrome.storage.local.remove(key))
            .catch(() => { taskUndo[site] = { record: pending, ambiguous: true }; });
        throw error;
    }
    Object.assign(storedSettings, patch);
    afterTaskWrite(site);
    const ready = { state: 'ready', snapshot };
    try {
        await chrome.storage.local.set({ [key]: ready });
        taskUndo[site] = { record: ready };
        return t('taskApplied');
    } catch (error) {
        taskUndo[site] = { record: pending, ambiguous: false };
        return t('taskUndoRecordError', 'Applied, but the restore point could not be saved.');
    }
}

async function restoreTask(site) {
    const key = settingsUtils.TASK_UNDO_KEYS[site];
    const record = taskUndo[site].record;
    const stored = await readSite(site);
    const before = settingsUtils.getTaskManaged(settingsUtils.normalizeSiteSettings(stored, site), site);
    const patch = settingsUtils.getTaskPatch(stored, site, record.snapshot);
    const target = settingsUtils.getTaskManaged(
        settingsUtils.normalizeSiteSettings({ ...stored, ...patch }, site), site);
    await chrome.storage.local.set({ [key]: { state: 'restoring', snapshot: record.snapshot, pending: { from: before, to: target } } });
    try {
        await chrome.storage.sync.set(patch);
    } catch (error) {
        await chrome.storage.local.set({ [key]: record }).catch(() => {});
        throw error;
    }
    Object.assign(storedSettings, patch);
    afterTaskWrite(site);
    const clamped = !isSameWidthSetting(target.chatWidthSetting, record.snapshot.chatWidthSetting);
    const result = clamped
        ? fillTemplate(t('taskRestoredClamped', 'Restored; width adjusted to {width}.'), { width: formatWidthValue(target.chatWidthSetting) })
        : t('taskRestored');
    try {
        await chrome.storage.local.remove(key);
        taskUndo[site] = null;
        return result;
    } catch (error) {
        taskUndo[site] = { record: { state: 'restoring' }, ambiguous: false };
        return t('taskUndoCleanupError', 'Settings restored, but the restore point could not be cleared.');
    }
}

async function runTaskPreset(restore) {
    const site = currentSite;
    const task = taskPresetSelect.value;
    const undo = taskUndo[site];
    if (!settingsLoaded || taskBusy || (restore && (!undo || undo.record.state !== 'ready'))) return;
    setTaskBusy(true);
    taskPresetStatus.textContent = t('taskSaving');
    let message;
    try {
        await flushPendingChanges();
        message = await enqueue(() => restore ? restoreTask(site) : applyTask(site, task));
    } catch (error) {
        console.error('[Roomy] Task preset could not be saved:', error);
        message = t('taskSaveError');
        await readSite(site).catch(() => {});
        siteSettings[site] = settingsUtils.normalizeSiteSettings(storedSettings, site);
        if (site === currentSite) renderSite();
    } finally {
        taskBusy = false;
    }
    if (site === currentSite) renderTaskState(message);
    else setTaskBusy(false);
}

taskPresetSelect.addEventListener('change', updateTaskPreview);
applyTaskPreset.addEventListener('click', () => runTaskPreset(false));
restoreTaskPreset.addEventListener('click', () => runTaskPreset(true));

async function loadTaskUndo(site, localValues) {
    const key = settingsUtils.TASK_UNDO_KEYS[site];
    const record = settingsUtils.readUndoRecord(localValues[key]);
    const actual = settingsUtils.getTaskManaged(siteSettings[site], site);
    const result = settingsUtils.reconcileUndoRecord(record, actual, site);
    if (result.record !== record && !result.ambiguous) {
        await (result.record ? chrome.storage.local.set({ [key]: result.record }) : chrome.storage.local.remove(key))
            .catch(() => {});
    }
    taskUndo[site] = result.record ? { record: result.record, ambiguous: !!result.ambiguous } : null;
}

siteEnabledToggle.addEventListener('change', function () {
    setSiteEnabled(currentSite, this.checked, this);
});

widthEnabledToggle.addEventListener('change', async function () {
    if (!settingsLoaded || taskBusy) return;
    const enabled = this.checked;
    try {
        await flushPendingChanges();
    } catch (error) {
        this.checked = !enabled;
        return;
    }
    currentWidthEnabled = enabled;
    applyEnabledUi();
    saveWidthSettings();
});

function onRangeInput(isMin) {
    if (isEditMode) savePresetEdits();
    const isPercent = currentWidthSetting.unit === settingsUtils.UNIT_PERCENT;
    const low = isPercent ? PERCENT_RANGE_MIN : RANGE_MIN;
    const high = isPercent ? PERCENT_RANGE_MAX : RANGE_MAX;
    const step = isPercent ? 1 : settingsUtils.PX_RANGE.step;
    let minVal = clamp(parseInt(widthMinInput.value, 10) || low, low, high);
    let maxVal = clamp(parseInt(widthMaxInput.value, 10) || high, low, high);
    if (minVal >= maxVal) {
        if (isMin) {
            minVal = Math.min(minVal, high - step);
            maxVal = minVal + step;
        } else {
            maxVal = Math.max(maxVal, low + step);
            minVal = maxVal - step;
        }
    }
    widthMinInput.value = minVal;
    widthMaxInput.value = maxVal;
    if (isPercent) {
        currentWidthPercentMin = minVal;
        currentWidthPercentMax = maxVal;
    } else {
        currentWidthMin = minVal;
        currentWidthMax = maxVal;
    }

    const settings = getCurrentWidthSettings();
    applyWidthUi(settings);
    updateWidthSetting(settings.chatWidthSetting);
}

widthMinInput.addEventListener('change', () => onRangeInput(true));
widthMaxInput.addEventListener('change', () => onRangeInput(false));

function updateWidthSetting(setting) {
    clearTimeout(widthUpdateTimer);
    widthUpdateTimer = null;
    currentWidthSetting = settingsUtils.normalizeWidthSetting(setting, getTaskRanges());
    return saveWidthSettings();
}

widthSlider.addEventListener('input', function () {
    const value = parseFloat(this.value);
    currentWidthSetting = { value, unit: currentWidthSetting.unit };
    widthValue.textContent = value;
    syncRangeProgress(this);
    if (!isEditMode) {
        renderPresetButtons(currentPresets, currentWidthMin, currentWidthMax, currentWidthSetting);
    }
    clearTimeout(widthUpdateTimer);
    widthUpdateTimer = setTimeout(() => updateWidthSetting(currentWidthSetting), 500);
});

widthSlider.addEventListener('change', function () {
    updateWidthSetting(currentWidthSetting);
});

[unitPxBtn, unitPercentBtn].forEach(btn => {
    btn.addEventListener('click', function () {
        const unit = this.dataset.unit;
        if (unit === currentWidthSetting.unit) return;
        if (isEditMode) savePresetEdits();
        const next = settingsUtils.normalizeWidthSetting({ value: getUnitFallbackValue(unit), unit }, getTaskRanges());
        currentWidthSetting = next;
        applyWidthUi({ ...getTaskRanges(), chatWidthSetting: next });
        updateWidthSetting(next);
    });
});

editPresetsBtn.addEventListener('click', function () {
    isEditMode = true;
    editPresetsBtn.hidden = true;
    donePresetsBtn.hidden = false;
    renderPresetButtonsEditMode(currentPresets);
});

function savePresetEdits() {
    const rows = document.querySelectorAll('.preset-edit-row');
    const nextPresets = currentPresets.map((p, i) => {
        const row = rows[i];
        const input = row && row.querySelector('.preset-edit-width');
        const value = input ? parseFloat(input.value) : p.value;
        return settingsUtils.normalizePreset({
            id: p.id, nameKey: p.nameKey, name: p.name, value, unit: currentWidthSetting.unit
        }, i, getTaskRanges());
    });
    setPresetGroup(currentWidthSetting.unit, nextPresets);
    isEditMode = false;
    saveWidthSettings();
    editPresetsBtn.hidden = false;
    donePresetsBtn.hidden = true;
    renderPresetButtons(nextPresets, currentWidthMin, currentWidthMax, currentWidthSetting);
}
donePresetsBtn.addEventListener('click', savePresetEdits);

document.getElementById('presetButtonsContainer').addEventListener('click', function (e) {
    if (isEditMode) return;
    const btn = e.target.closest('.preset-btn');
    if (!btn || !btn.dataset.value || !btn.dataset.unit) return;
    const setting = settingsUtils.normalizeWidthSetting({
        value: parseFloat(btn.dataset.value),
        unit: btn.dataset.unit
    }, getTaskRanges());
    currentWidthSetting = setting;
    applyWidthUi({ ...getTaskRanges(), chatWidthSetting: setting });
    updateWidthSetting(setting);
});

function commitReadingEdit() {
    clearTimeout(readingUpdateTimer);
    readingUpdateTimer = null;
    if (!pendingReadingEdit) return;
    const { site, edit } = pendingReadingEdit;
    pendingReadingEdit = null;
    saveReading(site, edit);
}

function scheduleReadingEdit(edit, delay = 400) {
    if (pendingReadingEdit && pendingReadingEdit.site !== currentSite) commitReadingEdit();
    pendingReadingEdit = { site: currentSite, edit: { ...(pendingReadingEdit && pendingReadingEdit.edit), ...edit } };
    clearTimeout(readingUpdateTimer);
    readingUpdateTimer = setTimeout(commitReadingEdit, delay);
}

compactnessSlider.addEventListener('input', function () {
    applyDensityUi({ messageCompactness: parseInt(this.value, 10), messageSpacingCustom: false });
    scheduleReadingEdit({ ...currentDensity });
});

advancedDensityToggle.addEventListener('click', function () {
    const open = advancedDensityBody.hidden;
    advancedDensityBody.hidden = !open;
    advancedDensityToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});

[lineHeightSlider, paragraphSpacingSlider].forEach(input => {
    input.addEventListener('input', function () {
        applyDensityUi({
            messageCompactness: parseInt(compactnessSlider.value, 10),
            messageLineHeight: parseFloat(lineHeightSlider.value),
            messageParagraphSpacing: parseInt(paragraphSpacingSlider.value, 10),
            messageSpacingCustom: true
        });
        scheduleReadingEdit({ ...currentDensity }, 250);
    });
});

fontSizeSlider.addEventListener('input', function () {
    applyFontSizeUi(parseInt(this.value, 10));
    scheduleReadingEdit({ messageFontSize: currentFontSize });
});

[compactnessSlider, fontSizeSlider, lineHeightSlider, paragraphSpacingSlider].forEach(input => {
    input.addEventListener('change', commitReadingEdit);
});

resetFontSizeBtn.addEventListener('click', function () {
    applyFontSizeUi(DEFAULTS.messageFontSize);
    scheduleReadingEdit({ messageFontSize: currentFontSize }, 0);
});

resetDensityBtn.addEventListener('click', function () {
    applyDensityUi({ messageCompactness: parseInt(compactnessSlider.value, 10), messageSpacingCustom: false });
    scheduleReadingEdit({ ...currentDensity }, 0);
});

codeWrapToggle.addEventListener('change', function () {
    scheduleReadingEdit({ codeWrap: this.checked }, 0);
});

userFullWidthToggle.addEventListener('change', function () {
    scheduleReadingEdit({ userFullWidth: this.checked }, 0);
});

navigationToggle.addEventListener('change', function () {
    const site = currentSite;
    const enabled = this.checked;
    writePatch(site, () => settingsUtils.getSiteNavigationPatch(site, enabled), { action: 'refreshSettings' });
});
