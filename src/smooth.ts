// The glide that bind.ts uses for a wheel step, without DOM: an approach that closes a share of
// what is left toward a target that the next wheel step can move.
//
// scrollTo({ behavior: 'smooth' }) cannot do this: every call starts a new animation, and
// Chromium starts it from a standstill. A wheel spin that arrives faster than one animation ends
// then turns into a stutter that only catches up once the wheel stops, while an approach that
// closes a share of what is left keeps whatever speed it has when the target moves.

// Time in ms in which about 63% of what is left is closed. Smaller is snappier.
export const SMOOTH_TAU = 50;
// Within this distance in px a glide lands instead of chasing. A scroller that only moves in
// whole pixels cannot close the last pixel of it: the step is rounded away, and a glide that
// keeps a target would never end.
export const ARRIVE = 1;

// The share of what is left that is closed in `dt` ms.
export function chaseFactor(dt: number, tau: number = SMOOTH_TAU): number {
    return 1 - Math.exp(-dt / tau);
}

// The position `dt` ms into a glide from `from` toward `to`. After the same time it is the same
// whatever the frame rate, and a target that moves on the way only changes where it is heading.
export function chase(from: number, to: number, dt: number, tau: number = SMOOTH_TAU): number {
    return from + (to - from) * chaseFactor(dt, tau);
}

// Whether a glide from `from` toward `to` has arrived.
export function arrived(from: number, to: number, tolerance: number = ARRIVE): boolean {
    return Math.abs(to - from) <= tolerance;
}

// The position to write next in a glide, and whether the glide is over. What is left is landed in
// one write rather than chased once the step would be under a pixel, so the glide ends at the
// target even on a scroller that rounds every write to whole pixels.
export function nextStep(from: number, to: number, dt: number, tau: number = SMOOTH_TAU): { at: number; done: boolean } {
    const next = chase(from, to, dt, tau);
    if (arrived(from, to) || Math.abs(next - from) < 1) return { at: to, done: true };
    return { at: next, done: false };
}
