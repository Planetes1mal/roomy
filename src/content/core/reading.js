(function () {
    'use strict';

    const core = window.widerRoomyCore = window.widerRoomyCore || { modules: {} };
    if (core.modules.reading) return;

    const READING_ATTR = 'data-wgx-reading';
    const FULL_ATTR = 'data-wgx-full';
    const PATH_ATTR = 'data-wgx-full-path';
    const NODE_MARKERS = ['data-wgx-font', 'data-wgx-line', 'data-wgx-space', PATH_ATTR];
    const NODE_PROPERTIES = ['--wgx-font', '--wgx-line', '--wgx-line-cut', '--wgx-mt', '--wgx-mb'];
    const ROOT_PROPERTIES = ['--wgx-font-scale', '--wgx-density', '--wgx-space-scale', '--wgx-manual-line', '--wgx-manual-gap'];
    const BASE_FONT_TARGET = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, pre code';
    const PROSE_LINE = 'p, li, h1, h2, h3, h4, h5, h6, blockquote';
    const BASE_FIXED_LINE = 'pre, td, th';
    const BLOCK_SPACING = 'p, ul, ol, blockquote, h1, h2, h3, h4, h5, h6, hr';
    const BASE_EXCLUDED = 'form, button, textarea, [contenteditable], .katex, svg, canvas, iframe';

    const join = (...parts) => parts.filter(Boolean).join(', ');

    core.modules.reading = function (ctx) {
        const site = ctx.site;
        const ASSISTANT_ROOT = site.reading.assistantRoot;
        const USER_BUBBLE = site.reading.userBubble;
        const MESSAGE_ROOT = join(ASSISTANT_ROOT, USER_BUBBLE) ? `:is(${join(ASSISTANT_ROOT, USER_BUBBLE)})` : null;
        const FONT_TARGET = join(BASE_FONT_TARGET, site.reading.fontTarget);
        const FIXED_LINE = join(BASE_FIXED_LINE, site.reading.fixedLine);
        const READING_TARGET = join(FONT_TARGET, FIXED_LINE, BLOCK_SPACING);
        const EXCLUDED = join(ctx.OVERLAY, site.reading.exclude, BASE_EXCLUDED);

        let readingObserver = null;
        let readingScope = null;
        let measuredNodes = new WeakSet();

        const module = {
            ASSISTANT_ROOT, USER_BUBBLE, MESSAGE_ROOT, EXCLUDED, READING_ATTR, FULL_ATTR, PATH_ATTR,
            get scope() { return readingScope; }
        };

        function outerBubble(node) {
            if (!USER_BUBBLE) return null;
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
                    ctx.isExcluded(node)) return;
                if ((USER_BUBBLE && node.closest(USER_BUBBLE)) ||
                    (ASSISTANT_ROOT && node.matches(READING_TARGET) && node.closest(ASSISTANT_ROOT))) nodes.add(node);
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
                if (USER_BUBBLE && scope.closest(USER_BUBBLE)) {
                    addBubble(scope);
                    continue;
                }
                if (USER_BUBBLE) scope.querySelectorAll(USER_BUBBLE).forEach(addBubble);
                if (!ASSISTANT_ROOT) continue;
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
            const columnWidth = ctx.width.columnWidth;
            const column = ctx.surface.column;
            if (!(columnWidth > 0) || !column) return;
            for (const node of bubbles) {
                const bubble = outerBubble(node);
                if (!bubble || bubble.hasAttribute(PATH_ATTR) || ctx.isExcluded(bubble)) continue;
                const path = [];
                let reachedColumn = false;
                for (let el = bubble; el && path.length < 10; el = el.parentElement) {
                    if (el === column) {
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
                path.forEach(el => el.setAttribute(PATH_ATTR, el === bubble ? 'bubble'
                    : site.hooks.fullPath ? site.hooks.fullPath(el, bubble, ctx) || '' : ''));
            }
        }

        function measure(scopes) {
            const settings = ctx.settings;
            const sample = settings.messageFontSize !== 100 || settings.messageCompactness !== 0 ||
                settings.messageSpacingCustom;
            const fullWidth = settings.userFullWidth && ctx.width.active;
            if (!readingScope || (!sample && !fullWidth)) return;
            const { nodes: pending, bubbles } = collectReadingNodes(scopes);
            if (fullWidth) markFullPaths(bubbles);
            if (!sample || !pending.length) return;
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
                const user = !ASSISTANT_ROOT || !node.closest(ASSISTANT_ROOT);
                if ((user || node.matches(FONT_TARGET)) && font > 0) {
                    node.style.setProperty('--wgx-font', `${font}px`);
                    node.setAttribute('data-wgx-font', '');
                }
                if (line > 0 && (user || node.matches(`${PROSE_LINE}, ${FIXED_LINE}`))) {
                    const prose = user || node.matches(PROSE_LINE);
                    node.style.setProperty('--wgx-line', `${line}px`);
                    if (prose) node.style.setProperty('--wgx-line-cut', `${line - Math.min(line, Math.max(font * 1.15, line * 0.82))}px`);
                    node.setAttribute('data-wgx-line', prose ? 'prose' : 'fixed');
                }
                if (!user && node.matches(BLOCK_SPACING) && display !== 'inline' && display !== 'contents' &&
                    Number.isFinite(top) && Number.isFinite(bottom)) {
                    node.style.setProperty('--wgx-mt', `${top}px`);
                    node.style.setProperty('--wgx-mb', `${bottom}px`);
                    node.setAttribute('data-wgx-space', node.previousElementSibling ? 'after' : 'first');
                }
                measuredNodes.add(node);
            }
        }

        function clearMarkers() {
            document.querySelectorAll(NODE_MARKERS.map(name => `[${name}]`).join(', ')).forEach(node => {
                NODE_MARKERS.forEach(name => node.removeAttribute(name));
                NODE_PROPERTIES.forEach(name => node.style.removeProperty(name));
            });
            measuredNodes = new WeakSet();
        }

        function start() {
            if (readingObserver || !document.body) return;
            readingObserver = new MutationObserver(function (mutations) {
                if (!ctx.isExtensionContextValid()) {
                    ctx.retire();
                    return;
                }
                if (!ctx.siteActive || !readingScope) return;
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
                if (scopes.length) measure(scopes);
                if (turnsChanged) ctx.queueNavigation();
            });
            readingObserver.observe(document.body, { childList: true, subtree: true });
        }

        function stop() {
            if (readingObserver) readingObserver.disconnect();
            readingObserver = null;
            readingScope = null;
            const root = document.documentElement;
            root.removeAttribute(READING_ATTR);
            root.removeAttribute(FULL_ATTR);
            ROOT_PROPERTIES.forEach(name => root.style.removeProperty(name));
            clearMarkers();
        }

        function apply() {
            const root = document.documentElement;
            if (!root) return;
            if (!ctx.siteActive) {
                stop();
                return;
            }
            start();
            const settings = ctx.settings;
            const scope = ctx.isChatSurface() ? ctx.surface.root : null;
            if (scope !== readingScope) {
                clearMarkers();
                readingScope = scope;
                if (scope) measure([scope]);
            } else if (scope && !root.hasAttribute(READING_ATTR)) {
                measure([scope]);
            }
            const progress = settings.messageCompactness / 100;
            const custom = settings.messageSpacingCustom;
            const tokens = [];
            if (settings.messageFontSize !== 100) tokens.push('font');
            if (custom) tokens.push('custom');
            else if (progress > 0) tokens.push('line', 'space');
            else if (settings.messageFontSize !== 100) tokens.push('line');
            root.style.setProperty('--wgx-font-scale', String(settings.messageFontSize / 100));
            root.style.setProperty('--wgx-density', String(progress));
            root.style.setProperty('--wgx-space-scale', String(1 - 0.875 * progress));
            root.style.setProperty('--wgx-manual-line', String(settings.messageLineHeight));
            root.style.setProperty('--wgx-manual-gap', `${settings.messageParagraphSpacing}px`);
            if (tokens.length) root.setAttribute(READING_ATTR, tokens.join(' '));
            else root.removeAttribute(READING_ATTR);
            if (settings.userFullWidth) root.setAttribute(FULL_ATTR, '');
            else root.removeAttribute(FULL_ATTR);
        }

        function retire() {
            if (readingObserver) readingObserver.disconnect();
            readingObserver = null;
        }

        module.outerBubble = outerBubble;
        module.markFullPaths = markFullPaths;
        module.measure = measure;
        module.apply = apply;
        module.stop = stop;
        module.retire = retire;
        module.hasMessages = () => Boolean(readingScope && MESSAGE_ROOT && readingScope.querySelector(MESSAGE_ROOT));
        module.hasFullPaths = () => Boolean(document.querySelector(`[${PATH_ATTR}]`));
        return module;
    };
})();
