(function () {
    'use strict';

    const core = window.widerRoomyCore = window.widerRoomyCore || { modules: {} };
    if (core.defineSite) return;

    const registry = window.widerRoomySites;
    const LOADED_FLAG = registry.CORE_LOADED_FLAG;
    const TAKEOVER_EVENT = registry.CORE_TAKEOVER_EVENT;
    const SITE_CLASS = 'wider-core-active';
    const OVERLAY = '[role="dialog"], [role="menu"], dialog';

    function isExtensionContextValid() {
        try {
            return Boolean(chrome.runtime && chrome.runtime.id);
        } catch (e) {
            return false;
        }
    }

    function writeProperty(record, element, property, value) {
        if (!record || record.element !== element) {
            restoreProperty(record);
            record = {
                element, property,
                original: element.style.getPropertyValue(property),
                priority: element.style.getPropertyPriority(property)
            };
        }
        if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
        record.written = value;
        return record;
    }

    function restoreProperty(record) {
        if (!record || record.element.style.getPropertyValue(record.property) !== record.written ||
            record.element.style.getPropertyPriority(record.property) !== '') return;
        if (record.original) record.element.style.setProperty(record.property, record.original, record.priority);
        else record.element.style.removeProperty(record.property);
    }

    function isVisible(element) {
        if (!element || element.closest('[inert], [hidden]')) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
    }

    function findVisible(selector, scope = document, accept = () => true) {
        return Array.from(scope.querySelectorAll(selector)).find(node => accept(node) && isVisible(node)) || null;
    }

    function findAllVisible(selector, scope = document) {
        return Array.from(scope.querySelectorAll(selector)).filter(isVisible);
    }

    function scrollOwner(node, limit) {
        for (let el = node.parentElement; el && el !== (limit ? limit.parentElement : null); el = el.parentElement) {
            const overflow = getComputedStyle(el).overflowY;
            if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) return el;
        }
        return null;
    }

    function findWidthOwner(start, boundary) {
        const root = document.documentElement;
        const classes = ['wider-width-active', 'wider-nav-gutter'].filter(name => root.classList.contains(name));
        classes.forEach(name => root.classList.remove(name));
        try {
            for (let el = start; el && el !== boundary; el = el.parentElement) {
                const parent = el.parentElement;
                if (!parent) break;
                const style = getComputedStyle(el);
                const max = parseFloat(style.maxWidth);
                const parentStyle = getComputedStyle(parent);
                const available = parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight);
                if (Number.isFinite(max) && max > 0 && available > max + 1) return el;
            }
            return null;
        } finally {
            classes.forEach(name => root.classList.add(name));
        }
    }

    function normalizeDefinition(definition) {
        const reading = definition.reading || {};
        const navigation = definition.navigation || {};
        const watch = definition.watch || {};
        const selectors = definition.selectors || {};
        return {
            id: definition.id,
            selectors,
            discover: definition.discover,
            reading: {
                assistantRoot: reading.assistantRoot || selectors.assistantRoot || null,
                userBubble: reading.userBubble || selectors.userBubble || null,
                exclude: reading.exclude || selectors.exclude || '',
                fontTarget: reading.fontTarget || '',
                fixedLine: reading.fixedLine || ''
            },
            turns: definition.turns || null,
            turnKey: definition.turnKey || null,
            turnText: definition.turnText || selectors.turnText || null,
            navigation: {
                topInset: navigation.topInset === undefined ? 56 : navigation.topInset,
                bottomInset: navigation.bottomInset === undefined ? 8 : navigation.bottomInset,
                scrollInset: navigation.scrollInset === undefined ? 72 : navigation.scrollInset
            },
            watch: {
                markers: watch.markers || '',
                attributes: watch.attributes || []
            },
            hooks: definition.hooks || {}
        };
    }

    function resolve(value, ...args) {
        return typeof value === 'function' ? value(...args) : value;
    }

    function defineSite(definition) {
        if (window[LOADED_FLAG]) return null;
        window[LOADED_FLAG] = true;
        const settingsUtils = window.widerGeminiSettings;
        const site = normalizeDefinition(definition);
        const STORAGE_KEYS = settingsUtils.getSiteStorageKeys(site.id);
        const KEYS = settingsUtils.getSiteKeys(site.id);
        const listenerControl = new AbortController();
        let layoutObserver = null;
        let layoutFrame = null;
        let readToken = 0;
        let storedSettings = {};
        let pendingSettingsChanges = {};

        const ctx = {
            site,
            settingsUtils,
            settings: settingsUtils.normalizeSiteSettings({}, site.id),
            settingsLoaded: false,
            siteActive: false,
            surface: { kind: 'unknown', root: null, widthOwners: [] },
            retired: false,
            isExtensionContextValid,
            writeProperty,
            restoreProperty,
            isVisible,
            findVisible,
            findAllVisible,
            scrollOwner,
            findWidthOwner,
            resolve,
            OVERLAY,
            retire,
            queueLayout,
            syncLayout,
            applyReading: () => ctx.reading.apply(),
            queueNavigation: () => ctx.navigation.queue()
        };
        ctx.width = core.modules.width(ctx);
        ctx.reading = core.modules.reading(ctx);
        ctx.navigation = core.modules.navigation(ctx);

        function isChatSurface() {
            return Boolean(ctx.surface.root) && ctx.surface.kind === 'chat';
        }
        ctx.isChatSurface = isChatSurface;

        function isExcluded(node) {
            const hit = node.closest(ctx.reading.EXCLUDED);
            if (site.hooks.isExcluded) return site.hooks.isExcluded(node, hit, ctx);
            return Boolean(hit);
        }
        ctx.isExcluded = isExcluded;

        function discoverSurface() {
            const next = site.discover(ctx) || {};
            return {
                kind: next.kind || 'unknown',
                root: next.root || null,
                column: next.column || next.root || null,
                scroll: next.scroll || null,
                footer: next.footer || null,
                pane: next.pane || null,
                host: next.host || null,
                navigationContainer: next.navigationContainer || null,
                nativeWidth: next.nativeWidth === true,
                widthOwners: (next.widthOwners || []).map(owner => owner && owner.element
                    ? { element: owner.element, strategy: owner.strategy || 'maxWidth' }
                    : { element: owner, strategy: 'maxWidth' }).filter(owner => owner.element)
            };
        }

        function syncLayout() {
            layoutFrame = null;
            if (ctx.retired) return;
            if (!isExtensionContextValid()) {
                retire();
                return;
            }
            const root = document.documentElement;
            if (!root) return;
            const next = discoverSurface();
            const changed = next.root !== ctx.surface.root || next.kind !== ctx.surface.kind;
            ctx.surface = next;
            ctx.width.sync();
            if (site.hooks.afterSync) site.hooks.afterSync(ctx);
            if (changed && document.readyState !== 'loading') ctx.reading.apply();
            ctx.navigation.queue();
        }

        function queueLayout() {
            if (!ctx.retired && layoutFrame === null) layoutFrame = requestAnimationFrame(syncLayout);
        }

        function observeLayout() {
            syncLayout();
            ctx.reading.apply();
            const markers = site.watch.markers;
            const hasMarker = node => node.nodeType === 1 && Boolean(markers) &&
                (node.matches(markers) || Boolean(node.querySelector(markers)));
            layoutObserver = new MutationObserver(function (mutations) {
                const changed = mutations.some(mutation => mutation.type === 'attributes'
                    ? mutation.attributeName !== 'class' || hasMarker(mutation.target)
                    : [...mutation.addedNodes, ...mutation.removedNodes].some(hasMarker));
                if (changed) queueLayout();
            });
            layoutObserver.observe(document.documentElement, {
                childList: true, subtree: true, attributes: true,
                attributeFilter: [...new Set(['class', 'hidden', 'inert', 'role', 'data-theme', ...site.watch.attributes])]
            });
            const options = { signal: listenerControl.signal };
            if (window.navigation) window.navigation.addEventListener('navigatesuccess', queueLayout, options);
            window.addEventListener('popstate', queueLayout, options);
            window.addEventListener('resize', queueLayout, options);
        }

        function retire() {
            if (ctx.retired) return;
            ctx.retired = true;
            listenerControl.abort();
            if (layoutObserver) layoutObserver.disconnect();
            if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
            layoutFrame = null;
            ctx.reading.retire();
            ctx.width.retire();
            ctx.navigation.retire();
            if (site.hooks.retire) site.hooks.retire(ctx);
        }

        document.dispatchEvent(new Event(TAKEOVER_EVENT));
        document.addEventListener(TAKEOVER_EVENT, retire, { signal: listenerControl.signal });

        function applyAllSettings() {
            if (!ctx.settingsLoaded) return;
            ctx.settings = settingsUtils.normalizeSiteSettings(storedSettings, site.id);
            ctx.siteActive = isExtensionContextValid() && ctx.settings.siteEnabled;
            const root = document.documentElement;
            if (root) {
                root.setAttribute('data-wgx-site', site.id);
                if (root.classList.contains(SITE_CLASS) !== ctx.siteActive) root.classList.toggle(SITE_CLASS, ctx.siteActive);
            }
            syncLayout();
            if (document.readyState !== 'loading') ctx.reading.apply();
            ctx.navigation.queue();
        }

        function readSettings() {
            if (!isExtensionContextValid()) return;
            const token = ++readToken;
            chrome.storage.sync.get(STORAGE_KEYS, function (result) {
                if (!isExtensionContextValid() || chrome.runtime.lastError || token !== readToken) return;
                storedSettings = { ...result, ...pendingSettingsChanges };
                pendingSettingsChanges = {};
                ctx.settingsLoaded = true;
                applyAllSettings();
            });
        }

        function getLayoutStatus() {
            syncLayout();
            const settings = ctx.settings;
            const surface = ctx.surface;
            const widthEnabled = settings.widthEnabled !== false;
            const pauseReason = !settings.siteEnabled ? 'site' : !widthEnabled ? 'width' : null;
            const chatSurface = isChatSurface();
            const nativeOnly = surface.kind === 'notApplicable' || (chatSurface && surface.nativeWidth);
            const supported = surface.widthOwners.length > 0;
            const status = !ctx.settingsLoaded ? 'loading' : pauseReason === 'site' ? 'sitePaused'
                : pauseReason === 'width' ? 'paused' : supported ? 'active' : nativeOnly ? 'notApplicable'
                    : document.readyState === 'loading' ? 'loading' : 'unsupported';
            const messages = ctx.reading.hasMessages();
            const conversation = Boolean(chatSurface && surface.root.textContent.trim());
            const readingStatus = !ctx.settingsLoaded ? 'loading' : !settings.siteEnabled ? 'paused'
                : !chatSurface ? 'notApplicable' : messages ? 'active' : conversation ? 'unsupported' : 'idle';
            const paused = !settings.siteEnabled ? 'paused' : null;
            const turns = chatSurface ? ctx.navigation.turns().length : 0;
            const rail = ctx.navigation.rail;
            return {
                site: site.id, protocolVersion: settingsUtils.PROTOCOL_VERSION,
                siteEnabled: settings.siteEnabled, widthEnabled, enabled: widthEnabled, supported, status, pauseReason,
                surface: { kind: surface.kind },
                width: { active: ctx.width.active },
                reading: { active: ctx.siteActive && messages, status: readingStatus },
                capabilities: {
                    width: paused || (!widthEnabled ? 'off' : supported ? 'active' : nativeOnly ? 'notApplicable' : 'unsupported'),
                    reading: readingStatus,
                    fullWidth: paused || (!settings.userFullWidth ? 'off' : !ctx.width.active ? 'idle'
                        : ctx.reading.hasFullPaths() ? 'active' : 'idle'),
                    navigation: paused || (!settings.navigationEnabled ? 'off' : !chatSurface ? 'notApplicable'
                        : rail && rail.visible ? 'active' : 'idle')
                },
                navigation: { turns, visible: Boolean(rail && rail.visible) }
            };
        }

        if (!isExtensionContextValid()) return ctx;

        chrome.storage.onChanged.addListener(function (changes, area) {
            if (area !== 'sync' || !isExtensionContextValid()) return;
            const values = {};
            for (const key of STORAGE_KEYS) {
                if (Object.hasOwn(changes, key)) values[key] = changes[key].newValue;
            }
            if (!Object.keys(values).length) return;
            ++readToken;
            if (!ctx.settingsLoaded) {
                Object.assign(pendingSettingsChanges, values);
                readSettings();
                return;
            }
            Object.assign(storedSettings, values);
            applyAllSettings();
        });

        chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            if (!isExtensionContextValid()) return;
            if (request.action === 'getLayoutStatus') {
                sendResponse(getLayoutStatus());
            } else if (['updateSiteEnabled', 'updateReadingSettings', 'refreshSettings'].includes(request.action)) {
                if (ctx.settingsLoaded) readSettings();
                sendResponse({ success: true, protocolVersion: settingsUtils.PROTOCOL_VERSION });
            } else if (request.action === 'updateWidthEnabled' || request.action === 'updateWidthSetting') {
                if (ctx.settingsLoaded) {
                    const width = settingsUtils.normalizeSiteWidthSettings(storedSettings, site.id);
                    if (typeof request.enabled === 'boolean') width.widthEnabled = request.enabled;
                    if (request.action === 'updateWidthSetting') {
                        Object.assign(width, request.ranges, { chatWidthSetting: request.setting });
                    }
                    if (KEYS.width) storedSettings[KEYS.width] = width;
                    else Object.assign(storedSettings, settingsUtils.getSiteWidthStoragePayload(width, site.id));
                    applyAllSettings();
                }
                sendResponse({ success: true });
            }
        });

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeLayout, { once: true });
        else observeLayout();
        readSettings();
        return ctx;
    }

    core.defineSite = defineSite;
    core.LOADED_FLAG = LOADED_FLAG;
    core.TAKEOVER_EVENT = TAKEOVER_EVENT;
})();
