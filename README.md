<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/ax-design/scroll/master/docs/logo-r.png">
    <img src="https://raw.githubusercontent.com/ax-design/scroll/master/docs/logo.png" alt="Ax Pressure">
  </picture>
</h1>


<p align="center">
  Web component that implements Horizontal Scrolling Container of Axiom Design System.
</p>

## Installation

```bash
// with npm
npm install @ax-design/scroll

// with yarn
yarn add @ax-design/scroll
```

and import it:

```javascript
//CommonJS
require('@ax-design/scroll').register();

//ESModule
import { register } from '@ax-design/scroll';
register();
```

If you don't use a bundler, load `build/main.js` (it exposes `AxScroll`) or import `build/index.mjs`.

## Usage

```html
<ax-scroll style="height: 600px">
  <div style="display: flex; width: max-content">...</div>
</ax-scroll>
```

`ax-scroll` is a native horizontal scroller (`overflow-x: auto`), so touch, horizontal touchpad swipes, the scrollbar, the left and right keys, scroll snapping and assistive technology all work as usual. On top of that:

* A vertical mouse wheel scrolls it sideways with a glide of its own. Quick notches add up, and a spin keeps moving instead of starting over at every notch.
* A touchpad swiped up and down scrolls it sideways 1:1, with the touchpad's own momentum.
* The up and down keys, Page Up and Page Down scroll it sideways.
* At either end, a wheel gesture goes on to the page, like nested scrollers do.
* Shift + wheel (already horizontal) and ctrl + wheel (zoom) are left to the browser, and so is a wheel over something inside that scrolls vertically and can still move, or over a form field.
* Right-to-left layouts scroll the other way.

### How wheel events are told apart

No browser says whether a wheel event comes from a mouse or a touchpad, and on Windows they look the same. So `ax-scroll` does not guess the device; it handles each event by what it looks like, in a way that suits both:

* Events less than 120 ms apart are one gesture, and its first event decides for all of it: mostly sideways is left to the browser, mostly vertical is turned sideways.
* Steps in lines or pages, and steps of 50 px or more (Chromium sends 100 px a wheel notch), scroll smoothly.
* Smaller steps (touchpads, high resolution wheels) scroll at once, 1:1.

`WheelSwap`, the class that decides, is exported and has no DOM dependency.

## Attributes

### cross-slide

Touch drags only pan sideways; vertical drags go to the content, for example a tile group that starts dragging a tile on a vertical swipe. Off by default, so a finger still scrolls the page vertically over the scroller.

## Functions

### bindScroll(target, options)

The same scrolling for a scroller of your own, or for the whole page:

```javascript
import { bindScroll } from '@ax-design/scroll';

// A page laid out sideways: body { overflow-x: auto; overflow-y: hidden; }
const binding = bindScroll(window);

// Later:
binding.unbind();
```

`target` is an element that scrolls horizontally, or `window`. With `{ keys: false }` the up and down keys and Page Up and Page Down are left alone. It returns `{ scrollAlong(delta, smooth), unbind() }`.

## Methods

### scrollAlong(delta, smooth)

Scrolls by `delta` px toward the end (negative: toward the start). `smooth` glides there and adds up with a glide that is still running. When the user asks for reduced motion (`prefers-reduced-motion: reduce`), `smooth` is ignored and the scroll jumps.

## Known issues

* Without a touchpad or a mouse at hand, the thresholds (120 ms, 50 px) come from what browsers are documented to send, not from trying every device.

## Changes

* 0.1.2: a wheel spin keeps gliding instead of starting over at every notch, which stuttered in Chromium.
* 0.1.1: `bindScroll(target)`, the same scrolling for any scroller or for the whole page.

## Development

```bash
bun install
bun run build         # es/, build/index.mjs, build/main.js
bun run check         # type check
bun test              # wheel decision and glide tests
bun run test:browser  # browser tests
bun run demo          # demo page
```
