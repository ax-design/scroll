# Changelog

All notable changes to this package are documented in this file.

## 0.2.0

- `ax-scroll` takes focus with `tabindex="0"` while nothing inside it can, so the keys work without a focusable child (Safari and older engines).

## 0.1.2

- a wheel spin keeps gliding instead of starting over at every notch, which stuttered in Chromium.

## 0.1.1

- `bindScroll(target)`, the same scrolling for any scroller or for the whole page.
