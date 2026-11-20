const byId = id => document.getElementById(id);
const TASK_LABELS = { reading: 'taskReading', table: 'taskTable', code: 'taskCode', wide: 'taskWide', large: 'taskLarge' };
const PANEL_TITLES = { range: 'widthOptions', reading: 'readingSettings', tasks: 'helpTaskTitle' };
const unitLabel = unit => unit === 'percent' ? '%' : 'px';
const formatWidthValue = setting => setting.value + ' ' + unitLabel(setting.unit);
const isSameWidthSetting = (a, b) => a.unit === b.unit && a.value === b.value;
let activePanel = 'home';
let pendingSliderSave;
let sliderTimer;

function flushSlider() {
    clearTimeout(sliderTimer);
    if (pendingSliderSave) pendingSliderSave();
    pendingSliderSave = null;
}

async function flushPendingChanges() {
    flushSlider();
    await writeQueue;
    if (failedSinceFlush) {
        failedSinceFlush = false;
        throw new Error('A pending settings write failed');
    }
}

function editWidth(edit, dragging = false) {
    const site = currentSite;
    const next = { ...siteSettings[site], ...edit };
    const patch = settingsUtils.getSiteWidthStoragePayload(next, site);
    const width = settingsUtils.normalizeSiteWidthSettings(patch, site);
    Object.assign(siteSettings[site], width);
    renderWidth();
    renderTasks();
    const save = () => writePatch(site, () => patch, {
        action: 'updateWidthSetting', setting: width.chatWidthSetting,
        ranges: { widthMin: width.widthMin, widthMax: width.widthMax,
            widthPercentMin: width.widthPercentMin, widthPercentMax: width.widthPercentMax },
        enabled: width.widthEnabled
    });
    saveSliderChange(save, dragging);
}

function saveSliderChange(save, dragging) {
    clearTimeout(sliderTimer);
    if (!dragging) {
        flushSlider();
        save();
        return;
    }
    pendingSliderSave = save;
    sliderTimer = setTimeout(flushSlider, 200);
}

function editReading(edit, dragging = false) {
    const site = currentSite;
    const settings = siteSettings[site];
    Object.assign(settings, edit, settingsUtils.normalizeDensity({ ...settings, ...edit }));
    renderReading();
    renderTasks();
    saveSliderChange(() => writePatch(site, async () =>
        settingsUtils.getSiteReadingPatch(await readSite(site), site, edit), { action: 'updateReadingSettings' }), dragging);
}

function renderWidth() {
    const settings = siteSettings[currentSite];
    const { chatWidthSetting: { unit, value }, widthEnabled } = settings;
    byId('widthEnabledToggle').checked = widthEnabled;
    byId('widthDisplay').hidden = !widthEnabled;
    byId('nativeWidth').hidden = widthEnabled;
    byId('widthControls').disabled = !widthEnabled;
    byId('widthValue').textContent = value;
    byId('widthUnitLabel').textContent = unitLabel(unit);
    const range = settingsUtils.getRangeForUnit(settings, unit);
    Object.assign(byId('widthSlider'), { min: range.min, max: range.max, step: range.step, value });
    byId('widthSlider').setAttribute('aria-valuetext', formatWidthValue(settings.chatWidthSetting));
    document.querySelectorAll('.readout [data-unit]').forEach(button => {
        button.disabled = !widthEnabled;
        button.setAttribute('aria-pressed', button.dataset.unit === unit);
    });
    const chips = byId('presetButtonsContainer');
    settings.presetsByUnit[unit].forEach((preset, index) => {
        const chip = chips.children[index] || chips.appendChild(document.createElement('button'));
        chip.textContent = preset.value;
        chip.title = preset.name || t(preset.nameKey);
        chip.setAttribute('aria-label', chip.title + ', ' + formatWidthValue(preset));
        chip.setAttribute('aria-pressed', value === preset.value);
        chip.onclick = () => editWidth({ chatWidthSetting: { value: preset.value, unit } });
    });
}

function renderReading() {
    const s = siteSettings[currentSite];
    const custom = s.messageSpacingCustom;
    byId('fontSizeValue').textContent = s.messageFontSize + '%';
    byId('fontUp').disabled = s.messageFontSize >= settingsUtils.FONT_SIZE_RANGE.max;
    byId('fontDown').disabled = s.messageFontSize <= settingsUtils.FONT_SIZE_RANGE.min;
    byId('resetFontSizeBtn').hidden = s.messageFontSize === 100;
    byId('readingSummary').textContent = custom ? t('manualSpacingLabel') : s.messageCompactness
        ? fillTemplate(t('compactSummary'), { n: s.messageCompactness }) : '';
    byId('compactnessValue').textContent = custom ? t('manual') : s.messageCompactness ? s.messageCompactness + '%' : t('originalSpacing');
    byId('compactnessSlider').value = s.messageCompactness;
    byId('compactnessSlider').disabled = custom;
    byId('manualSpacing').checked = custom;
    byId('advancedDensityBody').hidden = !custom;
    byId('lineHeightSlider').value = s.messageLineHeight;
    byId('lineHeightValue').textContent = s.messageLineHeight.toFixed(2);
    byId('paragraphSpacingSlider').value = s.messageParagraphSpacing;
    byId('paragraphSpacingValue').textContent = s.messageParagraphSpacing + ' px';
    byId('resetDensityBtn').hidden = !custom && s.messageCompactness === 0;
    for (const [capability, toggle, card, value] of [
        ['navigation', 'navigationToggle', 'navigationCard', s.navigationEnabled],
        ['codeWrap', 'codeWrapToggle', 'codeWrapCard', s.codeWrap],
        ['userFullWidth', 'userFullWidthToggle', 'userFullWidthCard', s.userFullWidth]
    ]) {
        byId(card).hidden = !settingsUtils.hasCapability(currentSite, capability);
        byId(toggle).checked = Boolean(value);
    }
}

function renderTasks() {
    const rows = byId('taskRows');
    const site = currentSite;
    const settings = siteSettings[site];
    byId('taskMatch').textContent = '';
    if (rows.dataset.site !== site) {
        rows.replaceChildren();
        rows.dataset.site = site;
    }
    for (const task of siteRegistry.get(site).tasks) {
        let row = rows.querySelector('[data-task="' + task + '"]');
        if (!row) {
            row = document.createElement('button');
            row.className = 'task';
            row.dataset.task = task;
            const name = document.createElement('strong');
            name.textContent = t(TASK_LABELS[task]);
            const values = document.createElement('span');
            values.className = 'values';
            const check = document.createElement('span');
            check.className = 'check';
            check.setAttribute('aria-hidden', 'true');
            row.append(name, values, check);
            row.onclick = () => runTaskPreset(task);
            rows.append(row);
        }
        const values = settingsUtils.getTaskValues(site, task, settings);
        const parts = [formatWidthValue(values.chatWidthSetting), values.messageFontSize + '%'];
        if (Object.hasOwn(values, 'codeWrap')) parts.push(t(values.codeWrap ? 'taskWrapOn' : 'taskWrapOff'));
        row.children[1].textContent = parts.join(' · ');
        const matched = settingsUtils.isSameManaged(settings, values, site);
        row.setAttribute('aria-pressed', matched);
        row.lastChild.textContent = matched ? '✓' : '';
        if (matched) byId('taskMatch').textContent = t(TASK_LABELS[task]);
    }
}

function renderPermission() {
    const record = siteRegistry.get(currentSite);
    const access = isGranted(currentSite);
    byId('sitePermission').hidden = access;
    byId('settingsControls').hidden = !access;
    byId('siteSwitch').hidden = !access || activePanel !== 'home';
    if (!access) {
        const grant = fillTemplate(t('grantSitePermission'), { site: record.name });
        byId('grantTitle').textContent = grant;
        byId('grantSitePermission').textContent = grant;
        byId('sitePermissionHint').textContent = fillTemplate(t('sitePermissionHint'), { host: new URL(record.url).hostname });
    }
    const fresh = introSites().filter(site => site !== currentSite).map(siteName);
    byId('introLine').hidden = !access || !fresh.length || activePanel !== 'home';
    byId('introLineText').textContent = fillTemplate(t('siteIntroLine'), { sites: formatSites(fresh) });
}

function applyEnabledUi() {
    const enabled = siteSettings[currentSite].siteEnabled;
    byId('siteEnabledToggle').checked = enabled;
    byId('sitePowerState').hidden = enabled || !isGranted(currentSite) || activePanel !== 'home';
    byId('settingsControls').classList.toggle('paused', !enabled);
    for (const [label, input, key] of [
        ['siteSwitch', 'siteEnabledToggle', 'siteEnabledA11y'], ['widthSwitch', 'widthEnabledToggle', 'widthEnabledSite']
    ]) {
        const name = fillTemplate(t(key), { site: siteName(currentSite) });
        byId(label).title = name;
        byId(input).setAttribute('aria-label', name);
    }
}

function renderSite() {
    if (!siteSettings[currentSite]) return;
    byId('settingsLegend').textContent = siteName(currentSite);
    byId('siteTitle').textContent = activePanel === 'home' ? siteName(currentSite) : t(PANEL_TITLES[activePanel]);
    const reading = settingsUtils.hasCapability(currentSite, 'reading');
    byId('fontRow').hidden = !reading;
    document.querySelector('[data-open="reading"]').hidden = !reading;
    byId('fontRow').parentElement.hidden = !reading && !settingsUtils.hasCapability(currentSite, 'navigation');
    document.querySelector('[data-open="tasks"]').parentElement.hidden = !siteRegistry.get(currentSite).tasks.length;
    renderPermission();
    applyEnabledUi();
    renderWidth();
    renderReading();
    renderTasks();
    renderTaskState();
    if (activePanel === 'range') renderRange();
}

function renderTaskState(message) {
    const undo = taskUndo[currentSite];
    byId('taskPresetStatus').textContent = message ?? (undo?.ambiguous ? t('taskPendingUnknown') : '');
    byId('restoreTaskPreset').hidden = !undo || undo.ambiguous || undo.record.state !== 'ready';
}

function setTaskBusy(busy) {
    taskBusy = busy;
    for (const id of ['settingsControls', 'siteEnabledToggle', 'uiLanguageSelect']) byId(id).disabled = busy || !settingsLoaded;
    byId('backToSites').disabled = busy;
    for (const parts of Object.values(siteRows)) {
        parts.input.disabled = busy || !settingsLoaded;
        parts.row.querySelector('.site-open').disabled = busy;
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
    if (settingsUtils.isSameManaged(snapshot, values, site)) return '';
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
        return fillTemplate(t('taskApplied'), { name: t(TASK_LABELS[task]) });
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


async function runTaskPreset(task) {
    const site = currentSite;
    if (taskBusy || !settingsLoaded || (!task && byId('restoreTaskPreset').hidden)) return;
    const row = byId('taskRows').querySelector('[data-task="' + task + '"]');
    if (row?.getAttribute('aria-pressed') === 'true') return;
    setTaskBusy(true);
    let message;
    try {
        await flushPendingChanges();
        message = await enqueue(() => task ? applyTask(site, task) : restoreTask(site));
    } catch (error) {
        console.error('[Roomy] Task preset could not be saved:', error);
        message = t('taskSaveError');
        await readSite(site).catch(() => {});
        siteSettings[site] = settingsUtils.normalizeSiteSettings(storedSettings, site);
        renderSite();
    } finally {
        setTaskBusy(false);
    }
    renderTaskState(message);
    (row || byId('siteTitle')).focus();
}

byId('grantSitePermission').onclick = event => requestSiteAccess(currentSite, event.currentTarget);
byId('siteEnabledToggle').onchange = event => setSiteEnabled(currentSite, event.target.checked, event.target);
byId('widthEnabledToggle').onchange = event => editWidth({ widthEnabled: event.target.checked });
byId('restoreTaskPreset').onclick = () => runTaskPreset(null);
byId('widthSlider').oninput = event => editWidth({ chatWidthSetting: {
    value: Number(event.target.value), unit: siteSettings[currentSite].chatWidthSetting.unit
} }, true);
document.querySelectorAll('.readout [data-unit]').forEach(button => {
    button.onclick = () => {
        const unit = button.dataset.unit;
        if (siteSettings[currentSite].chatWidthSetting.unit !== unit) {
            editWidth({ chatWidthSetting: { unit, value: unit === 'px' ? DEFAULTS.chatWidthSetting.value : 70 } });
        }
    };
});
for (const [id, delta] of [['fontDown', -5], ['fontUp', 5]]) {
    byId(id).onclick = () => editReading({ messageFontSize: settingsUtils.normalizeFontSize(siteSettings[currentSite].messageFontSize + delta) });
}
byId('resetFontSizeBtn').onclick = () => {
    editReading({ messageFontSize: 100 });
    byId('fontUp').focus();
};
byId('manualSpacing').onchange = event => editReading({ messageSpacingCustom: event.target.checked });
byId('resetDensityBtn').onclick = () => {
    editReading({ messageCompactness: 0, messageSpacingCustom: false });
    byId('compactnessSlider').focus();
};
for (const [id, key] of [['compactnessSlider', 'messageCompactness'], ['lineHeightSlider', 'messageLineHeight'], ['paragraphSpacingSlider', 'messageParagraphSpacing']]) {
    byId(id).oninput = event => editReading({ [key]: Number(event.target.value) }, true);
}
document.querySelectorAll('input[type="range"]').forEach(input => {
    input.onchange = flushSlider;
    input.onblur = flushSlider;
});
for (const [id, key] of [['codeWrapToggle', 'codeWrap'], ['userFullWidthToggle', 'userFullWidth']]) {
    byId(id).onchange = event => editReading({ [key]: event.target.checked });
}
byId('navigationToggle').onchange = event => {
    const site = currentSite;
    const enabled = event.target.checked;
    siteSettings[site].navigationEnabled = enabled;
    writePatch(site, () => settingsUtils.getSiteNavigationPatch(site, enabled), { action: 'refreshSettings' });
};
