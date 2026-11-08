(function (global) {
    'use strict';

    const SHARED_JS = ['src/shared/sites.js', 'src/shared/settings-utils.js', 'src/content/message-navigation.js'];
    const SHARED_CSS = ['src/content/message-navigation.css'];
    const CORE_JS = ['src/content/core/runtime.js', 'src/content/core/width.js', 'src/content/core/reading.js',
        'src/content/core/navigation.js'];
    const CORE_CSS = ['src/content/core/core.css'];
    const CORE_LOADED_FLAG = 'widerCoreContentLoaded';
    const CORE_TAKEOVER_EVENT = 'wider-core-takeover';
    const CAPABILITIES = ['width', 'navigation', 'reading', 'userFullWidth', 'codeWrap'];

    const SITES = [
        {
            id: 'gemini',
            name: 'Gemini',
            url: 'https://gemini.google.com/',
            matches: ['https://gemini.google.com/*'],
            access: 'required',
            since: '1.0.0',
            runtime: 'legacy',
            storage: 'gemini-legacy',
            capabilities: ['width', 'navigation', 'reading', 'userFullWidth', 'codeWrap'],
            tasks: ['reading', 'table', 'code', 'large'],
            legacy: {
                js: [...SHARED_JS, 'src/content/gemini-content.js'],
                css: [...SHARED_CSS, 'src/content/gemini-content.css'],
                loadedFlag: 'widerGeminiContentLoaded',
                takeoverEvent: 'wider-gemini-takeover'
            }
        },
        {
            id: 'chatgpt',
            name: 'ChatGPT',
            url: 'https://chatgpt.com/',
            matches: ['https://chatgpt.com/*'],
            access: 'optional',
            since: '3.0.0',
            runtime: 'legacy',
            storage: 'default',
            capabilities: ['width', 'navigation', 'reading', 'userFullWidth'],
            tasks: ['reading', 'wide', 'large'],
            legacy: {
                js: [...SHARED_JS, 'src/content/chatgpt-content.js'],
                css: [...SHARED_CSS, 'src/content/chatgpt-content.css'],
                loadedFlag: 'widerChatgptContentLoaded',
                takeoverEvent: 'wider-chatgpt-takeover'
            }
        },
        {
            id: 'claude',
            name: 'Claude',
            url: 'https://claude.ai/',
            matches: ['https://claude.ai/*'],
            access: 'optional',
            since: '3.1.0',
            runtime: 'core',
            storage: 'default',
            capabilities: ['width', 'navigation', 'reading', 'userFullWidth'],
            tasks: ['reading', 'wide', 'large'],
            adapter: { js: 'src/content/sites/claude.js', css: 'src/content/sites/claude.css' }
        },
        {
            id: 'deepseek',
            name: 'DeepSeek',
            url: 'https://chat.deepseek.com/',
            matches: ['https://chat.deepseek.com/*'],
            access: 'optional',
            since: '3.2.0',
            runtime: 'core',
            storage: 'default',
            capabilities: ['width', 'navigation', 'reading', 'userFullWidth'],
            tasks: ['reading', 'wide', 'large'],
            adapter: { js: 'src/content/sites/deepseek.js', css: 'src/content/sites/deepseek.css' }
        }
    ];

    const byId = Object.fromEntries(SITES.map(site => [site.id, site]));

    function get(id) {
        return byId[id] || null;
    }

    function required() {
        return SITES.filter(site => site.access === 'required');
    }

    function optional() {
        return SITES.filter(site => site.access === 'optional');
    }

    function matchesUrl(pattern, url) {
        const match = /^(https?):\/\/([^/]+)\/\*$/.exec(pattern);
        if (!match) return false;
        let parsed;
        try {
            parsed = new URL(url);
        } catch (e) {
            return false;
        }
        if (parsed.protocol !== `${match[1]}:`) return false;
        const host = match[2];
        if (host.startsWith('*.')) {
            const base = host.slice(2);
            return parsed.hostname === base || parsed.hostname.endsWith(`.${base}`);
        }
        return parsed.hostname === host;
    }

    function forUrl(url) {
        if (!url) return null;
        return SITES.find(site => site.matches.some(pattern => matchesUrl(pattern, url))) || null;
    }

    function getStorageKeys(id) {
        const site = get(id);
        const legacy = site && site.storage === 'gemini-legacy';
        return {
            enabled: `${id}Enabled`,
            navigation: `${id}MessageNavigationEnabled`,
            width: legacy ? null : `${id}WidthSettings`,
            reading: legacy ? null : `${id}ReadingSettings`,
            taskUndo: legacy ? 'taskPresetUndo' : `${id}TaskPresetUndo`,
            intro: `${id}IntroPending`
        };
    }

    function getContentScript(id) {
        const site = get(id);
        if (!site) return null;
        const core = site.runtime === 'core';
        const adapter = site.adapter || { js: '', css: '' };
        return {
            id: `wider-${site.id}`,
            matches: [...site.matches],
            js: core ? [...SHARED_JS, ...CORE_JS, adapter.js] : [...site.legacy.js],
            css: core ? [...SHARED_CSS, ...CORE_CSS, ...(adapter.css ? [adapter.css] : [])] : [...site.legacy.css],
            runAt: 'document_start',
            persistAcrossSessions: true,
            loadedFlag: core ? CORE_LOADED_FLAG : site.legacy.loadedFlag
        };
    }

    function compareVersions(a, b) {
        const left = String(a || '').split('.').map(part => parseInt(part, 10) || 0);
        const right = String(b || '').split('.').map(part => parseInt(part, 10) || 0);
        for (let i = 0; i < Math.max(left.length, right.length); i++) {
            const delta = (left[i] || 0) - (right[i] || 0);
            if (delta) return delta;
        }
        return 0;
    }

    function addedSince(previousVersion) {
        return optional().filter(site => compareVersions(site.since, previousVersion) > 0);
    }

    function joinNames(names, language) {
        if (typeof Intl !== 'undefined' && typeof Intl.ListFormat === 'function') {
            try {
                return new Intl.ListFormat(language || undefined, { style: 'long', type: 'conjunction' }).format(names);
            } catch (e) {
            }
        }
        return names.join(', ');
    }

    global.widerRoomySites = {
        sites: SITES,
        CAPABILITIES,
        CORE_JS,
        CORE_CSS,
        CORE_LOADED_FLAG,
        CORE_TAKEOVER_EVENT,
        get,
        required,
        optional,
        matchesUrl,
        forUrl,
        getStorageKeys,
        getContentScript,
        compareVersions,
        addedSince,
        joinNames
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
