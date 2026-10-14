// bindScroll: the vertical-to-horizontal scrolling of <ax-scroll> for any horizontal scroller,
// or for the page itself (bindScroll(window)). See wheel.ts for how wheel events are told apart.
import { nextStep } from './smooth.js';
import { WheelSwap } from './wheel.js';

// Up and down keys move this many px; Page Up and Page Down this part of the width.
const KEY_STEP = 40;
const PAGE_PART = 0.875;
// Keys the browser scrolls on its own: they end a glide of ours.
const NATIVE_KEYS = /^(ArrowLeft|ArrowRight|Home|End)$/;

const EDITABLE = /^(INPUT|TEXTAREA|SELECT)$/;

export interface ScrollBinding {
    // Scrolls by `delta` px toward the end (negative: toward the start). `smooth` glides there and
    // adds up with a glide that is still running.
    scrollAlong(delta: number, smooth: boolean): void;
    // Removes the listeners.
    unbind(): void;
}

export interface BindOptions {
    // The up and down keys, Page Up and Page Down scroll sideways too. Default true.
    keys?: boolean;
}

// `target` is a horizontal scroller (overflow-x: auto or scroll), or window for a page that
// scrolls sideways.
export function bindScroll(target: HTMLElement | Window, options: BindOptions = {}): ScrollBinding {
    const page = typeof Window !== 'undefined' && target instanceof Window;
    // The element whose scrollLeft moves.
    const scroller = (page ? document.scrollingElement || document.documentElement : target) as HTMLElement;
    // Where the events are listened to: anywhere on the page for a page.
    const events: EventTarget = target;
    const swap = new WheelSwap();
    // Where a glide that is still running goes: the next wheel step adds to it, so a fast spin
    // does not lose the part of a step that was not scrolled yet.
    let goal: number | null = null;
    // The frame of the glide that is running, 0 when none is.
    let frame = 0;
    let lastFrame = 0;

    // +1 when scrolling toward the end raises scrollLeft, -1 in right-to-left layouts, where
    // scrollLeft runs from 0 down to minus the scroll width.
    const sign = () => (getComputedStyle(scroller).direction === 'rtl' ? -1 : 1);
    const width = () => (page ? window.innerWidth : scroller.clientWidth);
    const max = () => Math.max(0, scroller.scrollWidth - width());
    // Distance from the start, 0 to max, whatever the direction.
    const position = () => Math.abs(scroller.scrollLeft);

    const canScroll = (delta: number): boolean => {
        const from = goal !== null ? goal : position();
        return delta > 0 ? from < max() - 0.5 : from > 0.5;
    };

    const endSmooth = () => {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        lastFrame = 0;
        goal = null;
    };

    // One frame of the glide toward `goal`, each closing a share of what is left. A wheel step that
    // arrives on the way only moves the target, so the scroller keeps the speed it has;
    // scrollTo({ behavior: 'smooth' }) would instead start over from a standstill on every call,
    // which is what makes a spin stutter in Chromium.
    const glide = (time: number) => {
        frame = 0;
        if (goal === null) return;
        const to = Math.max(0, Math.min(max(), goal));
        const from = position();
        const dt = lastFrame ? Math.min(100, time - lastFrame) : 16.7;
        lastFrame = time;
        const step = nextStep(from, to, dt);
        scroller.scrollLeft = sign() * step.at;
        if (step.done) {
            endSmooth();
            return;
        }
        frame = window.requestAnimationFrame(glide);
    };

    const scrollAlong = (delta: number, smooth: boolean) => {
        const limit = max();
        const clamp = (n: number) => Math.max(0, Math.min(limit, n));
        if (smooth || goal !== null) {
            goal = clamp((goal !== null ? goal : position()) + delta);
            if (!frame) {
                lastFrame = 0;
                frame = window.requestAnimationFrame(glide);
            }
        } else {
            scroller.scrollLeft = sign() * clamp(position() + delta);
        }
    };

    // Something between the target and the scroller that scrolls vertically and can still move
    // by deltaY takes the event.
    const nestedTakes = (event: Event, deltaY: number): boolean => {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        for (const node of path) {
            if (node === scroller || node === document.body) break;
            if (!(node instanceof HTMLElement)) continue;
            if (EDITABLE.test(node.tagName) || node.tagName === 'IFRAME') return true;
            if (node.scrollHeight <= node.clientHeight) continue;
            const overflow = getComputedStyle(node).overflowY;
            if (overflow !== 'auto' && overflow !== 'scroll' && overflow !== 'overlay') continue;
            if (deltaY > 0 ? node.scrollTop < node.scrollHeight - node.clientHeight - 0.5 : node.scrollTop > 0.5) return true;
        }
        return false;
    };

    const onWheel = (event: Event) => {
        const e = event as WheelEvent;
        if (e.defaultPrevented) return;
        const decision = swap.decide(e, { page: width() * PAGE_PART, canScroll, nestedTakes: (dy) => nestedTakes(e, dy) });
        if (decision.action !== 'scroll') {
            // Sideways, a nested scroller or an edge: the browser has this one, and a glide of
            // ours yields to it.
            if (goal !== null) endSmooth();
            return;
        }
        e.preventDefault();
        scrollAlong(decision.delta, decision.smooth);
    };

    const onKeyDown = (event: Event) => {
        const e = event as KeyboardEvent;
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
        const from = e.composedPath()[0] as HTMLElement | undefined;
        if (from && (EDITABLE.test(from.tagName) || from.isContentEditable)) return;
        if (NATIVE_KEYS.test(e.key)) {
            // The browser scrolls this one, and a glide of ours yields to it.
            if (goal !== null) endSmooth();
            return;
        }
        let delta = 0;
        if (e.key === 'ArrowDown') delta = KEY_STEP;
        else if (e.key === 'ArrowUp') delta = -KEY_STEP;
        else if (e.key === 'PageDown') delta = width() * PAGE_PART;
        else if (e.key === 'PageUp') delta = -width() * PAGE_PART;
        if (!delta || !canScroll(delta)) return;
        e.preventDefault();
        scrollAlong(delta, true);
    };

    // Any other way of scrolling ends ours.
    const onOtherInput = () => {
        endSmooth();
        swap.reset();
    };

    const keys = options.keys !== false;
    // Not passive: the converted events must not also scroll the page vertically.
    events.addEventListener('wheel', onWheel, { passive: false } as AddEventListenerOptions);
    if (keys) events.addEventListener('keydown', onKeyDown);
    events.addEventListener('pointerdown', onOtherInput);
    events.addEventListener('touchstart', onOtherInput, { passive: true } as AddEventListenerOptions);

    return {
        scrollAlong,
        unbind() {
            events.removeEventListener('wheel', onWheel);
            if (keys) events.removeEventListener('keydown', onKeyDown);
            events.removeEventListener('pointerdown', onOtherInput);
            events.removeEventListener('touchstart', onOtherInput);
            endSmooth();
        },
    };
}
