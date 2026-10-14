// bindScroll(window): the page itself scrolls sideways.
import { bindScroll } from '../src/index.js';

const checks: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => checks.push({ name, ok, detail });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const page = document.scrollingElement as HTMLElement;

async function run() {
    const binding = bindScroll(window);
    const wheel = (deltaY: number) => {
        const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true, composed: true });
        document.querySelector('.wide')!.dispatchEvent(event);
        return event.defaultPrevented;
    };
    check('a wheel over the page is taken', wheel(100));
    await wait(900);
    check('the page scrolls sideways', Math.round(page.scrollLeft) === 100, String(page.scrollLeft));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }));
    await wait(900);
    // WebKit scrolls to whole pixels.
    check('Page Down scrolls the page sideways', Math.abs(page.scrollLeft - (100 + window.innerWidth * 0.875)) <= 1, String(page.scrollLeft));
    binding.unbind();
    check('unbound, the wheel is left alone', !wheel(100));
    return { userAgent: navigator.userAgent, checks };
}

run().then(
    (r) => ((window as any).__result = r),
    (e) => ((window as any).__result = { error: String((e && e.stack) || e) })
);
