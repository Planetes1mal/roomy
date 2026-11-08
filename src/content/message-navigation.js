(function () {
    'use strict';

    if (window.widerMessageNavigation) return;

    const RAIL_WIDTH = 24;
    const MAX_PITCH = 24;
    const MAGNIFY_RADIUS = 72;
    const OLDER_SIZE = 24;
    const OLDER_SETTLE_MS = 1500;
    const MIN_TURNS = 2;
    const MAX_VISIBLE = 20;
    const RELOCATE_MS = 250;
    const RELOCATE_TRIES = 4;
    const SETTLE_MS = 5000;
    const SETTLE_FALLBACK_MS = 1000;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function schedule(callback) {
        let done = false;
        let frame = 0;
        let timer = 0;
        const run = () => {
            if (done) return;
            done = true;
            cancelAnimationFrame(frame);
            clearTimeout(timer);
            callback();
        };
        frame = requestAnimationFrame(run);
        timer = setTimeout(run, 120);
        return () => {
            done = true;
            cancelAnimationFrame(frame);
            clearTimeout(timer);
        };
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function create(options) {
        const labels = options.labels;
        const rail = document.createElement('nav');
        rail.className = 'wg-nav';
        rail.setAttribute('aria-label', labels.rail);
        rail.hidden = true;
        const older = document.createElement('button');
        older.type = 'button';
        older.className = 'wg-nav-older';
        older.setAttribute('aria-label', labels.older);
        older.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
        older.hidden = true;
        const list = document.createElement('div');
        list.className = 'wg-nav-list';
        rail.append(older, list);
        const preview = document.createElement('div');
        preview.className = 'wg-nav-preview';
        preview.id = `wg-nav-preview-${Math.random().toString(36).slice(2)}`;
        preview.setAttribute('role', 'tooltip');
        preview.hidden = true;
        const previewText = document.createElement('span');
        previewText.className = 'wg-nav-preview-text';
        preview.append(previewText);

        let pool = [];
        let turns = [];
        let start = 0;
        let measured = null;
        let pending = null;
        let settle = null;
        let path = location.pathname;
        let scrollRoot = null;
        let bounds = null;
        let railTop = 0;
        let pitch = MAX_PITCH;
        let activeIndex = -1;
        let focusIndex = 0;
        let hoverIndex = -1;
        let pointerY = null;
        let cancelActive = null;
        let olderExhausted = false;
        let olderTimer = null;
        let destroyed = false;

        function topInset() {
            return scrollRoot && options.topInset ? options.topInset(scrollRoot) : 16;
        }

        function textOf(turn) {
            return turn.text ? turn.text : labels.attachment;
        }

        function magnifyCenter() {
            if (pointerY !== null) return pointerY;
            if (rail.contains(document.activeElement) && turns[focusIndex]) return MAX_PITCH / 2 + pitch * focusIndex;
            return null;
        }

        function tickPositions() {
            const n = turns.length;
            const base = turns.map((turn, i) => MAX_PITCH / 2 + pitch * i);
            const center = magnifyCenter();
            if (center === null || pitch >= MAX_PITCH || n < 2) return base;
            const reach = MAGNIFY_RADIUS / MAX_PITCH;
            const index = (center - MAX_PITCH / 2) / pitch;
            const weights = [];
            for (let i = 0; i < n - 1; i++) weights.push(Math.max(0, 1 - Math.abs(i + 0.5 - index) / reach));
            const total = weights.reduce((sum, w) => sum + w, 0);
            const span = pitch * (n - 1);
            if (n - 1 - total < 0.5) return base;
            const spread = Math.min(MAX_PITCH, span / 2 / Math.max(total, 1e-6));
            const rest = (span - spread * total) / (n - 1 - total);
            const positions = [base[0]];
            for (let i = 0; i < n - 1; i++) positions.push(positions[i] + rest + (spread - rest) * weights[i]);
            return positions;
        }

        function layout() {
            if (!bounds || !turns.length) return;
            const olderShown = !older.hidden;
            const available = Math.max(0, bounds.bottom - bounds.top - (olderShown ? OLDER_SIZE : 0));
            const n = turns.length;
            pitch = n * MAX_PITCH <= available ? MAX_PITCH : Math.max(0, (available - MAX_PITCH) / Math.max(n - 1, 1));
            const height = pitch * (n - 1) + MAX_PITCH;
            const total = height + (olderShown ? OLDER_SIZE : 0);
            railTop = bounds.top + Math.max(0, (bounds.bottom - bounds.top - total) / 2);
            rail.style.left = `${bounds.right - RAIL_WIDTH}px`;
            rail.style.top = `${railTop}px`;
            rail.style.height = `${total}px`;
            list.style.height = `${height}px`;
            rail.classList.toggle('wg-nav--dense', pitch < MAX_PITCH);
            tickPositions().forEach((y, i) => {
                turns[i].button.style.top = `${y - MAX_PITCH / 2}px`;
                turns[i].y = y;
            });
        }

        function measure() {
            const rootRect = scrollRoot.getBoundingClientRect();
            const shifts = [];
            pool.forEach(entry => {
                if (!entry.element || !entry.element.isConnected) return;
                const offset = entry.element.getBoundingClientRect().top - rootRect.top + scrollRoot.scrollTop;
                if (entry.offset !== null) shifts.push(offset - entry.offset);
                entry.offset = offset;
            });
            if (shifts.length) {
                shifts.sort((a, b) => a - b);
                const shift = shifts[shifts.length >> 1];
                if (shift) pool.forEach(entry => { if (!entry.element && entry.offset !== null) entry.offset += shift; });
            }
            measured = { height: scrollRoot.scrollHeight, width: scrollRoot.clientWidth };
        }

        function ensureMeasured() {
            if (!measured || measured.height !== scrollRoot.scrollHeight || measured.width !== scrollRoot.clientWidth ||
                pool.some(entry => entry.offset === null)) measure();
        }

        function merge(mounted) {
            const previous = new Map(pool.map(entry => [entry.id, entry]));
            const current = mounted.map(turn => {
                const id = turn.key || turn.element;
                const entry = previous.get(id) || { id, key: turn.key || null, offset: null, y: 0, button: null };
                entry.element = turn.element;
                entry.text = turn.text;
                return entry;
            });
            const ids = new Set(current.map(entry => entry.id));
            const remembered = pool.filter(entry => entry.key && !ids.has(entry.id) && entry.offset !== null);
            remembered.forEach(entry => { entry.element = null; });
            pool = current.concat(remembered);
            if (!current.length) {
                pool = [];
                return;
            }
            measure();
            const first = current[0].offset;
            const last = current[current.length - 1].offset;
            const sorted = remembered.sort((a, b) => a.offset - b.offset);
            pool = sorted.filter(entry => entry.offset < first).concat(current, sorted.filter(entry => entry.offset > last));
        }

        function forget() {
            pool = [];
            start = 0;
            measured = null;
            pending = null;
            clearSettle();
        }

        function selectWindow(index) {
            const activeEntry = pool[index];
            while (pool.length > MAX_VISIBLE) {
                let far = -1;
                pool.forEach((entry, i) => {
                    if (!entry.element && entry !== pending?.entry &&
                        (far < 0 || Math.abs(i - index) > Math.abs(far - index))) far = i;
                });
                if (far < 0) break;
                pool.splice(far, 1);
                index = pool.indexOf(activeEntry);
            }
            const size = Math.min(MAX_VISIBLE, pool.length);
            const edge = Math.min(3, size >> 2);
            if (start > pool.length - size || index < start + edge || index >= start + size - edge) {
                start = clamp(index - (size >> 1), 0, pool.length - size);
            }
            render(pool.slice(start, start + size));
            return index;
        }

        function render(visible) {
            const same = visible.length === turns.length && visible.every((entry, i) => entry === turns[i]);
            if (!same) {
                const focused = turns.find(turn => turn.button === document.activeElement);
                const hadFocus = rail.contains(document.activeElement);
                setActive(-1);
                setHover(-1);
                turns = visible;
                turns.forEach(turn => { if (!turn.button) turn.button = makeButton(turn); });
                const keep = new Set(turns.map(turn => turn.button));
                [...list.children].forEach(button => { if (!keep.has(button)) button.remove(); });
                turns.forEach((turn, i) => {
                    if (list.children[i] !== turn.button) list.insertBefore(turn.button, list.children[i] || null);
                });
                focusIndex = focused && turns.includes(focused) ? turns.indexOf(focused) : clamp(focusIndex, 0, turns.length - 1);
                if (hadFocus && !rail.contains(document.activeElement)) focusTurn(focusIndex);
                layout();
            }
            turns.forEach((turn, i) => {
                turn.button.tabIndex = i === focusIndex ? 0 : -1;
                turn.button.setAttribute('aria-label', `${labels.message(i + 1, turns.length)}: ${textOf(turn).slice(0, 80)}`);
            });
        }

        function setActive(index) {
            if (index === activeIndex) return;
            const previous = turns[activeIndex];
            if (previous) previous.button.removeAttribute('aria-current');
            activeIndex = index;
            if (turns[index]) turns[index].button.setAttribute('aria-current', 'location');
        }

        function updateActive() {
            cancelActive = null;
            if (!scrollRoot || !pool.length) return;
            ensureMeasured();
            const line = scrollRoot.scrollTop + topInset() + 8;
            let low = 0;
            let high = pool.length - 1;
            let index = 0;
            while (low <= high) {
                const mid = (low + high) >> 1;
                if (pool[mid].offset <= line) {
                    index = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }
            if (scrollRoot.scrollTop >= scrollRange()[1] - 1) {
                const lastMounted = pool.findLastIndex(entry => entry.element);
                if (lastMounted >= 0) index = lastMounted;
            }
            index = selectWindow(index);
            setActive(index - start);
            updateOlder();
        }

        function queueActive() {
            if (!cancelActive) cancelActive = schedule(updateActive);
        }

        function scrollRange() {
            const range = scrollRoot.scrollHeight - scrollRoot.clientHeight;
            const reverse = getComputedStyle(scrollRoot).flexDirection === 'column-reverse';
            return reverse ? [-range, 0] : [0, range];
        }

        function atTop() {
            return scrollRoot.scrollTop <= scrollRange()[0] + 1;
        }

        function updateOlder() {
            const shown = options.olderHistory !== false && !olderExhausted && !atTop();
            if (atTop() && !olderExhausted && olderTimer === null) {
                const first = pool[0];
                olderTimer = setTimeout(() => {
                    olderTimer = null;
                    if (scrollRoot && atTop() && pool[0] === first) olderExhausted = true;
                    updateOlder();
                }, OLDER_SETTLE_MS);
            }
            if (older.hidden === !shown) return;
            older.hidden = !shown;
            layout();
        }

        older.addEventListener('click', () => {
            if (!scrollRoot) return;
            clearPending();
            scrollRoot.scrollTo({ top: scrollRange()[0], behavior: reducedMotion.matches ? 'auto' : 'smooth' });
        });

        function scrollToElement(element, behavior) {
            const rootRect = scrollRoot.getBoundingClientRect();
            const delta = element.getBoundingClientRect().top - rootRect.top - topInset();
            const [min, max] = scrollRange();
            scrollRoot.scrollTo({ top: clamp(scrollRoot.scrollTop + delta, min, max), behavior });
        }

        function scrollToTurn(index) {
            const turn = turns[index];
            if (!turn || !scrollRoot) return;
            clearPending();
            if (turn.element && turn.element.isConnected) {
                scrollToElement(turn.element, reducedMotion.matches ? 'auto' : 'smooth');
                settleOn(turn.element);
                setActive(index);
                return;
            }
            if (!turn.key) {
                if (options.onStale) options.onStale();
                return;
            }
            pending = { entry: turn, tries: 0, timer: null };
            relocate();
            setActive(index);
        }

        function clearPending() {
            if (pending) clearTimeout(pending.timer);
            pending = null;
            clearSettle();
        }

        function settleOn(element) {
            clearSettle();
            settle = { element, height: scrollRoot.scrollHeight, moving: true,
                deadline: performance.now() + SETTLE_MS, fallback: setTimeout(onScrollEnd, SETTLE_FALLBACK_MS) };
        }

        function clearSettle() {
            if (settle) clearTimeout(settle.fallback);
            settle = null;
        }

        function onScrollEnd() {
            if (!settle) return;
            clearTimeout(settle.fallback);
            settle.moving = false;
            realign();
        }

        function realign() {
            if (!settle || settle.moving || !scrollRoot) return;
            if (performance.now() > settle.deadline || !settle.element.isConnected) {
                clearSettle();
                return;
            }
            if (scrollRoot.scrollHeight === settle.height) return;
            settle.height = scrollRoot.scrollHeight;
            const delta = settle.element.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top - topInset();
            if (Math.abs(delta) > 2) scrollToElement(settle.element, 'auto');
        }

        function relocate() {
            const [min, max] = scrollRange();
            scrollRoot.scrollTo({ top: clamp(pending.entry.offset - topInset(), min, max), behavior: 'auto' });
            pending.timer = setTimeout(() => {
                if (!pending) return;
                if (options.onStale) options.onStale();
                pending.timer = setTimeout(() => {
                    if (!pending) return;
                    if (++pending.tries >= RELOCATE_TRIES || !pool.includes(pending.entry)) clearPending();
                    else relocate();
                }, RELOCATE_MS);
            }, RELOCATE_MS);
        }

        function resolvePending() {
            if (!pending || !pending.entry.element || !pending.entry.element.isConnected) return;
            const element = pending.entry.element;
            clearPending();
            scrollToElement(element, 'auto');
            settleOn(element);
        }

        function cancelRelocation(event) {
            if ((pending || settle) && !rail.contains(event.target)) clearPending();
        }

        function showPreview(index) {
            const turn = turns[index];
            if (!turn || !bounds) return;
            previewText.textContent = textOf(turn);
            preview.hidden = false;
            turns.forEach(item => item.button.removeAttribute('aria-describedby'));
            turn.button.setAttribute('aria-describedby', preview.id);
            const tickY = railTop + (older.hidden ? 0 : OLDER_SIZE) + turn.y;
            const width = Math.min(280, Math.max(120, bounds.right - bounds.left - RAIL_WIDTH - 24));
            preview.style.maxWidth = `${width}px`;
            const rect = preview.getBoundingClientRect();
            preview.style.left = `${Math.max(bounds.left + 8, bounds.right - RAIL_WIDTH - rect.width - 8)}px`;
            preview.style.top = `${clamp(tickY - rect.height / 2, bounds.top, Math.max(bounds.top, bounds.bottom - rect.height))}px`;
        }

        function hidePreview() {
            preview.hidden = true;
            turns.forEach(turn => turn.button.removeAttribute('aria-describedby'));
        }

        function setHover(index) {
            if (hoverIndex === index) return;
            if (turns[hoverIndex]) turns[hoverIndex].button.classList.remove('wg-nav-hover');
            hoverIndex = index;
            if (turns[index]) turns[index].button.classList.add('wg-nav-hover');
        }

        function nearestTick(clientY) {
            const y = clientY - list.getBoundingClientRect().top;
            let best = -1;
            let distance = Infinity;
            turns.forEach((turn, i) => {
                const d = Math.abs(turn.y - y);
                if (d < distance) {
                    best = i;
                    distance = d;
                }
            });
            return best;
        }

        list.addEventListener('pointermove', event => {
            const y = event.clientY - list.getBoundingClientRect().top;
            pointerY = clamp(y, 0, pitch * (turns.length - 1) + MAX_PITCH);
            layout();
            setHover(nearestTick(event.clientY));
            showPreview(hoverIndex);
        });
        list.addEventListener('pointerleave', () => {
            pointerY = null;
            setHover(-1);
            if (!rail.contains(document.activeElement)) hidePreview();
            layout();
        });
        list.addEventListener('click', event => {
            if (event.detail === 0) return;
            const index = nearestTick(event.clientY);
            if (index >= 0) scrollToTurn(index);
        });

        function focusTurn(index) {
            const next = turns[clamp(index, 0, turns.length - 1)];
            if (!next) return;
            turns.forEach(turn => { turn.button.tabIndex = -1; });
            next.button.tabIndex = 0;
            focusIndex = turns.indexOf(next);
            next.button.focus({ preventScroll: true });
        }

        function makeButton(turn) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'wg-nav-tick';
            button.tabIndex = -1;
            button.append(document.createElement('span'));
            button.addEventListener('click', event => {
                if (event.detail === 0) scrollToTurn(turns.indexOf(turn));
            });
            button.addEventListener('focus', () => {
                focusIndex = turns.indexOf(turn);
                layout();
                showPreview(focusIndex);
            });
            button.addEventListener('blur', event => {
                if (!rail.contains(event.relatedTarget) && pointerY === null) {
                    hidePreview();
                    layout();
                }
            });
            return button;
        }

        list.addEventListener('keydown', event => {
            const keys = { ArrowUp: focusIndex - 1, ArrowDown: focusIndex + 1, Home: 0, End: turns.length - 1 };
            if (event.key === 'Escape') {
                hidePreview();
                return;
            }
            if (!Object.hasOwn(keys, event.key)) return;
            event.preventDefault();
            focusTurn(keys[event.key]);
        });

        function adoptHostStyle() {
            let background = '';
            for (let el = scrollRoot; el; el = el.parentElement) {
                const color = getComputedStyle(el).backgroundColor;
                if (color && color !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(color)) {
                    background = color;
                    break;
                }
            }
            const style = getComputedStyle(scrollRoot);
            for (const target of [rail, preview]) {
                target.style.setProperty('--wg-nav-ink', style.color);
                target.style.setProperty('--wg-nav-surface', background || '#ffffff');
                target.style.setProperty('--wg-nav-font', style.fontFamily);
            }
        }

        const CANCEL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

        function setScrollRoot(next) {
            if (next === scrollRoot) return;
            if (scrollRoot) {
                scrollRoot.removeEventListener('scroll', queueActive);
                scrollRoot.removeEventListener('scrollend', onScrollEnd);
                CANCEL_EVENTS.forEach(type => scrollRoot.removeEventListener(type, cancelRelocation, true));
            }
            scrollRoot = next;
            clearPending();
            forget();
            olderExhausted = false;
            clearTimeout(olderTimer);
            olderTimer = null;
            if (scrollRoot) {
                scrollRoot.addEventListener('scroll', queueActive, { passive: true });
                scrollRoot.addEventListener('scrollend', onScrollEnd, { passive: true });
                CANCEL_EVENTS.forEach(type => scrollRoot.addEventListener(type, cancelRelocation, { capture: true, passive: true }));
            }
        }

        function mount(container) {
            const hosted = container !== document.documentElement;
            if (rail.parentNode !== container || preview.parentNode !== container) container.append(rail, preview);
            rail.classList.toggle('wg-nav--hosted', hosted);
            preview.classList.toggle('wg-nav--hosted', hosted);
        }

        function toContainer(viewportBounds) {
            rail.style.left = '0px';
            rail.style.top = '0px';
            const origin = rail.getBoundingClientRect();
            return {
                left: viewportBounds.left - origin.left, right: viewportBounds.right - origin.left,
                top: viewportBounds.top - origin.top, bottom: viewportBounds.bottom - origin.top
            };
        }

        rail.addEventListener('pointerdown', event => {
            if (rail.classList.contains('wg-nav--hosted')) event.stopPropagation();
        });

        function update(source) {
            if (destroyed) return;
            if (!source || !source.scrollRoot) {
                hide();
                return;
            }
            if (location.pathname !== path) {
                path = location.pathname;
                clearPending();
                forget();
            }
            setScrollRoot(source.scrollRoot);
            const first = pool[0];
            merge(source.turns);
            if (first && pool.indexOf(first) > 0) olderExhausted = false;
            if (pool.length < MIN_TURNS) {
                hide();
                return;
            }
            mount(source.container || document.documentElement);
            adoptHostStyle();
            rail.hidden = false;
            bounds = toContainer(source.bounds);
            layout();
            updateActive();
            resolvePending();
            realign();
        }

        function hide() {
            rail.hidden = true;
            hidePreview();
        }

        function destroy() {
            destroyed = true;
            if (cancelActive) cancelActive();
            clearTimeout(olderTimer);
            setScrollRoot(null);
            rail.remove();
            preview.remove();
            turns = [];
        }

        return {
            update, destroy,
            get visible() { return !rail.hidden; },
            get count() { return rail.hidden ? 0 : turns.length; }
        };
    }

    window.widerMessageNavigation = { create, RAIL_WIDTH, MIN_TURNS };
})();
