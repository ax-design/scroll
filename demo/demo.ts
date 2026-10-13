import { registerRevealLayer } from '@ax-design/reveal-highlight';
import { register as registerScroll } from '@ax-design/scroll';
import { register as registerTiles } from '@ax-design/tile-group';

registerRevealLayer();
registerTiles();
registerScroll();

const scroller = document.getElementById('scroller') as HTMLElement;
const cross = document.getElementById('cross') as HTMLInputElement;
cross.addEventListener('change', () => scroller.toggleAttribute('cross-slide', cross.checked));
