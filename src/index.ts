// @ax-design/scroll: a horizontal scroller of Axiom Design System that vertical inputs scroll
// too, like the Windows 8 Start screen.
import { AxScroll } from './scroll.js';

export { AxScroll } from './scroll.js';
export { bindScroll } from './bind.js';
export type { BindOptions, ScrollBinding } from './bind.js';
export { GESTURE_GAP, LARGE_STEP, LINE, WheelSwap } from './wheel.js';
export type { WheelContext, WheelDecision, WheelInput } from './wheel.js';

// Defines <ax-scroll>. Safe to call more than once.
export function register(): void {
    if (!customElements.get(AxScroll.ElementName)) customElements.define(AxScroll.ElementName, AxScroll);
}
