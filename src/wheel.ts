// What to do with a wheel event in a horizontal scroller. No DOM.
//
// No input tells a touchpad from a mouse wheel reliably: on Windows, Chromium reports both the
// same way, and the wheelDelta ratios people test for only hold on macOS. So every event is
// handled by what it looks like, in a way that is right for either device:
//
//  - Gestures: events less than GESTURE_GAP ms apart belong together. The first event decides
//    for the whole gesture. Mostly horizontal (a touchpad swiped sideways): the browser scrolls
//    it, and the vertical jitter of that swipe too. Mostly vertical: the vertical part becomes
//    horizontal scrolling, and the sideways jitter is dropped.
//  - Large steps (lines, pages, or LARGE_STEP px and more, which is what wheels send: Chromium
//    sends 100 px a notch) scroll smoothly, with the browser's own smooth scrolling.
//  - Small steps (touchpads, high resolution wheels) scroll 1:1 at once: those devices already
//    move smoothly and carry their own momentum.
//  - Edges: when the scroller cannot move in the direction a gesture starts with, the gesture
//    goes to the page, as scroll chaining does. A gesture that reaches the edge on the way
//    stays here, so the page does not jump in the middle of it.
//  - Shift + wheel is already horizontal, and ctrl + wheel zooms: both go to the browser.

export const GESTURE_GAP = 120;
export const LARGE_STEP = 50;
// Chromium turns a wheel notch of three lines into 100 px.
export const LINE = 100 / 3;

export interface WheelInput {
    deltaX: number;
    deltaY: number;
    // 0 pixels, 1 lines, 2 pages (WheelEvent.DOM_DELTA_*).
    deltaMode: number;
    timeStamp: number;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
}

export type WheelDecision = { action: 'native' } | { action: 'scroll'; delta: number; smooth: boolean };

export interface WheelContext {
    // Size of a page in px, for deltaMode 2.
    page: number;
    // Whether the scroller can move by `delta` px along its axis (positive: toward the end).
    canScroll(delta: number): boolean;
    // Whether something inside the target that scrolls vertically takes this vertical delta.
    nestedTakes?(deltaY: number): boolean;
}

const NATIVE: WheelDecision = { action: 'native' };

export class WheelSwap {
    private last = -Infinity;
    private mode: 'native' | 'convert' = 'native';

    decide(input: WheelInput, context: WheelContext): WheelDecision {
        if (input.ctrlKey || input.metaKey || input.shiftKey) {
            // Ends the gesture: what follows decides again.
            this.last = -Infinity;
            return NATIVE;
        }
        const unit = input.deltaMode === 1 ? LINE : input.deltaMode === 2 ? context.page : 1;
        const dx = input.deltaX * unit;
        const dy = input.deltaY * unit;
        if (dx === 0 && dy === 0) return NATIVE;
        const gap = input.timeStamp - this.last;
        this.last = input.timeStamp;
        if (!(gap >= 0 && gap <= GESTURE_GAP)) {
            if (Math.abs(dx) >= Math.abs(dy)) this.mode = 'native';
            else if (context.nestedTakes && context.nestedTakes(dy)) this.mode = 'native';
            else this.mode = context.canScroll(dy) ? 'convert' : 'native';
        }
        if (this.mode === 'native' || dy === 0) return NATIVE;
        return { action: 'scroll', delta: dy, smooth: input.deltaMode !== 0 || Math.abs(dy) >= LARGE_STEP };
    }

    // Forget the gesture, for example after the user scrolled another way.
    reset(): void {
        this.last = -Infinity;
    }
}
