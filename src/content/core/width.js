// @ts-check
// 公共内核（宽度）：只在适配器确认的宽度所有者上写标记；两种加宽策略（maxWidth 通用、variable 由适配器 CSS 接管）；
// ResizeObserver 实测可用宽度并封顶；内容右侧不足 24px 时对称留白；暂停时只恢复仍由扩展持有的内联属性。
(function () {
    'use strict';

    const core = window.widerRoomyCore = window.widerRoomyCore || { modules: {} };
    if (core.modules.width) return;

    const ACTIVE_CLASS = 'wider-width-active';
    // 宽度关闭时只为消息导航留白（以原生内容宽度为上限）。
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

        // 所有宽度所有者共用窗格（默认为对话列的父容器）的内容宽度，输入区与消息列始终按同一上限封顶、保持对齐。
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
            // 宽度关闭时先撤下本扩展为导航留白写入的标记与内边距，在同一任务内测量原生布局（不会闪烁）。
            // 宽度规则同时要求所有者标记，撤下标记即可；html 的类留给下面按需切换：布局观察器监听它，
            // 每次先删后加会让每一帧都再排一次同步。
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
            // 宽度关闭但原生布局右侧不足 24px 时，只为导航留白：以原生内容宽度为上限，对称收窄，输入区保持对齐。
            const nativeFree = railWanted ? navigation.bounds().right - navigation.contentRight() : Infinity;
            const gutterOnly = !module.active && railWanted && owners.length > 0 && nativeFree < RAIL - 1;
            const reserve = module.active || gutterOnly;
            if (root.classList.contains(ACTIVE_CLASS) !== module.active) root.classList.toggle(ACTIVE_CLASS, module.active);
            if (root.classList.contains(GUTTER_CLASS) !== gutterOnly) root.classList.toggle(GUTTER_CLASS, gutterOnly);

            // 宽度标记只写在当前界面已验证的所有者上，移走旧界面的标记。
            const marked = reserve ? owners : [];
            unmarkOwners(marked);
            surface.widthOwners.forEach(owner => {
                if (reserve) owner.element.setAttribute(WIDTH_ATTR, owner.strategy);
            });
            markedOwners = marked;

            // 窗格、滚动容器与宿主浮窗始终观察：尺寸变化后重新封顶与布局导航条。
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
                    // maxWidth 策略：按所有者自己的内边距与盒模型换算；原生内边距不动，只替换宽度上限。
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
            // 导航需要的留白：宽度生效时按设定宽度计算；只为导航留白时补足原生缺口。
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

        // 退出时只断开观察；宽度标记与变量留给新实例重新应用。
        function retire() {
            availableWidthObserver.disconnect();
        }

        module.sync = sync;
        module.retire = retire;
        return module;
    };
})();
