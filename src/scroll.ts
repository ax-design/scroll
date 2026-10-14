// <ax-scroll>: a horizontal scroller that the vertical inputs scroll too, like the Windows 8
// Start screen: a mouse wheel, a touchpad swiped up and down, the up and down keys, Page Up and
// Page Down. Horizontal inputs, touch and the scrollbar stay native. The work is done by
// bindScroll (bind.ts), which does the same for any scroller or for the page.
//
// Attributes:
//   cross-slide   touch drags only pan sideways; up and down go to the content (a tile group
//                 that drags tiles on a vertical swipe). Off by default, so the page keeps
//                 scrolling vertically under a finger.
import { bindScroll } from './bind.js';
import type { ScrollBinding } from './bind.js';

const STYLE = `
:host { display: block; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; }
:host([cross-slide]) { touch-action: pan-x pinch-zoom; }
`;

const template = typeof document !== 'undefined' ? document.createElement('template') : null;
if (template) template.innerHTML = `<style>${STYLE}</style><slot></slot>`;

export class AxScroll extends HTMLElement {
    static readonly ElementName: string = 'ax-scroll';

    private binding: ScrollBinding | null = null;

    constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        root.appendChild(template!.content.cloneNode(true));
    }

    connectedCallback() {
        if (!this.binding) this.binding = bindScroll(this);
    }

    disconnectedCallback() {
        if (this.binding) this.binding.unbind();
        this.binding = null;
    }

    // Moves by `delta` px toward the end (negative: toward the start).
    scrollAlong(delta: number, smooth: boolean): void {
        if (this.binding) this.binding.scrollAlong(delta, smooth);
    }
}
