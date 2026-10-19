// <ax-scroll>: a horizontal scroller that the vertical inputs scroll too, like the Windows 8
// Start screen: a mouse wheel, a touchpad swiped up and down, the up and down keys, Page Up and
// Page Down. Horizontal inputs, touch and the scrollbar stay native. The work is done by
// bindScroll (bind.ts), which does the same for any scroller or for the page.
//
// Attributes:
//   cross-slide   touch drags only pan sideways; up and down go to the content (a tile group
//                 that drags tiles on a vertical swipe). Off by default, so the page keeps
//                 scrolling vertically under a finger.
//
// Keyboard focus: while nothing inside the scroller can take focus, the host gets tabindex="0",
// so the keys reach it in browsers that do not focus scrollers on their own (WCAG 2.1.1).
import { bindScroll } from './bind.js';
import type { ScrollBinding } from './bind.js';

const STYLE = `
:host { display: block; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; }
:host([cross-slide]) { touch-action: pan-x pinch-zoom; }
`;

// What makes content focusable without a tabindex.
const NATIVE = 'a[href], button, input, select, textarea, summary, iframe, audio[controls], video[controls]';
// Elements that need a tabindex or contenteditable to take focus, checked one by one below.
const CANDIDATES = `${NATIVE}, [tabindex], [contenteditable]`;
// The attributes that can change what takes focus.
const FOCUS_ATTRIBUTES = ['tabindex', 'href', 'disabled', 'contenteditable', 'controls', 'type'];

// Whether one light DOM element can take focus.
function takesFocus(el: Element): boolean {
    const tab = el.getAttribute('tabindex');
    const index = tab === null ? NaN : parseInt(tab, 10);
    // -1 is out of the Tab order, so it does not count, not even for a link.
    if (index < 0) return false;
    // A disabled control cannot take focus, and a hidden input is not in the page at all.
    if (el.matches(':disabled') || el.matches('input[type="hidden"]')) return false;
    // An explicit tabindex, a native control, or editable content.
    return !isNaN(index) || el.matches(NATIVE) || (el instanceof HTMLElement && el.isContentEditable);
}

function hasFocusableContent(host: Element): boolean {
    const list = host.querySelectorAll(CANDIDATES);
    for (let i = 0; i < list.length; i++) if (takesFocus(list[i])) return true;
    return false;
}

const template = typeof document !== 'undefined' ? document.createElement('template') : null;
if (template) template.innerHTML = `<style>${STYLE}</style><slot></slot>`;

export class AxScroll extends HTMLElement {
    static readonly ElementName: string = 'ax-scroll';

    private binding: ScrollBinding | null = null;
    private observer: MutationObserver | null = null;
    // The tabindex this component put on the host, null when it has none of its own.
    private wrote: string | null = null;
    // Set once the author has a tabindex the component did not write: it stays theirs.
    private owned = false;

    constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        root.appendChild(template!.content.cloneNode(true));
    }

    connectedCallback() {
        if (!this.binding) this.binding = bindScroll(this);
        // Children and attributes can change what takes focus, so they are watched too.
        if (!this.observer) this.observer = new MutationObserver(() => this.syncFocus());
        this.observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: FOCUS_ATTRIBUTES });
        this.syncFocus();
    }

    disconnectedCallback() {
        if (this.binding) this.binding.unbind();
        this.binding = null;
        if (this.observer) this.observer.disconnect();
        // Only the tabindex this component wrote goes; the author's stays.
        if (this.wrote !== null && this.getAttribute('tabindex') === this.wrote) this.removeAttribute('tabindex');
        this.wrote = null;
    }

    // Moves by `delta` px toward the end (negative: toward the start).
    scrollAlong(delta: number, smooth: boolean): void {
        if (this.binding) this.binding.scrollAlong(delta, smooth);
    }

    private syncFocus(): void {
        if (this.owned) return;
        // A tabindex that differs from the one written was set or removed by the author.
        if (this.getAttribute('tabindex') !== this.wrote) {
            this.owned = true;
            this.wrote = null;
            return;
        }
        const wanted = hasFocusableContent(this) ? null : '0';
        if (wanted === this.wrote) return;
        if (wanted === null) this.removeAttribute('tabindex');
        else this.setAttribute('tabindex', wanted);
        this.wrote = wanted;
    }
}
