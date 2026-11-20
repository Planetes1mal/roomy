(function () {
    'use strict';

    const selectors = {
        grid: '[role="main"][data-artifact-opened]',
        turn: '[data-scope-id][data-mlbl]',
        answer: '.pWvJNd .mZJni',
        composer: '.t0ITR:has(textarea)',
        dock: '.y4VEUd',
        sources: '.oRipZb',
        shell: '.e9EfHf',
        tabs: '.DZ13He.YNk70c > .P3mIxe',
        question: '.ilZyRc[data-rfsp]',
        sidebar: '[role="navigation"][data-xid="BVEPif"], .qEn1od'
    };

    const STATE = 'data-wg-aim-motion';
    const GRID = 'data-wg-aim-grid';
    const READY = 'data-wg-aim-ready';
    const PROPERTIES = ['--wg-aim-native', '--wg-aim-source-space', '--wg-aim-available',
        '--wg-aim-requested', '--wg-aim-native-bias', '--wg-aim-sidebar-inset'];
    let host = null;
    let grid = null;
    let frame = null;
    let sidebarFrame = null;
    let sidebars = [];
    let sidebarObserver = null;
    let wasPainted = false;
    let version = 0;
    let previewPort = null;
    let previewWidth = null;

    function clearMotion() {
        ++version;
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        if (sidebarFrame !== null) cancelAnimationFrame(sidebarFrame);
        sidebarFrame = null;
        sidebarObserver?.disconnect();
        sidebars = [];
        if (!host) return;
        host.removeAttribute(STATE);
        host.removeAttribute(READY);
        grid.removeAttribute(GRID);
        PROPERTIES.forEach(property => host.style.removeProperty(property));
    }

    function resetSurface() {
        clearMotion();
        host = grid = null;
        wasPainted = false;
    }

    function setLength(name, value) {
        if (host.style.getPropertyValue(name) !== value) host.style.setProperty(name, value);
    }

    function watchSidebar() {
        // Keep the two real Google controls across streaming mutations in the same conversation.
        if (sidebars.length < 2 || sidebars.some(el => !grid.contains(el))) {
            const panels = [...grid.querySelectorAll(selectors.sidebar)];
            if (panels.length !== sidebars.length || panels.some((el, i) => el !== sidebars[i])) {
                if (!sidebarObserver) sidebarObserver = new MutationObserver(measureSidebar);
                sidebarObserver.disconnect();
                sidebars = panels;
                for (const panel of sidebars) {
                    sidebarObserver.observe(panel, { attributes: true, attributeFilter: ['aria-hidden', 'class'] });
                }
            }
        }
        measureSidebar();
    }

    function measureSidebar() {
        const left = grid.getBoundingClientRect().left;
        let right = left;
        let moving = false;
        // Google's body reserves a different width from the fixed panel and its collapsed rail.
        for (const panel of sidebars) {
            const style = getComputedStyle(panel);
            if (style.visibility === 'visible' && (Number(style.opacity) > 0 || style.pointerEvents !== 'none')) {
                right = Math.max(right, panel.getBoundingClientRect().right);
            }
            if (panel.getAnimations().some(a => a.transitionProperty === 'transform' && a.playState === 'running')) {
                moving = true;
            }
        }
        setLength('--wg-aim-available', grid.clientWidth + 'px');
        setLength('--wg-aim-sidebar-inset', (right - left) + 'px');
        if (moving && sidebarFrame === null) {
            sidebarFrame = requestAnimationFrame(() => {
                sidebarFrame = null;
                measureSidebar();
            });
        }
    }

    function nativeBias(element) {
        const tracks = getComputedStyle(element).gridTemplateColumns.split(' ');
        if (tracks.length !== 22) return;
        // Google's native edge tracks can be asymmetric when the sidebar is open.
        const shift = (parseFloat(tracks[0]) - parseFloat(tracks[21])) / 2;
        if (Number.isFinite(shift)) setLength('--wg-aim-native-bias', shift + 'px');
    }

    function finishReturn(returning) {
        if (returning !== version) return;
        const transitions = host.getAnimations().filter(a => a.playState !== 'finished' &&
            (a.transitionProperty === '--wg-aim-answer' || a.transitionProperty === '--wg-aim-bias'));
        if (transitions.length) {
            Promise.allSettled(transitions.map(a => a.finished)).then(() => finishReturn(returning));
        } else clearMotion();
    }

    function syncMotion(ctx) {
        const next = ctx.surface.widthOwners[0]?.element || null;
        const shell = next && (next.closest(selectors.shell) || next);
        if (next !== grid || shell !== host) {
            resetSurface();
            grid = next || null;
            host = shell || null;
        }
        if (!host) return;
        const state = host.getAttribute(STATE);
        if (ctx.width.active || state) watchSidebar();
        if (!ctx.width.active) {
            if (!state) return;
            if (!wasPainted) {
                clearMotion();
                return;
            }
            // The outer search grid still has Google's native tracks after sidebar resizes.
            const outer = grid.parentElement.closest('.YNk70c');
            if (outer) nativeBias(outer);
            if (state === 'wide') {
                host.setAttribute(STATE, 'returning');
                finishReturn(++version);
            }
            return;
        }

        const style = getComputedStyle(grid);
        setLength('--wg-aim-native', style.getPropertyValue('--center-width').trim() || '652px');
        setLength('--wg-aim-source-space', 'calc(' + style.getPropertyValue('--rhs-width').trim() +
            ' + ' + style.getPropertyValue('--rhs-margin').trim() + ')');
        setLength('--wg-aim-requested', ctx.settingsUtils.getWidthCssValue(previewWidth || ctx.settings.chatWidthSetting));
        if (state === 'wide') return;
        ++version;
        if (!state) {
            nativeBias(grid);
            grid.setAttribute(GRID, '');
            if (wasPainted) {
                host.setAttribute(STATE, 'returning');
                // Establish both the native width and its asymmetric gutters before animating.
                getComputedStyle(host).getPropertyValue('--wg-aim-answer');
                host.setAttribute(READY, '');
            }
        }
        host.setAttribute(STATE, 'wide');
        if (!wasPainted) {
            frame = requestAnimationFrame(() => {
                frame = requestAnimationFrame(() => {
                    frame = null;
                    wasPainted = true;
                    host.setAttribute(READY, '');
                });
            });
        }
    }

    function connectPreview(port) {
        if (port.name !== 'roomy-google-width-preview' || ctx.retired) return;
        previewPort?.disconnect();
        previewPort = port;
        previewWidth = null;
        port.onMessage.addListener(setting => {
            if (port !== previewPort || !ctx.width.active || !host || !Number.isFinite(setting?.value)) return;
            previewWidth = ctx.settingsUtils.normalizeWidthSetting(setting, ctx.settings);
            setLength('--wg-aim-requested', ctx.settingsUtils.getWidthCssValue(previewWidth));
        });
        port.onDisconnect.addListener(() => {
            if (port !== previewPort) return;
            previewPort = null;
            previewWidth = null;
            if (host && ctx.width.active && !ctx.retired) {
                setLength('--wg-aim-requested', ctx.settingsUtils.getWidthCssValue(ctx.settings.chatWidthSetting));
            }
        });
    }

    const ctx = window.widerRoomyCore.defineSite({
        id: 'googleaimode',
        selectors,
        discover(ctx) {
            // A streaming page can paint the question before it mounts the fixed composer.
            // Conversely, an empty conversation grid can have zero height and a visible dock.
            const composer = ctx.findVisible(selectors.grid + ' > ' + selectors.dock + ' ' + selectors.composer);
            const dock = composer?.closest(selectors.dock);
            const content = selectors.question + ' .xEFZqe, ' + selectors.turn + ' ' + selectors.answer;
            const grid = dock?.parentElement || ctx.findVisible(selectors.grid, document, node => node.querySelector(content));
            if (!grid) return { kind: 'notApplicable' };
            const turn = grid.querySelector(selectors.turn);
            if (turn && !grid.querySelector(content)) return { kind: 'unknown' };
            const surface = { kind: turn ? 'chat' : 'home', root: grid, column: grid, pane: grid, footer: dock };
            const style = getComputedStyle(grid);
            // Leave Google's alternate panel and compact layouts under its own control.
            if (grid.getAttribute('data-artifact-opened') !== 'false' ||
                style.columnGap !== '20px' || !style.getPropertyValue('--rhs-width').trim() ||
                !style.getPropertyValue('--rhs-margin').trim() || style.gridTemplateColumns.split(' ').length !== 22 ||
                (composer && getComputedStyle(composer).gridColumnEnd !== 'span 12')) {
                return { ...surface, nativeWidth: true };
            }
            return { ...surface, widthOwners: [{ element: grid, strategy: 'googleGrid' }] };
        },
        watch: {
            beforePaint: true,
            markers: [selectors.grid, selectors.turn, '.mZJni', '.t0ITR', selectors.dock,
                'textarea', selectors.question, '.xEFZqe', selectors.tabs, selectors.sidebar].join(', '),
            attributes: ['data-artifact-opened', 'data-mlbl']
        },
        hooks: {
            afterSync: syncMotion,
            retire() {
                resetSurface();
                chrome.runtime.onConnect?.removeListener(connectPreview);
                previewPort?.disconnect();
                previewPort = null;
                previewWidth = null;
            }
        }
    });
    if (ctx && !ctx.retired) chrome.runtime.onConnect?.addListener(connectPreview);
})();
