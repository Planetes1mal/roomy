let rangeUnit = 'px';
const rangeUndo = new Map();
const rangeKey = () => currentSite + ':' + rangeUnit;
const rangeField = limit => (rangeUnit === 'px' ? 'width' : 'widthPercent') + (limit === 'min' ? 'Min' : 'Max');

function rangeError(input, message) {
    input.setAttribute('aria-invalid', Boolean(message));
    byId(input.getAttribute('aria-describedby')).textContent = message;
}

function validateNumber(input, bounds) {
    const n = input.valueAsNumber;
    if (!Number.isInteger(n) || n < bounds.min || n > bounds.max || n % bounds.step !== 0) {
        return fillTemplate(t('rangeInvalid'), bounds);
    }
    return '';
}

function rangeChanged() {
    rangeUndo.delete(rangeKey());
    renderRange();
}

function saveLimit(input) {
    const limit = input.dataset.limit;
    const allowed = rangeUnit === 'px' ? settingsUtils.PX_RANGE : settingsUtils.PERCENT_RANGE;
    const settings = siteSettings[currentSite];
    const { min, max } = settingsUtils.getRangeForUnit(settings, rangeUnit);
    const n = input.valueAsNumber;
    let error = validateNumber(input, allowed);
    if (!error && limit === 'min' && n >= max) error = fillTemplate(t('belowMaximum'), { n: max });
    if (!error && limit === 'max' && n <= min) error = fillTemplate(t('aboveMinimum'), { n: min });
    rangeError(input, error);
    if (error || settings[rangeField(limit)] === n) return;
    editWidth({ [rangeField(limit)]: n });
    rangeChanged();
}

function presetRow(index) {
    const row = document.createElement('div');
    row.className = 'preset-grid';
    const name = document.createElement('input');
    name.type = 'text';
    const field = document.createElement('div');
    field.className = 'preset-field';
    const amount = document.createElement('div');
    amount.className = 'amount';
    const number = document.createElement('input');
    number.type = 'number';
    const unit = document.createElement('span');
    const error = document.createElement('span');
    error.className = 'error';
    error.id = 'presetError' + index;
    error.setAttribute('role', 'alert');
    number.setAttribute('aria-describedby', error.id);
    amount.append(number, unit);
    field.append(amount, error);
    row.append(name, field);
    for (const [input, key] of [[name, 'name'], [number, 'value']]) {
        input.onblur = () => {
            const s = siteSettings[currentSite];
            if (key === 'value') {
                const message = validateNumber(input, settingsUtils.getRangeForUnit(s, rangeUnit));
                rangeError(input, message);
                if (message) return;
            }
            const value = key === 'name' ? input.value.trim() : input.valueAsNumber;
            const presets = s.presetsByUnit[rangeUnit];
            if (value === (presets[index][key] ?? '')) return;
            const group = presets.map((p, i) => i === index ? { ...p, [key]: value } : p);
            editWidth({ presetsByUnit: { ...s.presetsByUnit, [rangeUnit]: group } });
            rangeChanged();
        };
    }
    byId('presetEditor').append(row);
    return row;
}

function renderRange(clearErrors = false) {
    const s = siteSettings[currentSite];
    const unit = unitLabel(rangeUnit);
    const range = settingsUtils.getRangeForUnit(s, rangeUnit);
    const bounds = rangeUnit === 'px' ? settingsUtils.PX_RANGE : settingsUtils.PERCENT_RANGE;
    const update = (input, value, limits) => {
        if (clearErrors) rangeError(input, '');
        input.min = limits.min;
        input.max = limits.max;
        input.step = limits.step;
        if (input.getAttribute('aria-invalid') !== 'true') input.value = value;
    };
    document.querySelectorAll('#rangeUnits button').forEach(btn => btn.setAttribute('aria-pressed', btn.dataset.unit === rangeUnit));
    document.querySelectorAll('[data-limit]').forEach(input => update(input, range[input.dataset.limit], bounds));
    s.presetsByUnit[rangeUnit].forEach((preset, i) => {
        const row = byId('presetEditor').children[i] || presetRow(i);
        const [name, value] = row.querySelectorAll('input');
        name.value = preset.name || '';
        name.placeholder = t(preset.nameKey);
        name.setAttribute('aria-label', t('shortcutName') + ' ' + (i + 1));
        value.setAttribute('aria-label', t('width') + ' ' + (i + 1) + ' (' + unit + ')');
        update(value, preset.value, range);
        row.querySelector('.amount span').textContent = unit;
    });
    byId('resetRange').textContent = fillTemplate(t('resetRangeDefaults'), { unit });
    byId('undoRange').hidden = !rangeUndo.has(rangeKey());
    byId('rangeStatus').textContent = byId('undoRange').hidden ? '' : fillTemplate(t('rangeResetDone'), { unit });
}

document.querySelectorAll('[data-limit]').forEach(input => { input.onblur = () => saveLimit(input); });
document.querySelectorAll('#rangeUnits button').forEach(btn => {
    btn.onclick = () => { rangeUnit = btn.dataset.unit; renderRange(true); };
});

function replaceRange(min, max, presets, width) {
    const s = siteSettings[currentSite];
    const edit = { [rangeField('min')]: min, [rangeField('max')]: max,
        presetsByUnit: { ...s.presetsByUnit, [rangeUnit]: presets } };
    if (width && s.chatWidthSetting.unit === rangeUnit) edit.chatWidthSetting = width;
    editWidth(edit);
    renderRange(true);
}

byId('resetRange').onclick = () => {
    const s = siteSettings[currentSite];
    const defaults = settingsUtils.getRangeForUnit(DEFAULTS, rangeUnit);
    const presets = settingsUtils.getDefaultPresetsForUnit(rangeUnit);
    const current = settingsUtils.getRangeForUnit(s, rangeUnit);
    if (current.min === defaults.min && current.max === defaults.max &&
        s.presetsByUnit[rangeUnit].every((p, i) => !p.name && p.value === presets[i].value)) {
        renderRange(true);
        return;
    }
    rangeUndo.set(rangeKey(), { ...current, presets: s.presetsByUnit[rangeUnit], width: s.chatWidthSetting });
    replaceRange(defaults.min, defaults.max, presets);
};
byId('undoRange').onclick = () => {
    const saved = rangeUndo.get(rangeKey());
    if (!saved) return;
    rangeUndo.delete(rangeKey());
    replaceRange(saved.min, saved.max, saved.presets, saved.width.unit === rangeUnit ? saved.width : null);
    byId('rangeStatus').textContent = t('rangeUndoDone');
    byId('resetRange').focus();
};
