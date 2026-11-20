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
        question: '.ilZyRc[data-rfsp]'
    };

    const STATE = 'data-wg-aim-motion';
    const GRID = 'data-wg-aim-grid';
    const READY = 'data-wg-aim-ready';
    const PROPERTIES = ['--wg-aim-native', '--wg-aim-source-space', '--wg-aim-available',
        '--wg-aim-requested', '--wg-aim-native-bias'];
    let host = null;
    let grid = null;
    let frame = null;
    let wasPainted = false;
    let version = 0;

    function clearMotion() {
        ++version;
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
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
        setLength('--wg-aim-available', grid.clientWidth + 'px');
        setLength('--wg-aim-requested', ctx.settingsUtils.getWidthCssValue(ctx.settings.chatWidthSetting));
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

    window.widerRoomyCore.defineSite({
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
                'textarea', selectors.question, '.xEFZqe', selectors.tabs].join(', '),
            attributes: ['data-artifact-opened', 'data-mlbl']
        },
        hooks: { afterSync: syncMotion, retire: resetSurface }
    });
})();
