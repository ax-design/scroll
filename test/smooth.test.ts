import { describe, expect, test } from 'bun:test';
import { ARRIVE, SMOOTH_TAU, arrived, chase, chaseFactor, nextStep } from '../src/smooth.js';

describe('chase', () => {
    test('closes about 63% of what is left in one tau', () => {
        expect(chaseFactor(SMOOTH_TAU)).toBeCloseTo(1 - Math.exp(-1), 6);
        expect(chase(0, 100, SMOOTH_TAU)).toBeCloseTo(63.2, 1);
    });

    test('slows down as it arrives and never passes the target', () => {
        let at = 0;
        let step = Infinity;
        for (let i = 0; i < 40; i++) {
            const next = chase(at, 100, 16.7);
            expect(next).toBeGreaterThanOrEqual(at);
            expect(next).toBeLessThanOrEqual(100);
            expect(next - at).toBeLessThan(step);
            step = next - at;
            at = next;
        }
        expect(arrived(at, 100)).toBe(true);
    });

    test('is the same after the same time at any frame rate', () => {
        const run = (dt: number) => {
            let at = 0;
            for (let t = 0; t < 300; t += dt) at = chase(at, 500, dt);
            return at;
        };
        expect(Math.abs(run(16.7) - run(6.9))).toBeLessThan(0.5);
    });

    test('lands within a pixel, whatever the step', () => {
        expect(arrived(99, 100)).toBe(true);
        expect(arrived(98, 100)).toBe(false);
        expect(ARRIVE).toBe(1);
    });

    test('ends a glide on a scroller that only moves in whole pixels', () => {
        // The step gets smaller as it arrives, and a step under a pixel is rounded away by such
        // a scroller: chasing it would keep the glide, and its animation frame, alive forever.
        let at = 0;
        let frames = 0;
        for (; frames < 200; frames++) {
            const step = nextStep(at, 100, 16.7);
            if (step.done) break;
            at = Math.round(step.at);
        }
        expect(frames).toBeLessThan(200);
        expect(nextStep(at, 100, 16.7)).toEqual({ at: 100, done: true });
    });

    test('keeps its speed when the target moves: no start from a standstill', () => {
        // A wheel notched every 33 ms, as a spin sends them, each notch 100 px.
        let goal = 0;
        let at = 0;
        let notch = 0;
        const steps: number[] = [];
        for (let frame = 1; frame <= 30; frame++) {
            const time = frame * 16.7;
            if (notch < 8 && time >= notch * 33.4) {
                goal += 100;
                notch++;
            }
            const next = chase(at, goal, 16.7);
            steps.push(next - at);
            at = next;
        }
        // Every frame moved, the slowest included: the scroller never waits for an animation
        // to start over.
        expect(Math.min(...steps)).toBeGreaterThan(0);
        // By the time the wheel has turned 800 px it has most of the way to go with it.
        expect(at).toBeGreaterThan(600);
        // And then it lands on where the wheel asked for.
        for (let i = 0; i < 60; i++) at = chase(at, goal, 16.7);
        expect(arrived(at, goal)).toBe(true);
    });
});
