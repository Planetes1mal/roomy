(function () {
    'use strict';

    const sites = window.widerRoomySites;
    const settingsUtils = window.widerGeminiSettings;
    const generateButton = document.getElementById('generateReport');
    const preview = document.getElementById('reportPreview');
    const report = document.getElementById('diagnosticReport');
    const status = document.getElementById('reportStatus');
    let dictionary = null;

    function isExtensionContextValid() {
        try {
            return chrome.runtime && chrome.runtime.id;
        } catch (e) {
            return false;
        }
    }

    function t(key, fallback) {
        return (dictionary && dictionary[key] && dictionary[key].message) || chrome.i18n.getMessage(key) || fallback;
    }

    function placeholders() {
        const language = t('localeCode', 'en');
        const names = list => sites.joinNames(list.map(site => site.name), language);
        return {
            sites: names(sites.sites),
            required: names(sites.required()),
            optional: names(sites.optional()),
            navigationSites: names(sites.sites.filter(site => site.capabilities.includes('navigation'))),
            codeWrapSites: names(sites.sites.filter(site => site.capabilities.includes('codeWrap')))
        };
    }

    function fill(text, values) {
        return Object.keys(values).reduce((result, key) => result.split(`{${key}}`).join(values[key]), text);
    }

    function renderSiteLinks() {
        const container = document.getElementById('siteLinks');
        container.textContent = '';
        for (const site of sites.sites) {
            const link = document.createElement('a');
            link.className = 'text-link';
            link.href = site.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = fill(t('helpOpenSite', 'Open {site}'), { site: site.name });
            container.appendChild(link);
        }
    }

    const toc = document.querySelector('.toc');
    const sections = Array.from(document.querySelectorAll('main section[id]'));
    function updateContents() {
        let current = sections[0];
        for (const section of sections) {
            if (section.getBoundingClientRect().top <= 17) current = section;
        }
        if (Math.ceil(window.scrollY + innerHeight) >= document.documentElement.scrollHeight) current = sections.at(-1);
        for (const link of toc.children) {
            if (link.hash === '#' + current.id) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        }
    }
    window.addEventListener('scroll', updateContents, { passive: true });
    window.addEventListener('resize', updateContents);

    function renderPresets() {
        const tbody = document.getElementById('presetsTable');
        tbody.replaceChildren();
        const labels = { reading: 'taskReading', wide: 'taskWide', table: 'taskTable', code: 'taskCode', large: 'taskLarge' };
        for (const [task, label] of Object.entries(labels)) {
            const available = sites.sites.filter(site => site.tasks.includes(task));
            if (!available.length) continue;
            const { chatWidthSetting: width, messageFontSize } = settingsUtils.TASK_DEFINITIONS[task];
            const row = tbody.insertRow();
            for (const value of [t(label), width.value + (width.unit === 'px' ? ' px' : '%'), messageFontSize + '%',
                available.length === sites.sites.length ? t('allSites') : sites.joinNames(available.map(s => s.name), t('localeCode'))]) {
                row.insertCell().textContent = value;
            }
        }
    }

    async function localize(language) {
        const selected = settingsUtils.normalizeUiLanguage(language);
        dictionary = null;
        if (selected !== 'auto') {
            try {
                const response = await fetch(chrome.runtime.getURL(`_locales/${selected}/messages.json`));
                dictionary = await response.json();
            } catch (e) {
                console.error('[Roomy] Failed to load help language:', e.message);
            }
        }
        document.documentElement.lang = t('localeCode', 'en');
        const values = placeholders();
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.dataset.i18n;
            const text = t(key, element.textContent);
            element.textContent = fill(text, key === 'helpCodeBody' ? { ...values, sites: values.codeWrapSites } : values);
        });
        renderSiteLinks();
        renderPresets();
        toc.setAttribute('aria-label', t('onThisPage'));
        document.querySelectorAll('a[target="_blank"]').forEach(link => {
            link.querySelector('.sr')?.remove();
            const hint = document.createElement('span');
            hint.className = 'sr';
            hint.textContent = ' (' + t('newTab') + ')';
            link.append(hint);
        });
        updateContents();
        status.textContent = '';
    }

    function getBrowserVersion() {
        const match = navigator.userAgent.match(/(Edg|OPR)\/(\d+)/) || navigator.userAgent.match(/(Chrome)\/(\d+)/);
        const names = { Edg: 'Edge', OPR: 'Opera', Chrome: 'Chromium' };
        return { name: match ? names[match[1]] : 'Unknown', major: match ? Number(match[2]) : null };
    }

    function siteReport(stored, site) {
        const settings = settingsUtils.normalizeSiteSettings(stored, site.id);
        const entry = {
            enabled: settings.siteEnabled,
            navigationEnabled: settings.navigationEnabled,
            width: {
                widthEnabled: settings.widthEnabled,
                chatWidthSetting: { value: settings.chatWidthSetting.value, unit: settings.chatWidthSetting.unit },
                widthMin: settings.widthMin,
                widthMax: settings.widthMax,
                widthPercentMin: settings.widthPercentMin,
                widthPercentMax: settings.widthPercentMax
            },
            reading: {
                messageCompactness: settings.messageCompactness,
                messageLineHeight: settings.messageLineHeight,
                messageParagraphSpacing: settings.messageParagraphSpacing,
                messageSpacingCustom: settings.messageSpacingCustom,
                messageFontSize: settings.messageFontSize,
                userFullWidth: settings.userFullWidth
            }
        };
        if (site.capabilities.includes('codeWrap')) entry.reading.codeWrap = settings.codeWrap === true;
        return entry;
    }

    generateButton.addEventListener('click', async function () {
        if (!isExtensionContextValid()) return;
        generateButton.disabled = true;
        preview.hidden = true;
        report.value = '';
        status.textContent = t('helpReportGenerating', 'Reading settings…');
        try {
            const keys = [...new Set(sites.sites.flatMap(site => settingsUtils.getSiteStorageKeys(site.id))), 'uiLanguage'];
            const [stored, platform] = await Promise.all([
                chrome.storage.sync.get(keys),
                chrome.runtime.getPlatformInfo()
            ]);
            const manifest = chrome.runtime.getManifest();
            const grants = await Promise.all(sites.sites.map(async site => [site.id,
                site.access === 'required' ? 'required' : (await chrome.permissions.contains({ origins: site.matches }) ? 'granted' : 'notGranted')]));
            const diagnostics = {
                extensionVersion: manifest.version_name || manifest.version,
                browser: getBrowserVersion(),
                platform: platform.os,
                uiLanguage: settingsUtils.normalizeUiLanguage(stored.uiLanguage),
                access: Object.fromEntries(grants),
                sites: Object.fromEntries(sites.sites.map(site => [site.id, siteReport(stored, site)]))
            };
            report.value = JSON.stringify(diagnostics, null, 2);
            preview.hidden = false;
            status.textContent = t('helpReportReady', 'Report ready. Review it, then copy it if you want to share it.');
        } catch (e) {
            status.textContent = t('helpReportError', 'Could not read settings. Reopen help from the extension and try again.');
        } finally {
            generateButton.disabled = false;
        }
    });

    document.getElementById('copyReport').addEventListener('click', async function () {
        try {
            await navigator.clipboard.writeText(report.value);
            status.textContent = t('helpReportCopied', 'Copied. You can paste the report into your issue.');
        } catch (e) {
            report.focus();
            report.select();
            status.textContent = t('helpReportCopyFallback', 'Copy was unavailable. The report is selected; copy it manually.');
        }
    });

    async function init() {
        if (!isExtensionContextValid()) {
            generateButton.disabled = true;
            status.textContent = 'Open this help page from the Roomy extension to generate a settings report.';
            return;
        }
        const manifest = chrome.runtime.getManifest();
        document.getElementById('extensionVersion').textContent = `v${manifest.version_name || manifest.version}`;
        try {
            const stored = await chrome.storage.sync.get(['uiLanguage']);
            await localize(stored.uiLanguage);
        } catch (e) {
            await localize('auto');
        }
        chrome.storage.onChanged.addListener(function (changes, namespace) {
            if (namespace === 'sync' && changes.uiLanguage && isExtensionContextValid()) {
                localize(changes.uiLanguage.newValue);
            }
        });
    }

    init();
})();
