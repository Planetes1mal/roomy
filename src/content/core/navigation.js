(function () {
    'use strict';

    const core = window.widerRoomyCore = window.widerRoomyCore || { modules: {} };
    if (core.modules.navigation) return;

    core.modules.navigation = function (ctx) {
        const site = ctx.site;
        let navigation = null;
        let navigationTimer = null;
        const module = { get rail() { return navigation; } };

        function railWidth() {
            return window.widerMessageNavigation.RAIL_WIDTH;
        }

        function turns() {
            const surface = ctx.surface;
            if (!surface.column) return [];
            if (site.turns) return site.turns(surface, ctx).filter(turn => turn && turn.element);
            const reading = ctx.reading;
            if (!reading.USER_BUBBLE) return [];
            const elements = [...new Set([...surface.column.querySelectorAll(reading.USER_BUBBLE)].map(reading.outerBubble))];
            return elements.filter(element => element && !ctx.isExcluded(element)).map(element => {
                const textNode = site.turnText ? element.querySelector(site.turnText) : null;
                const text = (textNode || element).textContent.replace(/\s+/g, ' ').trim();
                const key = site.turnKey ? site.turnKey(element, ctx) : null;
                return key ? { element, text, key } : { element, text };
            });
        }

        function bounds() {
            const surface = ctx.surface;
            const rect = surface.scroll.getBoundingClientRect();
            const left = rect.left + surface.scroll.clientLeft;
            const footerTop = surface.footer ? surface.footer.getBoundingClientRect().top : rect.bottom;
            const top = rect.top + surface.scroll.clientTop + ctx.resolve(site.navigation.topInset, surface, ctx);
            return {
                left, right: left + surface.scroll.clientWidth, top,
                bottom: Math.min(rect.bottom, footerTop) - ctx.resolve(site.navigation.bottomInset, surface, ctx)
            };
        }

        function neededGutter() {
            const column = ctx.surface.column;
            const pane = ctx.surface.pane || (column && column.parentElement);
            if (!column || !pane) return 0;
            const available = pane.clientWidth;
            const padding = parseFloat(getComputedStyle(column).paddingRight) || 0;
            const setting = ctx.settings.chatWidthSetting;
            const requested = setting.unit === 'percent' ? innerWidth * setting.value / 100 : setting.value;
            const side = (available - Math.min(requested, available - padding * 2)) / 2;
            return side >= railWidth() ? 0 : Math.max(0, Math.ceil(railWidth() - padding) + 1);
        }

        function wanted() {
            return ctx.siteActive && ctx.settings.navigationEnabled && Boolean(window.widerMessageNavigation) &&
                ctx.isChatSurface() && Boolean(ctx.surface.scroll);
        }

        function contentRight() {
            const column = ctx.surface.column;
            const roots = ctx.reading.MESSAGE_ROOT ? [...column.querySelectorAll(ctx.reading.MESSAGE_ROOT)].slice(-40) : [];
            if (roots.length) return Math.max(...roots.map(node => node.getBoundingClientRect().right));
            return column.getBoundingClientRect().right - (parseFloat(getComputedStyle(column).paddingRight) || 0);
        }

        function sync() {
            navigationTimer = null;
            if (ctx.retired) return;
            if (!wanted()) {
                if (navigation) navigation.destroy();
                navigation = null;
                return;
            }
            const current = turns();
            const paneBounds = bounds();
            const fits = paneBounds.right - contentRight() >= railWidth() - 1;
            if (!navigation) {
                navigation = window.widerMessageNavigation.create({
                    labels: {
                        rail: chrome.i18n.getMessage('navigationLabel') || 'Message navigation',
                        message: (n, total) => (chrome.i18n.getMessage('navigationMessage') || 'Message {n} of {total}')
                            .replace('{n}', n).replace('{total}', total),
                        attachment: chrome.i18n.getMessage('navigationAttachment') || 'Attachment',
                        older: chrome.i18n.getMessage('navigationEarlier') || 'Earlier messages'
                    },
                    topInset: () => ctx.resolve(site.navigation.scrollInset, ctx.surface, ctx),
                    onStale: queue
                });
            }
            const container = ctx.surface.navigationContainer || null;
            navigation.update(fits ? { turns: current, scrollRoot: ctx.surface.scroll, bounds: paneBounds, container } : null);
        }

        function queue() {
            if (!ctx.retired && navigationTimer === null) navigationTimer = setTimeout(sync, 0);
        }

        function retire() {
            clearTimeout(navigationTimer);
            navigationTimer = null;
            if (navigation) navigation.destroy();
            navigation = null;
        }

        module.turns = turns;
        module.bounds = bounds;
        module.neededGutter = neededGutter;
        module.wanted = wanted;
        module.contentRight = contentRight;
        module.sync = sync;
        module.queue = queue;
        module.retire = retire;
        return module;
    };
})();
