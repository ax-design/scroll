// Browser checks for <ax-scroll> with synthetic wheel and key events: they have no default
// action, so what moves is what the element does, and defaultPrevented tells whether it took
// the event.
import { register } from '../src/index.js';
import type { AxScroll } from '../src/index.js';

interface Check {
    name: string;
    ok: boolean;
    detail: string;
}
declare global {
    interface Window {
        __result?: unknown;
        // Key presses: the page sets __step, run.ts acks it once the key is pressed.
        __step?: string;
        __ack?: string;
    }
}

const checks: Check[] = [];
const check = (name: string, ok: boolean, detail = '') => checks.push({ name, ok, detail });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const byId = (id: string) => document.getElementById(id) as AxScroll;

const wheel = (target: Element, deltaY: number, extra: WheelEventInit = {}) => {
    const event = new WheelEvent('wheel', { deltaY, deltaMode: 0, bubbles: true, cancelable: true, composed: true, ...extra });
    target.dispatchEvent(event);
    return event.defaultPrevented;
};
// Waits for a gesture to end (wheel.ts GESTURE_GAP) and for smooth scrolling to settle.
const settle = () => wait(900);
// MutationObserver callbacks run before the next task; 20 ms is more than enough.
const settled = () => wait(20);

// A real key press through the driver. Only Playwright makes them: the page asks for them with
// ?keys, so Safari skips the checks that need one.
let pressed = 0;
const press = async (key: string) => {
    const step = `key:${key}:${++pressed}`;
    window.__step = step;
    for (let i = 0; window.__ack !== step; i++) {
        if (i > 500) throw new Error(`no ack for ${step}`);
        await wait(20);
    }
};
const realKeys = new URLSearchParams(location.search).has('keys');

// A link added to, or removed from, a scroller.
const addLink = (scroller: Element) => {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = 'Link';
    scroller.firstElementChild!.appendChild(link);
    return link;
};

async function run() {
    register();
    const s = byId('s');
    const strip = s.firstElementChild!;

    check('a wheel notch is taken', wheel(strip, 100));
    await settle();
    check('a wheel notch scrolls 100px sideways', Math.round(s.scrollLeft) === 100, String(s.scrollLeft));

    // Three quick notches: the second and third add to where the first one goes.
    wheel(strip, 100);
    await wait(30);
    wheel(strip, 100);
    await wait(30);
    wheel(strip, 100);
    await settle();
    check('quick notches add up', Math.round(s.scrollLeft) === 400, String(s.scrollLeft));

    // A quick spin keeps up: it does not wait for one notch's glide to end before the next.
    const spinFrom = s.scrollLeft;
    for (let i = 0; i < 8; i++) {
        wheel(strip, 100);
        await wait(25);
    }
    const spun = s.scrollLeft - spinFrom;
    await settle();
    check('a quick spin keeps up while the wheel turns', spun >= 400, Math.round(spun) + ' px of 800');
    check('and the spin adds up to all of it', Math.round(s.scrollLeft) === spinFrom + 800, String(s.scrollLeft));

    // Small steps move at once.
    const before = s.scrollLeft;
    wheel(strip, 6);
    check('a small step moves at once', Math.round(s.scrollLeft - before) === 6, String(s.scrollLeft - before));
    for (let i = 0; i < 5; i++) {
        await wait(16);
        wheel(strip, 6);
    }
    check('small steps add 1:1', Math.round(s.scrollLeft - before) === 36, String(s.scrollLeft - before));
    await settle();

    // Lines.
    const lines = s.scrollLeft;
    wheel(strip, 3, { deltaMode: 1 });
    await settle();
    check('three lines are 100px', Math.round(s.scrollLeft - lines) === 100, String(s.scrollLeft - lines));

    // Sideways swipes, shift and ctrl stay with the browser.
    check('a sideways swipe is not taken', !wheel(strip, 1, { deltaX: 8 }));
    check('and neither is its vertical jitter', !wheel(strip, 4));
    await settle();
    check('shift + wheel is not taken', !wheel(strip, 100, { shiftKey: true }));
    check('ctrl + wheel is not taken', !wheel(strip, 100, { ctrlKey: true }));
    await settle();

    // A nested vertical scroller takes the wheel while it can move.
    const inner = byId('inner');
    s.scrollLeft = 0;
    const left = s.scrollLeft;
    check('a nested scroller that can move keeps the wheel', !wheel(inner.firstElementChild!, 100) && s.scrollLeft === left);
    await settle();
    inner.scrollTop = inner.scrollHeight;
    check('at its end the scroller takes over', wheel(inner.firstElementChild!, 100));
    await settle();

    // Edges: at the end a downward gesture goes to the page; upward is taken.
    s.scrollLeft = s.scrollWidth;
    await wait(50);
    check('at the end the wheel goes to the page', !wheel(strip, 100));
    await settle();
    check('going back from the end is taken', wheel(strip, -100));
    await settle();
    check('and scrolls back', Math.round(s.scrollWidth - s.clientWidth - s.scrollLeft) === 100, String(s.scrollLeft));

    // Right to left: down scrolls toward the end, which is to the left.
    const r = byId('r');
    wheel(r.firstElementChild!, 100);
    await settle();
    check('right to left scrolls the other way', Math.round(r.scrollLeft) === -100, String(r.scrollLeft));
    await settle();

    // Reduced motion (emulated for one run in run.ts): a notch and an arrow key jump; otherwise they glide.
    s.scrollLeft = 0;
    await wait(50);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    wheel(strip, 100);
    const notch = s.scrollLeft;
    s.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true, composed: true }));
    const key = s.scrollLeft;
    check(
        reduced ? 'reduced motion: a notch and an arrow key jump at once' : 'without reduced motion a notch and an arrow key glide',
        reduced ? notch === 100 && key === 140 : notch === 0 && key === 0,
        `${notch}, ${key}`
    );
    await settle();
    check('and both end on their target', Math.round(s.scrollLeft) === 140, String(s.scrollLeft));

    // Keys.
    s.scrollLeft = 0;
    await wait(50);
    s.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true, composed: true }));
    await settle();
    check('Page Down scrolls most of a page', Math.round(s.scrollLeft) === Math.round(s.clientWidth * 0.875), String(s.scrollLeft));
    s.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true, composed: true }));
    await settle();
    check('the up key scrolls back', Math.round(s.scrollLeft) === Math.round(s.clientWidth * 0.875) - 40, String(s.scrollLeft));

    // cross-slide leaves vertical touch drags to the content.
    check('cross-slide pans sideways only', /pan-x/.test(getComputedStyle(byId('x')).touchAction) && !/pan-x/.test(getComputedStyle(s).touchAction), getComputedStyle(byId('x')).touchAction);

    // Keyboard focus: a scroller with nothing focusable in it takes the focus itself.
    const t = byId('t');
    const l = byId('l');
    check('a scroller with only text gets tabindex 0', t.getAttribute('tabindex') === '0', String(t.getAttribute('tabindex')));
    check('a scroller with a link gets no tabindex', !l.hasAttribute('tabindex'), String(l.getAttribute('tabindex')));
    if (realKeys) {
        // Tab from the button before it lands on the scroller, and the down key then scrolls it.
        byId('before').focus();
        await press('Tab');
        check('Tab from a button before it focuses the scroller', document.activeElement === t, String(document.activeElement && document.activeElement.id));
        await press('ArrowDown');
        await settle();
        check('the down key then scrolls it sideways', Math.round(t.scrollLeft) === 40, String(t.scrollLeft));
        t.scrollLeft = 0;
        await wait(50);
    }

    // A link added later takes the tabindex away, and removing it gives the tabindex back.
    const link = addLink(t);
    await settled();
    check('a link added later removes the tabindex', !t.hasAttribute('tabindex'), String(t.getAttribute('tabindex')));
    link.remove();
    await settled();
    check('removing the link gives the tabindex back', t.getAttribute('tabindex') === '0', String(t.getAttribute('tabindex')));
    // Removed from the page, the scroller removes its own tabindex, and gives it back when it returns.
    const parent = t.parentNode!;
    const next = t.nextSibling;
    t.remove();
    check('on disconnect the own tabindex is removed', !t.hasAttribute('tabindex'), String(t.getAttribute('tabindex')));
    parent.insertBefore(t, next);
    await settled();
    check('and back on connect', t.getAttribute('tabindex') === '0', String(t.getAttribute('tabindex')));

    const linkInL = l.querySelector('a')!;
    linkInL.remove();
    await settled();
    check('a link removed from a scroller gives it a tabindex', l.getAttribute('tabindex') === '0', String(l.getAttribute('tabindex')));
    l.appendChild(linkInL);
    await settled();
    check('and a link added back takes it away again', !l.hasAttribute('tabindex'), String(l.getAttribute('tabindex')));

    // The author's tabindex is theirs: kept through changes and on disconnect.
    for (const [id, value] of [['own-neg', '-1'], ['own-zero', '0']]) {
        const own = byId(id);
        const ownLink = addLink(own);
        await settled();
        ownLink.remove();
        await settled();
        check(`author tabindex ${value} is kept through link changes`, own.getAttribute('tabindex') === value, String(own.getAttribute('tabindex')));
        const parentOwn = own.parentNode!;
        const nextOwn = own.nextSibling;
        own.remove();
        await settled();
        check(`author tabindex ${value} is kept on disconnect`, own.getAttribute('tabindex') === value, String(own.getAttribute('tabindex')));
        parentOwn.insertBefore(own, nextOwn);
        addLink(own);
        await settled();
        check(`author tabindex ${value} is kept after a link is added`, own.getAttribute('tabindex') === value, String(own.getAttribute('tabindex')));
    }

    return { userAgent: navigator.userAgent, checks };
}

run().then(
    (r) => (window.__result = r),
    (e) => (window.__result = { error: String((e && e.stack) || e) })
);
