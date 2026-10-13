import { describe, expect, test } from 'bun:test';
import { GESTURE_GAP, LINE, WheelSwap } from '../src/wheel.js';
import type { WheelContext } from '../src/wheel.js';

const room = (ok = true): WheelContext => ({ page: 800, canScroll: () => ok });
const wheel = (deltaY: number, timeStamp: number, extra: Partial<{ deltaX: number; deltaMode: number; shiftKey: boolean; ctrlKey: boolean }> = {}) => ({
    deltaX: 0,
    deltaMode: 0,
    ...extra,
    deltaY,
    timeStamp,
});

describe('WheelSwap', () => {
    test('a wheel notch scrolls sideways, smoothly', () => {
        expect(new WheelSwap().decide(wheel(100, 0), room())).toEqual({ action: 'scroll', delta: 100, smooth: true });
    });

    test('lines and pages are px', () => {
        const s = new WheelSwap();
        expect(s.decide(wheel(3, 0, { deltaMode: 1 }), room())).toEqual({ action: 'scroll', delta: 3 * LINE, smooth: true });
        expect(new WheelSwap().decide(wheel(-1, 0, { deltaMode: 2 }), room())).toEqual({ action: 'scroll', delta: -800, smooth: true });
    });

    test('small steps scroll 1:1 at once', () => {
        const s = new WheelSwap();
        for (let t = 0; t < 10; t++) expect(s.decide(wheel(4.5, t * 16), room())).toEqual({ action: 'scroll', delta: 4.5, smooth: false });
    });

    test('a sideways swipe stays native, its vertical jitter too', () => {
        const s = new WheelSwap();
        expect(s.decide(wheel(1, 0, { deltaX: 6 }), room())).toEqual({ action: 'native' });
        expect(s.decide(wheel(3, 16), room())).toEqual({ action: 'native' });
        // A new gesture decides again.
        expect(s.decide(wheel(3, 16 + GESTURE_GAP + 1), room())).toEqual({ action: 'scroll', delta: 3, smooth: false });
    });

    test('an up and down swipe drops its sideways jitter', () => {
        const s = new WheelSwap();
        expect(s.decide(wheel(5, 0, { deltaX: 0.5 }), room())).toEqual({ action: 'scroll', delta: 5, smooth: false });
        expect(s.decide(wheel(0, 16, { deltaX: 2 }), room())).toEqual({ action: 'native' });
        expect(s.decide(wheel(6, 32, { deltaX: 1 }), room())).toEqual({ action: 'scroll', delta: 6, smooth: false });
    });

    test('at the edge a gesture goes to the page, and stays there', () => {
        const s = new WheelSwap();
        expect(s.decide(wheel(100, 0), room(false))).toEqual({ action: 'native' });
        expect(s.decide(wheel(100, 50), room(true))).toEqual({ action: 'native' });
    });

    test('a gesture that reaches the edge on the way stays here', () => {
        const s = new WheelSwap();
        expect(s.decide(wheel(4, 0), room(true)).action).toBe('scroll');
        expect(s.decide(wheel(4, 16), room(false)).action).toBe('scroll');
    });

    test('shift, ctrl and meta go to the browser', () => {
        const s = new WheelSwap();
        expect(s.decide(wheel(100, 0, { shiftKey: true }), room())).toEqual({ action: 'native' });
        expect(s.decide(wheel(100, 10, { ctrlKey: true }), room())).toEqual({ action: 'native' });
        expect(s.decide(wheel(100, 20), room()).action).toBe('scroll');
    });

    test('a nested vertical scroller that can move takes the gesture', () => {
        const s = new WheelSwap();
        expect(s.decide(wheel(100, 0), { ...room(), nestedTakes: () => true })).toEqual({ action: 'native' });
    });
});
