const settingsUtils = window.widerGeminiSettings;
const siteRegistry = window.widerRoomySites;
const DEFAULTS = settingsUtils.DEFAULTS;

let settingsLoaded = false;
let taskBusy = false;
let currentSite = null;
let activeTabSite = null;
let storedSettings = {};
const siteSettings = {};
const taskUndo = {};
const granted = {};
let introFlags = {};
let writeQueue = Promise.resolve();
let failedSinceFlush = false;
const latestSiteMessages = new Map();
let layoutStatusRequest = 0;

function siteName(id) {
    const site = siteRegistry.get(id);
    return site ? site.name : id;
}

function isGranted(id) {
    const site = siteRegistry.get(id);
    return Boolean(site) && (site.access === 'required' || granted[id] === true);
}

function introSites() {
    return siteRegistry.optional().filter(site => introFlags[site.id] === 'update' && !isGranted(site.id)).map(site => site.id);
}

const statusMessages = { error: '', page: '', transient: '' };

function renderStatus() {
    const kind = ['error', 'page', 'transient'].find(key => statusMessages[key]);
    const target = currentSite ? document.getElementById('siteStatus') : document.getElementById('listStatus');
    for (const element of [document.getElementById('siteStatus'), document.getElementById('listStatus')]) {
        const own = element === target && kind;
        element.textContent = own ? statusMessages[kind] : '';
        element.dataset.kind = own ? kind : '';
        element.hidden = !own;
    }
}

function setStatus(kind, message) {
    statusMessages[kind] = message || '';
    if (kind === 'transient') {
        clearTimeout(setStatus.timer);
        if (message) setStatus.timer = setTimeout(() => setStatus('transient', ''), 2400);
    }
    renderStatus();
}

function clearStatus() {
    statusMessages.error = '';
    statusMessages.transient = '';
    statusMessages.page = '';
    renderStatus();
}

function enqueue(operation) {
    const run = writeQueue.then(operation);
    writeQueue = run.catch(() => {});
    return run;
}

function onSaved(site) {
    siteSettings[site] = settingsUtils.normalizeSiteSettings(storedSettings, site);
    renderSiteRow(site);
    if (site !== currentSite) return;
    setStatus('error', '');
    if (!siteSettings[site].siteEnabled) setStatus('transient', t('savedWhilePaused', 'Saved. Applies when enabled.'));
}

async function onSaveFailed(site, error) {
    console.error('[Roomy] Settings could not be saved:', error);
    failedSinceFlush = true;
    try {
        Object.assign(storedSettings, await chrome.storage.sync.get(settingsUtils.getSiteStorageKeys(site)));
    } catch (e) {
    }
    siteSettings[site] = settingsUtils.normalizeSiteSettings(storedSettings, site);
    renderSiteRow(site);
    if (site === currentSite) renderSite();
    setStatus('error', t('saveFailed', 'Could not save. Please try again.'));
}

function writePatch(site, buildPatch, message) {
    return enqueue(async () => {
        const patch = await buildPatch();
        await chrome.storage.sync.set(patch);
        Object.assign(storedSettings, patch);
    }).then(() => {
        onSaved(site);
        if (message) notifySiteTabs(site, message);
    }, error => onSaveFailed(site, error));
}

async function readSite(site) {
    const stored = await chrome.storage.sync.get(settingsUtils.getSiteStorageKeys(site));
    Object.assign(storedSettings, stored);
    return stored;
}

function isNoReceiver(error) {
    return /Receiving end does not exist/i.test(error && error.message || String(error));
}

async function reportOutdatedPage(site, tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    if (site === currentSite && tab && tab.id === tabId) {
        setStatus('page', t('pageOutdated', 'Saved, but this page runs an older extension version.'));
    }
}

function siteTabs(site) {
    const record = siteRegistry.get(site);
    if (!record) return Promise.resolve([]);
    const permitted = record.access === 'required'
        ? Promise.resolve(true)
        : chrome.permissions.contains({ origins: record.matches });
    return permitted.then(ok => (ok ? chrome.tabs.query({ url: record.matches }) : []));
}

function notifySiteTabs(site, message) {
    const v2 = message.action === 'updateSiteEnabled' || message.action === 'updateReadingSettings' ||
        message.action === 'refreshSettings';
    const key = `${site}:${message.action === 'updateWidthSetting' ? 'width' : message.action}`;
    latestSiteMessages.set(key, message);
    return siteTabs(site).then(tabs => {
        if (latestSiteMessages.get(key) !== message) return;
        return Promise.all(tabs.map(tab => {
            if (tab.discarded) return;
            return chrome.tabs.sendMessage(tab.id, message).then(response => {
                if (v2 && !(response && response.protocolVersion >= settingsUtils.PROTOCOL_VERSION)) {
                    return reportOutdatedPage(site, tab.id);
                }
            }, error => {
                if (v2) {
                    if (!isNoReceiver(error)) return reportOutdatedPage(site, tab.id);
                } else if (isNoReceiver(error)) {
                    showRefreshNotice();
                    chrome.tabs.reload(tab.id).catch(() => {});
                }
            });
        }));
    }).then(() => {
        if (site === currentSite) refreshLayoutStatus();
    }).catch(error => console.error('[Roomy] Could not query site tabs:', error));
}

function hasReadingEffect(settings) {
    return settings.messageFontSize !== 100 || settings.messageCompactness > 0 ||
        settings.messageSpacingCustom || settings.userFullWidth;
}

function getTabSite(tab) {
    const site = siteRegistry.forUrl(tab && tab.url);
    return site ? site.id : null;
}

async function refreshLayoutStatus() {
    const request = ++layoutStatusRequest;
    const site = currentSite;
    if (!site || !isGranted(site)) {
        setStatus('page', '');
        return;
    }
    try {
        await writeQueue;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (request !== layoutStatusRequest || site !== currentSite) return;
        if (getTabSite(tab) !== site) {
            setStatus('page', '');
            return;
        }
        let message = '';
        try {
            const result = await chrome.tabs.sendMessage(tab.id, { action: 'getLayoutStatus' });
            if (!result || result.site !== site) return;
            if (!(result.protocolVersion >= settingsUtils.PROTOCOL_VERSION) ||
                (!result.capabilities && siteSettings[site].navigationEnabled)) {
                message = t('pageOutdated', 'Saved, but this page runs an older extension version.');
            } else if (result.siteEnabled && result.widthEnabled) {
                message = { unsupported: t('layoutUnsupported'), loading: t('layoutLoading'),
                    notApplicable: t('layoutNotApplicable') }[result.status] || '';
            }
            if (!message && result.siteEnabled && result.reading && result.reading.status === 'unsupported' &&
                hasReadingEffect(siteSettings[site])) {
                message = t('readingUnsupported', 'Message layout not recognized; font size and spacing are not applied.');
            }
        } catch (error) {
            message = t('layoutUnavailable', 'Page status unavailable. Refresh the page and try again.');
        }
        if (request === layoutStatusRequest && site === currentSite) setStatus('page', message);
    } catch (error) {
    }
}

function showRefreshNotice() {
    const refreshNotice = document.getElementById('refreshNotice');
    refreshNotice.classList.add('show');
    setTimeout(() => {
        refreshNotice.classList.remove('show');
    }, 2000);
}

async function takeIntroFlags() {
    const keys = siteRegistry.optional().map(site => settingsUtils.SITE_INTRO_KEYS[site.id]);
    const stored = await chrome.storage.local.get(keys).catch(() => ({}));
    const flags = {};
    for (const site of siteRegistry.optional()) {
        const value = stored[settingsUtils.SITE_INTRO_KEYS[site.id]];
        if (value) flags[site.id] = value === 'install' ? 'install' : 'update';
    }
    const present = keys.filter(key => stored[key]);
    if (present.length) {
        await chrome.storage.local.remove(present).catch(() => {});
        await chrome.action.setBadgeText({ text: '' }).catch(() => {});
    }
    return flags;
}

async function refreshPermissions() {
    await Promise.all(siteRegistry.optional().map(async site => {
        granted[site.id] = await chrome.permissions.contains({ origins: site.matches });
    }));
    renderSiteList();
    if (currentSite) renderPermission();
    refreshLayoutStatus();
}

function requestSiteAccess(site, button) {
    const record = siteRegistry.get(site);
    if (!record || record.access !== 'optional') return;
    const request = chrome.permissions.request({ origins: record.matches });
    button.disabled = true;
    request.then(refreshPermissions).catch(error => {
        console.error(`[Roomy] Could not request ${record.name} permission:`, error);
        setStatus('error', t('sitePermissionFailed', 'Could not request access. Please try again.'));
    }).finally(() => { button.disabled = false; });
}

chrome.permissions.onAdded.addListener(refreshPermissions);
chrome.permissions.onRemoved.addListener(refreshPermissions);
