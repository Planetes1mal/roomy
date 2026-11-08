(function () {
    'use strict';

    if (window.widerChatgptContentLoaded) return;
    window.widerChatgptContentLoaded = true;

    const settingsUtils = window.widerGeminiSettings;
    const WIDTH_KEY = settingsUtils.CHATGPT_WIDTH_KEY;
    const STORAGE_KEYS = settingsUtils.getSiteStorageKeys('chatgpt');
    const ACTIVE_CLASS = 'wider-chatgpt-width-active';
    const GUTTER_CLASS = 'wider-chatgpt-nav-gutter';
    const NATIVE_WIDTH = '[class~="max-w-(--thread-body-max-width)"]';
    const HOME_OWNER = `${NATIVE_WIDTH}:has(form[data-chatgpt-composer][data-composer-placement="home"])`;
    const EXCLUDED = '[role="dialog"], [role="menu"], dialog, [data-composer-overlay-floating-ui]';
    const SURFACE_MARKERS = '[data-thread-user-message-navigation-content], [data-pip-obstacle], ' +
        'form[data-chatgpt-composer], .messaging-root, .message-list, [data-role="messages-scroll"], ' +
        '[data-codex-composer-root], [data-page-document-selection], main, ' +
        '[data-web-mobile-conversation], [data-composer-positioner]';

    const ASSISTANT_ROOT = ':is([data-markdown-text-style="assistant-message"], ' +
        '[data-message-author-role="assistant"] .markdown, [data-assistant-markdown])';
    const DOTS_USER_ROW = 'article.message-row.self:has(.message-surface)';
    const USER_BUBBLE = ':is([data-user-message-bubble], [data-message-author-role="user"] .user-message-bubble-color, ' +
        '[data-message-author-role="user"] .whitespace-pre-wrap, article.message-row.self .message-surface > .message-bubble)';
    const MESSAGE_ROOT = `:is(${ASSISTANT_ROOT}, ${USER_BUBBLE})`;
    const BLOCK_CODE = '[data-markdown-copy="code-block"] code';
    const FONT_TARGET = `p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, pre code, ${BLOCK_CODE}`;
    const PROSE_LINE = 'p, li, h1, h2, h3, h4, h5, h6, blockquote';
    const FIXED_LINE = `pre, td, th, ${BLOCK_CODE}`;
    const BLOCK_SPACING = 'p, ul, ol, blockquote, h1, h2, h3, h4, h5, h6, hr';
    const READING_TARGET = `${FONT_TARGET}, ${FIXED_LINE}, ${BLOCK_SPACING}`;
    const READING_EXCLUDED = `${EXCLUDED}, form, button, textarea, [contenteditable], .katex, svg, canvas, iframe`;
    const READING_ATTR = 'data-wgc-reading';
    const FULL_ATTR = 'data-wgc-full';
    const PATH_ATTR = 'data-wgc-full-path';
    const WIDTH_ATTR = 'data-wgc-width';
    const NODE_MARKERS = ['data-wgc-font', 'data-wgc-line', 'data-wgc-space', PATH_ATTR];
    const NODE_PROPERTIES = ['--wgc-font', '--wgc-line', '--wgc-line-cut', '--wgc-mt', '--wgc-mb'];
    const ROOT_PROPERTIES = ['--wgc-font-scale', '--wgc-density', '--wgc-space-scale',
        '--wgc-manual-line', '--wgc-manual-gap'];

    let settings = settingsUtils.normalizeSiteSettings({}, 'chatgpt');
    let storedSettings = {};
    let pendingSettingsChanges = {};
    let settingsLoaded = false;
    let readToken = 0;
    let siteActive = false;
    let surface = { kind: 'unknown' };
    let widthActive = false;
    let columnWidth = 0;
    let markedOwners = [];
    let observedTargets = [];
    let ownerProperties = [];
    let rootProperty = null;
    let gutterProperty = null;
    let insetProperty = null;
    let layoutFrame = null;
    let readingObserver = null;
    let readingScope = null;
    let measuredNodes = new WeakSet();
    let navigation = null;
    let navigationTimer = null;

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

    const nativeOwner = node => node.matches(NATIVE_WIDTH) && !node.closest(EXCLUDED);

    function isExcluded(node) {
        const hit = node.closest(READING_EXCLUDED);
        if (hit && hit.matches('button[data-user-message-bubble]')) {
            return Boolean(hit.parentElement) && isExcluded(hit.parentElement);
        }
        return Boolean(hit) && !(surface.kind === 'quickChat' && hit === surface.host);
    }

    function scrollOwner(node, limit) {
        for (let el = node.parentElement; el && el !== limit.parentElement; el = el.parentElement) {
            const overflow = getComputedStyle(el).overflowY;
            if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) return el;
        }
        return null;
    }

    function isChatSurface() {
        return Boolean(surface.root) && ['chat', 'dots', 'quickChat'].includes(surface.kind);
    }

    function discoverSurface() {
        const dotsList = findVisible('.messaging-root .thread-pane .message-list', document, nativeOwner);
        if (dotsList) {
            const pane = dotsList.closest('.thread-pane');
            const composer = findVisible(`[data-codex-composer-root] ${NATIVE_WIDTH}`, pane, nativeOwner);
            return {
                kind: 'dots', root: dotsList, column: dotsList,
                scroll: dotsList.closest('[data-role="messages-scroll"]') || pane,
                footer: null, widthOwners: composer ? [dotsList, composer] : [dotsList]
            };
        }
        const transcript = findVisible('main [data-thread-user-message-navigation-content]', document, nativeOwner);
        if (transcript) {
            const scroll = transcript.closest('[data-app-action-timeline-scroll]');
            const footer = scroll && findVisible('[data-pip-obstacle="thread-footer"]', scroll, nativeOwner);
            return {
                kind: 'chat', root: transcript, column: transcript, scroll: scroll || transcript.parentElement,
                footer, widthOwners: footer ? [transcript, footer] : []
            };
        }
        const quickChat = findVisible('section[data-pip-obstacle="quick-chat"]');
        if (quickChat) {
            const transcript = findVisible('[data-thread-user-message-navigation-content]', quickChat);
            const footer = findVisible('[data-pip-obstacle="thread-footer"]', quickChat);
            return {
                kind: 'quickChat', host: quickChat, root: transcript, column: transcript,
                scroll: transcript && (scrollOwner(transcript, quickChat) || transcript.parentElement),
                footer, widthOwners: []
            };
        }
        const loggedOut = findVisible('section[data-web-mobile-conversation][data-conversation-id]');
        if (loggedOut) {
            const footer = findVisible('[data-swipable-detail-footer]');
            const composer = footer && findVisible('[data-composer-positioner]', footer);
            return {
                kind: 'chat', root: loggedOut, column: loggedOut,
                scroll: loggedOut.closest('[data-swipable-detail-body]') || loggedOut.parentElement,
                footer, widthOwners: composer ? [loggedOut, composer] : [loggedOut]
            };
        }
        const home = findVisible(`main ${HOME_OWNER}`, document, nativeOwner) ||
            findVisible('main[data-default-home] [data-composer-positioner]');
        if (home) return { kind: 'home', root: null, widthOwners: [home] };
        if (findVisible('[data-page-document-selection]') || /^\/space(\/|$)/.test(location.pathname)) {
            return { kind: 'notApplicable', root: null, widthOwners: [] };
        }
        return { kind: 'unknown', root: null, widthOwners: [] };
    }

    function syncLayout() {
        layoutFrame = null;
        if (retired) return;
        if (!isExtensionContextValid()) {
            retire();
            return;
        }
        const root = document.documentElement;
        if (!root) return;
        const next = discoverSurface();
        const changed = next.root !== surface.root || next.kind !== surface.kind;
        surface = next;
        widthActive = siteActive && settings.widthEnabled !== false && surface.widthOwners.length > 0;
        const railWanted = navigationWanted() && userTurns().length >= window.widerMessageNavigation.MIN_TURNS;
        if (!widthActive && markedOwners.length) {
            markedOwners.forEach(owner => owner.removeAttribute(WIDTH_ATTR));
            markedOwners = [];
            root.classList.remove(GUTTER_CLASS);
        }
        restoreProperty(insetProperty);
        insetProperty = null;
        columnWidth = 0;
        if (surface.column) {
            const style = getComputedStyle(surface.column);
            columnWidth = surface.column.getBoundingClientRect().width -
                parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        }
        const nativeFree = railWanted ? navigationBounds().right - contentRight() : Infinity;
        const gutterOnly = !widthActive && railWanted && surface.widthOwners.length > 0 &&
            nativeFree < window.widerMessageNavigation.RAIL_WIDTH - 1;
        const reserve = widthActive || gutterOnly;
        if (root.classList.contains(ACTIVE_CLASS) !== widthActive) root.classList.toggle(ACTIVE_CLASS, widthActive);
        if (root.classList.contains(GUTTER_CLASS) !== gutterOnly) root.classList.toggle(GUTTER_CLASS, gutterOnly);

        const owners = reserve ? surface.widthOwners : [];
        markedOwners.filter(owner => !owners.includes(owner)).forEach(owner => owner.removeAttribute(WIDTH_ATTR));
        owners.forEach(owner => owner.setAttribute(WIDTH_ATTR, ''));
        markedOwners = owners;

        const parent = reserve && surface.column ? surface.column.parentElement : null;
        const observed = [parent, surface.scroll, surface.host].filter(Boolean);
        if (observed.length !== observedTargets.length || observed.some((el, i) => el !== observedTargets[i])) {
            availableWidthObserver.disconnect();
            observedTargets = observed;
            observed.forEach(el => availableWidthObserver.observe(el));
        }

        if (!reserve) {
            restoreProperty(rootProperty);
            rootProperty = null;
            ownerProperties.forEach(restoreProperty);
            ownerProperties = [];
        } else {
            rootProperty = writeProperty(rootProperty, root, '--wg-chatgpt-width', widthActive
                ? settingsUtils.getWidthCssValue(settings.chatWidthSetting) : `${columnWidth}px`);
            const available = parent ? `${parent.clientWidth}px` : null;
            const extra = surface.widthOwners.slice(1);
            ownerProperties.slice(extra.length).forEach(restoreProperty);
            ownerProperties = available ? extra.map((owner, i) =>
                writeProperty(ownerProperties[i], owner, '--wg-chatgpt-available-width', available)) : [];
            if (widthActive && settings.userFullWidth && surface.column) {
                markFullPaths(surface.column.querySelectorAll(USER_BUBBLE));
            }
        }
        const gutter = !railWanted ? 0 : widthActive ? neededGutter()
            : gutterOnly ? Math.ceil(window.widerMessageNavigation.RAIL_WIDTH - nativeFree) + 1 : 0;
        if (gutter) {
            gutterProperty = writeProperty(gutterProperty, root, '--wg-chatgpt-nav-gutter', `${gutter}px`);
        } else {
            restoreProperty(gutterProperty);
            gutterProperty = null;
        }
        if (railWanted && surface.kind === 'quickChat' && nativeFree < window.widerMessageNavigation.RAIL_WIDTH - 1) {
            const nativePadding = parseFloat(getComputedStyle(surface.column).paddingInlineEnd) || 0;
            insetProperty = writeProperty(null, surface.column, 'padding-inline-end',
                `${nativePadding + Math.ceil(window.widerMessageNavigation.RAIL_WIDTH - nativeFree) + 1}px`);
        }
        if (changed && document.readyState !== 'loading') applyReading();
        queueNavigation();
    }

    function queueLayout() {
        if (!retired && layoutFrame === null) layoutFrame = requestAnimationFrame(syncLayout);
    }

    const availableWidthObserver = new ResizeObserver(queueLayout);

    function observeLayout() {
        syncLayout();
        applyReading();
        const hasMarker = node => node.nodeType === 1 && (node.matches(SURFACE_MARKERS) || node.querySelector(SURFACE_MARKERS));
        layoutObserver = new MutationObserver(function (mutations) {
            const changed = mutations.some(mutation => mutation.type === 'attributes'
                ? mutation.attributeName !== 'class' || hasMarker(mutation.target)
                : [...mutation.addedNodes, ...mutation.removedNodes].some(hasMarker));
            if (changed) queueLayout();
        }).observe(document.documentElement, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ['class', 'hidden', 'inert', 'role', 'data-theme', 'data-thread-user-message-navigation-content',
                'data-pip-obstacle', 'data-composer-placement', 'data-app-action-timeline-scroll',
                'data-chatgpt-composer', 'data-composer-overlay-floating-ui']
        });
        const options = { signal: listenerControl.signal };
        if (window.navigation) window.navigation.addEventListener('navigatesuccess', queueLayout, options);
        window.addEventListener('popstate', queueLayout, options);
        window.addEventListener('resize', queueLayout, options);
    }

    function outerBubble(node) {
        let bubble = node.closest(USER_BUBBLE);
        while (bubble && bubble.parentElement && bubble.parentElement.closest(USER_BUBBLE)) {
            bubble = bubble.parentElement.closest(USER_BUBBLE);
        }
        return bubble;
    }

    function collectUserText(bubble, add) {
        const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT);
        for (let text = walker.nextNode(); text; text = walker.nextNode()) {
            if (text.textContent.trim()) add(text.parentElement);
        }
    }

    function collectReadingNodes(scopes) {
        const nodes = new Set();
        const bubbles = new Set();
        const add = node => {
            if (!node || node.nodeType !== 1 || !node.isConnected || !readingScope.contains(node) ||
                isExcluded(node)) return;
            if (node.closest(USER_BUBBLE) ||
                (node.matches(READING_TARGET) && node.closest(ASSISTANT_ROOT))) nodes.add(node);
        };
        const addBubble = node => {
            const bubble = outerBubble(node);
            if (bubble && !bubbles.has(bubble)) {
                bubbles.add(bubble);
                collectUserText(bubble, add);
            }
        };
        for (const scope of scopes) {
            if (!scope || scope.nodeType !== 1 || !scope.isConnected || !readingScope.contains(scope)) continue;
            if (scope.closest(USER_BUBBLE)) {
                addBubble(scope);
                continue;
            }
            scope.querySelectorAll(USER_BUBBLE).forEach(addBubble);
            const inside = scope.closest(ASSISTANT_ROOT);
            add(scope);
            scope.querySelectorAll(inside ? READING_TARGET : `${ASSISTANT_ROOT} :is(${READING_TARGET})`).forEach(add);
            if (inside) {
                for (const sibling of [scope.previousElementSibling, scope.nextElementSibling]) {
                    if (sibling) measuredNodes.delete(sibling);
                    add(sibling);
                }
            }
        }
        return { nodes: [...nodes].filter(node => !measuredNodes.has(node)), bubbles: [...bubbles] };
    }

    function markFullPaths(bubbles) {
        if (!(columnWidth > 0) || !surface.column) return;
        for (const node of bubbles) {
            const bubble = outerBubble(node);
            if (!bubble || bubble.hasAttribute(PATH_ATTR) || isExcluded(bubble)) continue;
            const path = [];
            let reachedColumn = false;
            for (let el = bubble; el && path.length < 10; el = el.parentElement) {
                if (el === surface.column) {
                    reachedColumn = true;
                    break;
                }
                if (getComputedStyle(el).display === 'contents') continue;
                if (el.getBoundingClientRect().width >= columnWidth - 1) {
                    reachedColumn = true;
                    break;
                }
                path.push(el);
            }
            if (!reachedColumn) continue;
            path.forEach(el => el.setAttribute(PATH_ATTR,
                el === bubble ? 'bubble' : el.matches('.message-bubble-wrap') ? 'actions' : ''));
        }
    }

    function measureReading(scopes) {
        if (!readingScope || (settings.messageFontSize === 100 && settings.messageCompactness === 0 &&
            !settings.messageSpacingCustom)) return;
        const { nodes: pending, bubbles } = collectReadingNodes(scopes);
        if (settings.userFullWidth && widthActive) markFullPaths(bubbles);
        if (!pending.length) return;
        const root = document.documentElement;
        const tokens = root.getAttribute(READING_ATTR);
        if (tokens !== null) root.removeAttribute(READING_ATTR);
        let metrics;
        try {
            metrics = pending.map(node => {
                const style = getComputedStyle(node);
                return {
                    node, display: style.display,
                    font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight),
                    top: parseFloat(style.marginTop), bottom: parseFloat(style.marginBottom)
                };
            });
        } finally {
            if (tokens !== null) root.setAttribute(READING_ATTR, tokens);
        }
        for (const { node, display, font, line, top, bottom } of metrics) {
            const user = !node.closest(ASSISTANT_ROOT);
            if ((user || node.matches(FONT_TARGET)) && font > 0) {
                node.style.setProperty('--wgc-font', `${font}px`);
                node.setAttribute('data-wgc-font', '');
            }
            if (line > 0 && (user || node.matches(`${PROSE_LINE}, ${FIXED_LINE}`))) {
                const prose = user || node.matches(PROSE_LINE);
                node.style.setProperty('--wgc-line', `${line}px`);
                if (prose) node.style.setProperty('--wgc-line-cut', `${line - Math.min(line, Math.max(font * 1.15, line * 0.82))}px`);
                node.setAttribute('data-wgc-line', prose ? 'prose' : 'fixed');
            }
            if (!user && node.matches(BLOCK_SPACING) && display !== 'inline' && display !== 'contents' &&
                Number.isFinite(top) && Number.isFinite(bottom)) {
                node.style.setProperty('--wgc-mt', `${top}px`);
                node.style.setProperty('--wgc-mb', `${bottom}px`);
                node.setAttribute('data-wgc-space', node.previousElementSibling ? 'after' : 'first');
            }
            measuredNodes.add(node);
        }
    }

    function clearReadingMarkers() {
        document.querySelectorAll(NODE_MARKERS.map(name => `[${name}]`).join(', ')).forEach(node => {
            NODE_MARKERS.forEach(name => node.removeAttribute(name));
            NODE_PROPERTIES.forEach(name => node.style.removeProperty(name));
        });
        measuredNodes = new WeakSet();
    }

    function startReading() {
        if (readingObserver || !document.body) return;
        readingObserver = new MutationObserver(function (mutations) {
            if (!isExtensionContextValid()) {
                retire();
                return;
            }
            if (!siteActive || !readingScope) return;
            const scopes = [];
            let turnsChanged = false;
            for (const mutation of mutations) {
                if (!readingScope.contains(mutation.target)) continue;
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) scopes.push(node);
                    else if (node.nodeType === 3 && node.parentElement) scopes.push(node.parentElement);
                }
                if (mutation.removedNodes.length && mutation.target.nodeType === 1) {
                    for (const child of mutation.target.children) measuredNodes.delete(child);
                    scopes.push(mutation.target);
                }
                turnsChanged = true;
            }
            if (scopes.length) measureReading(scopes);
            if (turnsChanged) queueNavigation();
        });
        readingObserver.observe(document.body, { childList: true, subtree: true });
    }

    function stopReading() {
        if (readingObserver) readingObserver.disconnect();
        readingObserver = null;
        readingScope = null;
        const root = document.documentElement;
        root.removeAttribute(READING_ATTR);
        root.removeAttribute(FULL_ATTR);
        ROOT_PROPERTIES.forEach(name => root.style.removeProperty(name));
        clearReadingMarkers();
    }

    function applyReading() {
        const root = document.documentElement;
        if (!root) return;
        if (!siteActive) {
            stopReading();
            return;
        }
        startReading();
        const scope = isChatSurface() ? surface.root : null;
        if (scope !== readingScope) {
            clearReadingMarkers();
            readingScope = scope;
            if (scope) measureReading([scope]);
        } else if (scope && !root.hasAttribute(READING_ATTR)) {
            measureReading([scope]);
        }
        const progress = settings.messageCompactness / 100;
        const custom = settings.messageSpacingCustom;
        const tokens = [];
        if (settings.messageFontSize !== 100) tokens.push('font');
        if (custom) tokens.push('custom');
        else if (progress > 0) tokens.push('line', 'space');
        else if (settings.messageFontSize !== 100) tokens.push('line');
        root.style.setProperty('--wgc-font-scale', String(settings.messageFontSize / 100));
        root.style.setProperty('--wgc-density', String(progress));
        root.style.setProperty('--wgc-space-scale', String(1 - 0.875 * progress));
        root.style.setProperty('--wgc-manual-line', String(settings.messageLineHeight));
        root.style.setProperty('--wgc-manual-gap', `${settings.messageParagraphSpacing}px`);
        if (tokens.length) root.setAttribute(READING_ATTR, tokens.join(' '));
        else root.removeAttribute(READING_ATTR);
        if (settings.userFullWidth) root.setAttribute(FULL_ATTR, '');
        else root.removeAttribute(FULL_ATTR);
    }

    function userTurns() {
        if (!surface.column) return [];
        const elements = surface.kind === 'dots'
            ? [...surface.column.querySelectorAll(DOTS_USER_ROW)]
            : [...new Set([...surface.column.querySelectorAll(USER_BUBBLE)].map(outerBubble))];
        return elements.filter(element => element && !isExcluded(element)).map(element => {
            const text = (element.querySelector('.message-text') || element).textContent.replace(/\s+/g, ' ').trim();
            const owner = element.closest('[data-turn-key], [data-message-id]');
            const key = owner && (owner.getAttribute('data-turn-key') || owner.getAttribute('data-message-id'));
            return key ? { element, text, key } : { element, text };
        });
    }

    function navigationBounds() {
        const rect = surface.scroll.getBoundingClientRect();
        const left = rect.left + surface.scroll.clientLeft;
        const footerTop = surface.footer ? surface.footer.getBoundingClientRect().top : rect.bottom;
        const top = rect.top + surface.scroll.clientTop + (surface.kind === 'quickChat' ? 8 : 56);
        return { left, right: left + surface.scroll.clientWidth, top, bottom: Math.min(rect.bottom, footerTop) - 8 };
    }

    function neededGutter() {
        if (!surface.column || !surface.column.parentElement) return 0;
        const available = surface.column.parentElement.clientWidth;
        const padding = parseFloat(getComputedStyle(surface.column).paddingRight) || 0;
        const setting = settings.chatWidthSetting;
        const requested = setting.unit === 'percent' ? innerWidth * setting.value / 100 : setting.value;
        const side = (available - Math.min(requested, available - padding * 2)) / 2;
        return side >= window.widerMessageNavigation.RAIL_WIDTH ? 0
            : Math.max(0, Math.ceil(window.widerMessageNavigation.RAIL_WIDTH - padding) + 1);
    }

    function navigationWanted() {
        return siteActive && settings.navigationEnabled && Boolean(window.widerMessageNavigation) &&
            isChatSurface() && Boolean(surface.scroll);
    }

    function contentRight() {
        const roots = [...surface.column.querySelectorAll(MESSAGE_ROOT)].slice(-40);
        if (roots.length) return Math.max(...roots.map(node => node.getBoundingClientRect().right));
        return surface.column.getBoundingClientRect().right - (parseFloat(getComputedStyle(surface.column).paddingRight) || 0);
    }

    function syncNavigation() {
        navigationTimer = null;
        if (retired) return;
        if (!navigationWanted()) {
            if (navigation) navigation.destroy();
            navigation = null;
            return;
        }
        const turns = userTurns();
        const bounds = navigationBounds();
        const fits = bounds.right - contentRight() >= window.widerMessageNavigation.RAIL_WIDTH - 1;
        if (!navigation) {
            navigation = window.widerMessageNavigation.create({
                labels: {
                    rail: chrome.i18n.getMessage('navigationLabel') || 'Message navigation',
                    message: (n, total) => (chrome.i18n.getMessage('navigationMessage') || 'Message {n} of {total}')
                        .replace('{n}', n).replace('{total}', total),
                    attachment: chrome.i18n.getMessage('navigationAttachment') || 'Attachment',
                    older: chrome.i18n.getMessage('navigationEarlier') || 'Earlier messages'
                },
                topInset: () => (surface.kind === 'quickChat' ? 16 : 72),
                onStale: queueNavigation
            });
        }
        const container = surface.kind === 'quickChat'
            ? (surface.host !== surface.scroll ? surface.host : surface.host.parentElement) : null;
        navigation.update(fits ? { turns, scrollRoot: surface.scroll, bounds, container } : null);
    }

    function queueNavigation() {
        if (!retired && navigationTimer === null) navigationTimer = setTimeout(syncNavigation, 0);
    }

    const TAKEOVER_EVENT = 'wider-chatgpt-takeover';
    const listenerControl = new AbortController();
    let layoutObserver = null;
    let retired = false;

    function retire() {
        if (retired) return;
        retired = true;
        listenerControl.abort();
        if (layoutObserver) layoutObserver.disconnect();
        if (readingObserver) readingObserver.disconnect();
        readingObserver = null;
        availableWidthObserver.disconnect();
        if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
        layoutFrame = null;
        clearTimeout(navigationTimer);
        navigationTimer = null;
        restoreProperty(insetProperty);
        insetProperty = null;
        if (navigation) navigation.destroy();
        navigation = null;
    }

    document.dispatchEvent(new Event(TAKEOVER_EVENT));
    document.addEventListener(TAKEOVER_EVENT, retire, { signal: listenerControl.signal });

    function applyAllSettings() {
        if (!settingsLoaded) return;
        settings = settingsUtils.normalizeSiteSettings(storedSettings, 'chatgpt');
        siteActive = isExtensionContextValid() && settings.siteEnabled;
        syncLayout();
        if (document.readyState !== 'loading') applyReading();
        queueNavigation();
    }

    function readSettings() {
        if (!isExtensionContextValid()) return;
        const token = ++readToken;
        chrome.storage.sync.get(STORAGE_KEYS, function (result) {
            if (!isExtensionContextValid() || chrome.runtime.lastError || token !== readToken) return;
            storedSettings = { ...result, ...pendingSettingsChanges };
            pendingSettingsChanges = {};
            settingsLoaded = true;
            applyAllSettings();
        });
    }

    function getLayoutStatus() {
        syncLayout();
        const widthEnabled = settings.widthEnabled !== false;
        const pauseReason = !settings.siteEnabled ? 'site' : !widthEnabled ? 'width' : null;
        const chatSurface = isChatSurface();
        const nativeOnly = surface.kind === 'notApplicable' || surface.kind === 'quickChat';
        const supported = surface.widthOwners.length > 0;
        const status = !settingsLoaded ? 'loading' : pauseReason === 'site' ? 'sitePaused'
            : pauseReason === 'width' ? 'paused' : supported ? 'active' : nativeOnly ? 'notApplicable'
                : document.readyState === 'loading' ? 'loading' : 'unsupported';
        const messages = Boolean(readingScope && readingScope.querySelector(MESSAGE_ROOT));
        const conversation = Boolean(chatSurface && surface.root.textContent.trim());
        const readingStatus = !settingsLoaded ? 'loading' : !settings.siteEnabled ? 'paused'
            : !chatSurface ? 'notApplicable' : messages ? 'active' : conversation ? 'unsupported' : 'idle';
        const paused = !settings.siteEnabled ? 'paused' : null;
        const turns = chatSurface ? userTurns().length : 0;
        return {
            site: 'chatgpt', protocolVersion: settingsUtils.PROTOCOL_VERSION,
            siteEnabled: settings.siteEnabled, widthEnabled, enabled: widthEnabled, supported, status, pauseReason,
            surface: { kind: surface.kind },
            width: { active: widthActive },
            reading: { active: siteActive && messages, status: readingStatus },
            capabilities: {
                width: paused || (!widthEnabled ? 'off' : supported ? 'active' : nativeOnly ? 'notApplicable' : 'unsupported'),
                reading: readingStatus,
                fullWidth: paused || (!settings.userFullWidth ? 'off' : !widthActive ? 'idle'
                    : document.querySelector(`[${PATH_ATTR}]`) ? 'active' : 'idle'),
                navigation: paused || (!settings.navigationEnabled ? 'off' : !chatSurface ? 'notApplicable'
                    : navigation && navigation.visible ? 'active' : 'idle')
            },
            navigation: { turns, visible: Boolean(navigation && navigation.visible) }
        };
    }

    if (!isExtensionContextValid()) return;

    chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'sync' || !isExtensionContextValid()) return;
        const values = {};
        for (const key of STORAGE_KEYS) {
            if (Object.hasOwn(changes, key)) values[key] = changes[key].newValue;
        }
        if (!Object.keys(values).length) return;
        ++readToken;
        if (!settingsLoaded) {
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
            if (settingsLoaded) readSettings();
            sendResponse({ success: true, protocolVersion: settingsUtils.PROTOCOL_VERSION });
        } else if (request.action === 'updateWidthEnabled' || request.action === 'updateWidthSetting') {
            if (settingsLoaded) {
                const width = settingsUtils.normalizeSiteWidthSettings(storedSettings, 'chatgpt');
                if (typeof request.enabled === 'boolean') width.widthEnabled = request.enabled;
                if (request.action === 'updateWidthSetting') {
                    Object.assign(width, request.ranges, { chatWidthSetting: request.setting });
                }
                storedSettings[WIDTH_KEY] = width;
                applyAllSettings();
            }
            sendResponse({ success: true });
        }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeLayout, { once: true });
    else observeLayout();
    readSettings();
})();
