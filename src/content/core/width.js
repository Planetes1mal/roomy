(function () {
    'use strict';

    const core = window.widerRoomyCore = window.widerRoomyCore || { modules: {} };
    if (core.modules.width) return;

    const ACTIVE_CLASS = 'wider-width-active';
    const GUTTER_CLASS = 'wider-nav-gutter';
    const WIDTH_ATTR = 'data-wgx-width';
    const OWNER_PROPERTIES = ['--wgx-available', '--wgx-pad', '--wgx-box'];

    core.modules.width = function (ctx) {
        const settingsUtils = ctx.settingsUtils;
        let markedOwners = [];
        let observedTargets = [];
        let ownerRecords = [];
        let rootProperty = null;
        let gutterProperty = null;
        const availableWidthObserver = new ResizeObserver(() => ctx.queueLayout());

        const module = { active: false, columnWidth: 0, ACTIVE_CLASS, GUTTER_CLASS, WIDTH_ATTR };

        function railWidth() {
            return window.widerMessageNavigation ? window.widerMessageNavigation.RAIL_WIDTH : 24;
        }

        function contentWidth(element) {
            const style = getComputedStyle(element);
            return element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
        }

        function paneOf(surface) {
            return surface.pane || (surface.column && surface.column.parentElement) || null;
        }

        function availableWidth(surface) {
            const pane = paneOf(surface);
            return pane ? contentWidth(pane) : null;
        }

        function unmarkOwners(keep) {
            markedOwners.filter(owner => !keep.includes(owner)).forEach(owner => owner.removeAttribute(WIDTH_ATTR));
        }

        function restoreOwnerRecords(records) {
            records.forEach(group => group.forEach(ctx.restoreProperty));
        }

        function sync() {
            const root = document.documentElement;
            const surface = ctx.surface;
            const settings = ctx.settings;
            const navigation = ctx.navigation;
            const RAIL = railWidth();
            const owners = surface.widthOwners.map(owner => owner.element);
            module.active = ctx.siteActive && settings.widthEnabled !== false && owners.length > 0;
            const railWanted = navigation.wanted() && navigation.turns().length >= (window.widerMessageNavigation
                ? window.widerMessageNavigation.MIN_TURNS : 2);
            if (!module.active && markedOwners.length) {
                markedOwners.forEach(owner => owner.removeAttribute(WIDTH_ATTR));
                markedOwners = [];
            }
            module.columnWidth = 0;
            if (surface.column) {
                const style = getComputedStyle(surface.column);
                module.columnWidth = surface.column.getBoundingClientRect().width -
                    parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            }
            const nativeFree = railWanted ? navigation.bounds().right - navigation.contentRight() : Infinity;
            const gutterOnly = !module.active && railWanted && owners.length > 0 && nativeFree < RAIL - 1;
            const reserve = module.active || gutterOnly;
            if (root.classList.contains(ACTIVE_CLASS) !== module.active) root.classList.toggle(ACTIVE_CLASS, module.active);
            if (root.classList.contains(GUTTER_CLASS) !== gutterOnly) root.classList.toggle(GUTTER_CLASS, gutterOnly);

            const marked = reserve ? owners : [];
            unmarkOwners(marked);
            surface.widthOwners.forEach(owner => {
                if (reserve) owner.element.setAttribute(WIDTH_ATTR, owner.strategy);
            });
            markedOwners = marked;

            const parent = reserve ? paneOf(surface) : null;
            const observed = [...new Set([parent, surface.scroll, surface.host].filter(Boolean))];
            if (observed.length !== observedTargets.length || observed.some((el, i) => el !== observedTargets[i])) {
                availableWidthObserver.disconnect();
                observedTargets = observed;
                observed.forEach(el => availableWidthObserver.observe(el));
            }

            if (!reserve) {
                ctx.restoreProperty(rootProperty);
                rootProperty = null;
                restoreOwnerRecords(ownerRecords);
                ownerRecords = [];
            } else {
                rootProperty = ctx.writeProperty(rootProperty, root, '--wgx-width', module.active
                    ? settingsUtils.getWidthCssValue(settings.chatWidthSetting) : `${module.columnWidth}px`);
                const available = availableWidth(surface);
                restoreOwnerRecords(ownerRecords.slice(owners.length));
                ownerRecords = owners.map((owner, i) => {
                    const records = ownerRecords[i] && ownerRecords[i][0] && ownerRecords[i][0].element === owner
                        ? ownerRecords[i] : (restoreOwnerRecords([ownerRecords[i] || []]), []);
                    const style = getComputedStyle(owner);
                    const pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
                    const box = style.boxSizing === 'border-box' ? pad : 0;
                    const values = [available === null ? null : `${available}px`, `${pad}px`, `${box}px`];
                    return OWNER_PROPERTIES.map((property, j) => values[j] === null
                        ? (ctx.restoreProperty(records[j]), null)
                        : ctx.writeProperty(records[j], owner, property, values[j]));
                });
                if (module.active && settings.userFullWidth && surface.column) {
                    ctx.reading.markFullPaths(surface.column.querySelectorAll(ctx.reading.USER_BUBBLE));
                }
            }
            const gutter = !railWanted ? 0 : module.active ? navigation.neededGutter()
                : gutterOnly ? Math.ceil(RAIL - nativeFree) + 1 : 0;
            if (gutter) {
                gutterProperty = ctx.writeProperty(gutterProperty, root, '--wgx-gutter', `${gutter}px`);
            } else {
                ctx.restoreProperty(gutterProperty);
                gutterProperty = null;
            }
            module.nativeFree = nativeFree;
            module.gutterOnly = gutterOnly;
        }

        function retire() {
            availableWidthObserver.disconnect();
        }

        module.sync = sync;
        module.retire = retire;
        return module;
    };
})();
