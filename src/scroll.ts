// <ax-scroll>: a horizontal scroller that the vertical inputs scroll too, like the Windows 8
// Start screen: a mouse wheel, a touchpad swiped up and down, the up and down keys, Page Up and
// Page Down. Horizontal inputs, touch and the scrollbar stay native. See wheel.ts for how wheel
// events are told apart.
//
// Attributes:
//   cross-slide   touch drags only pan sideways; up and down go to the content (a tile group
//                 that drags tiles on a vertical swipe). Off by default, so the page keeps
//                 scrolling vertically under a finger.
import { WheelSwap } from './wheel.js';

const STYLE = `
:host { display: block; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; }
:host([cross-slide]) { touch-action: pan-x pinch-zoom; }
`;

// Up and down keys move this many px; Page Up and Page Down this part of the width.
const KEY_STEP = 40;
const PAGE_PART = 0.875;
// A smooth scroll that reports no end (no scrollend event) is taken as over after this.
const SMOOTH_TIMEOUT = 800;

const template = typeof document !== 'undefined' ? document.createElement('template') : null;
if (template) template.innerHTML = `<style>${STYLE}</style><slot></slot>`;

const EDITABLE = /^(INPUT|TEXTAREA|SELECT)$/;

export class AxScroll extends HTMLElement {
    static readonly ElementName: string = 'ax-scroll';

    private swap = new WheelSwap();
    // Where a smooth scroll that is still running goes: the next wheel step adds to it, so a
    // fast spin does not lose the part of a step that was not scrolled yet.
    private target: number | null = null;
    private targetTimer = 0;

    constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        root.appendChild(template!.content.cloneNode(true));
    }

    connectedCallback() {
        // Not passive: the converted events must not also scroll the page.
        this.addEventListener('wheel', this.onWheel, { passive: false } as AddEventListenerOptions);
        this.addEventListener('keydown', this.onKeyDown);
        this.addEventListener('scrollend', this.onScrollEnd);
        // Any other way of scrolling ends ours.
        this.addEventListener('pointerdown', this.onOtherInput);
        this.addEventListener('touchstart', this.onOtherInput, { passive: true } as AddEventListenerOptions);
    }

    disconnectedCallback() {
        this.removeEventListener('wheel', this.onWheel);
        this.removeEventListener('keydown', this.onKeyDown);
        this.removeEventListener('scrollend', this.onScrollEnd);
        this.removeEventListener('pointerdown', this.onOtherInput);
        this.removeEventListener('touchstart', this.onOtherInput);
        this.endSmooth();
    }

    // +1 when scrolling toward the end raises scrollLeft, -1 in right-to-left layouts, where
    // scrollLeft runs from 0 down to minus the scroll width.
    private get sign(): number {
        return getComputedStyle(this).direction === 'rtl' ? -1 : 1;
    }

    private get max(): number {
        return Math.max(0, this.scrollWidth - this.clientWidth);
    }

    // Distance from the start, 0 to max, whatever the direction.
    private get position(): number {
        return Math.abs(this.scrollLeft);
    }

    private canScroll = (delta: number): boolean => {
        const from = this.target !== null ? this.target : this.position;
        return delta > 0 ? from < this.max - 0.5 : from > 0.5;
    };

    // Moves by `delta` px toward the end (negative: toward the start).
    scrollAlong(delta: number, smooth: boolean): void {
        const max = this.max;
        const clamp = (n: number) => Math.max(0, Math.min(max, n));
        const sign = this.sign;
        if (smooth || this.target !== null) {
            this.target = clamp((this.target !== null ? this.target : this.position) + delta);
            this.scrollTo({ left: sign * this.target, behavior: 'smooth' });
            window.clearTimeout(this.targetTimer);
            this.targetTimer = window.setTimeout(this.endSmooth, SMOOTH_TIMEOUT);
        } else {
            this.scrollLeft = sign * clamp(this.position + delta);
        }
    }

    private endSmooth = () => {
        window.clearTimeout(this.targetTimer);
        this.target = null;
    };

    private onScrollEnd = () => {
        if (this.target !== null && Math.abs(this.position - this.target) < 1) this.endSmooth();
    };

    private onOtherInput = () => {
        this.endSmooth();
        this.swap.reset();
    };

    // Something between the target and this element that scrolls vertically and can still
    // move by deltaY takes the event.
    private nestedTakes(event: Event, deltaY: number): boolean {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        for (const node of path) {
            if (node === this) break;
            if (!(node instanceof HTMLElement)) continue;
            if (EDITABLE.test(node.tagName) || node.tagName === 'IFRAME') return true;
            if (node.scrollHeight <= node.clientHeight) continue;
            const overflow = getComputedStyle(node).overflowY;
            if (overflow !== 'auto' && overflow !== 'scroll' && overflow !== 'overlay') continue;
            if (deltaY > 0 ? node.scrollTop < node.scrollHeight - node.clientHeight - 0.5 : node.scrollTop > 0.5) return true;
        }
        return false;
    }

    private onWheel = (event: WheelEvent) => {
        if (event.defaultPrevented) return;
        const decision = this.swap.decide(event, {
            page: this.clientWidth * PAGE_PART,
            canScroll: this.canScroll,
            nestedTakes: (dy) => this.nestedTakes(event, dy),
        });
        if (decision.action !== 'scroll') return;
        event.preventDefault();
        this.scrollAlong(decision.delta, decision.smooth);
    };

    private onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.composedPath()[0] as HTMLElement | undefined;
        if (target && (EDITABLE.test(target.tagName) || target.isContentEditable)) return;
        let delta = 0;
        if (event.key === 'ArrowDown') delta = KEY_STEP;
        else if (event.key === 'ArrowUp') delta = -KEY_STEP;
        else if (event.key === 'PageDown') delta = this.clientWidth * PAGE_PART;
        else if (event.key === 'PageUp') delta = -this.clientWidth * PAGE_PART;
        if (!delta || !this.canScroll(delta)) return;
        event.preventDefault();
        this.scrollAlong(delta, true);
    };
}
