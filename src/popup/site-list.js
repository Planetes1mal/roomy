const siteRows = {};

function siteStateText(site) {
    if (!isGranted(site)) return '';
    const settings = siteSettings[site];
    if (!settings) return '';
    if (!settings.siteEnabled) return t('sitePaused', 'Paused');
    if (!settings.widthEnabled) return t('stateWidthOff', 'Widening off');
    return '';
}

function createSiteRow(site) {
    const record = siteRegistry.get(site);
    const row = document.createElement('li');
    row.className = 'site-row';
    row.dataset.site = site;
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'site-open';
    const name = document.createElement('span');
    name.className = 'site-name';
    const label = document.createElement('span');
    label.className = 'site-name-text';
    label.textContent = record.name;
    const fresh = document.createElement('span');
    fresh.className = 'site-new';
    fresh.hidden = true;
    const current = document.createElement('span');
    current.className = 'site-current';
    current.hidden = true;
    name.append(label, fresh, current);
    const state = document.createElement('span');
    state.className = 'site-state';
    const labels = document.createElement('span');
    labels.append(name, state);
    open.append(labels);
    open.addEventListener('click', () => openSite(site));
    const control = document.createElement('span');
    control.className = 'site-control';
    const toggle = document.createElement('label');
    toggle.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    const slider = document.createElement('span');
    slider.className = 'slider-toggle';
    slider.setAttribute('aria-hidden', 'true');
    toggle.append(input, slider);
    input.addEventListener('change', () => setSiteEnabled(site, input.checked, input));
    const allow = document.createElement('button');
    allow.type = 'button';
    allow.className = 'btn site-allow';
    allow.addEventListener('click', () => requestSiteAccess(site, allow));
    control.append(toggle, allow);
    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.setAttribute('aria-hidden', 'true');
    open.append(chevron);
    row.append(open, control);
    siteRows[site] = { row, fresh, current, state, toggle, input, allow };
    return row;
}

function renderSiteRow(site) {
    const parts = siteRows[site];
    if (!parts) return;
    const record = siteRegistry.get(site);
    const granted = isGranted(site);
    const settings = siteSettings[site];
    parts.state.textContent = siteStateText(site);
    parts.state.hidden = !parts.state.textContent;
    parts.current.textContent = t('currentSite', 'Current page');
    parts.current.hidden = site !== activeTabSite;
    parts.fresh.textContent = t('siteNew', 'New');
    parts.fresh.hidden = !introSites().includes(site);
    parts.toggle.hidden = !granted;
    parts.allow.hidden = granted;
    parts.allow.textContent = t('allowAccess', 'Allow');
    parts.allow.setAttribute('aria-label', fillTemplate(t('grantSitePermission', 'Allow {site} access'), { site: record.name }));
    parts.input.checked = Boolean(settings && settings.siteEnabled);
    parts.input.disabled = !settingsLoaded || taskBusy;
    parts.input.setAttribute('aria-label', fillTemplate(t('siteEnabledA11y', 'Enable Roomy on {site}'), { site: record.name }));
    parts.row.classList.toggle('is-paused', granted && Boolean(settings) && !settings.siteEnabled);
}

function renderSiteList() {
    const yours = document.getElementById('yourSites');
    const addable = document.getElementById('addableSites');
    for (const site of siteRegistry.sites) {
        if (!siteRows[site.id]) createSiteRow(site.id);
        const target = isGranted(site.id) ? yours : addable;
        if (siteRows[site.id].row.parentElement !== target) target.appendChild(siteRows[site.id].row);
        renderSiteRow(site.id);
    }
    for (const list of [yours, addable]) {
        const order = siteRegistry.sites.map(site => site.id);
        const rank = row => row.dataset.site === activeTabSite ? -1 : order.indexOf(row.dataset.site);
        [...list.children].sort((a, b) => rank(a) - rank(b)).forEach((row, i) => {
            if (list.children[i] !== row) list.insertBefore(row, list.children[i]);
        });
    }
    document.getElementById('addableSitesGroup').hidden = addable.children.length === 0;
    document.getElementById('yourSitesGroup').hidden = yours.children.length === 0;
}

async function setSiteEnabled(site, enabled, input) {
    if (!settingsLoaded || taskBusy) {
        input.checked = !enabled;
        return;
    }
    try {
        await flushPendingChanges();
    } catch (error) {
        input.checked = !enabled;
        setStatus('error', t('saveFailed', 'Could not save. Please try again.'));
        return;
    }
    siteSettings[site].siteEnabled = enabled;
    renderSiteRow(site);
    if (site === currentSite) applyEnabledUi();
    writePatch(site, () => settingsUtils.getSiteEnabledPatch(site, enabled), { action: 'updateSiteEnabled' });
}
