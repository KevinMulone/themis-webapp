import { prefersReducedMotion } from './prefersReduced';

/**
 * Disintegrazione a griglia: particelle DOM dal bounding box.
 * Solo transform/opacity. Niente canvas, niente html2canvas.
 */
export function explodeNode(el: HTMLElement | null): Promise<void> {
  if (!el) return Promise.resolve();
  if (prefersReducedMotion()) {
    el.style.opacity = '0';
    return new Promise((r) => setTimeout(r, 80));
  }

  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return Promise.resolve();

  const cols = Math.min(10, Math.max(6, Math.round(rect.width / 56)));
  const rows = Math.min(6, Math.max(3, Math.round(rect.height / 28)));
  const computed = getComputedStyle(el);
  let bg = computed.backgroundColor;
  if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = '#ffffff';

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    `left:${rect.left}px`,
    `top:${rect.top}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    'pointer-events:none',
    'z-index:80',
    'overflow:visible',
  ].join(';');

  const cw = rect.width / cols;
  const ch = rect.height / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const p = document.createElement('span');
      const dx = (x - cols / 2) * (10 + Math.random() * 16);
      const dy = -18 - Math.random() * 56;
      const rot = (Math.random() * 50 - 25).toFixed(1);
      p.style.cssText = [
        'position:absolute',
        `left:${x * cw}px`,
        `top:${y * ch}px`,
        `width:${cw + 0.6}px`,
        `height:${ch + 0.6}px`,
        `background:${bg}`,
        'box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)',
        'will-change:transform,opacity',
        `animation:themis-explode .62s cubic-bezier(.16,1,.3,1) forwards`,
        `animation-delay:${(x + y) * 11}ms`,
        `--dx:${dx.toFixed(1)}px`,
        `--dy:${dy.toFixed(1)}px`,
        `--rot:${rot}deg`,
      ].join(';');
      host.appendChild(p);
    }
  }

  document.body.appendChild(host);
  el.style.visibility = 'hidden';

  return new Promise((resolve) => {
    window.setTimeout(() => {
      host.remove();
      resolve();
    }, 720);
  });
}
