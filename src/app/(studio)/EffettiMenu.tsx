'use client';

import { createPortal } from 'react-dom';

/**
 * Gli effetti al clic sulle voci del menu: nel tema scuro una meteora colpisce l'icona e la fa esplodere,
 * nel tema chiaro uno squalo la mangia. Sono puro spettacolo: stanno in un livello fisso sopra la pagina,
 * non ricevono clic e spariscono da soli. La navigazione non aspetta niente.
 */

// Direzione, distanza e dimensione dei frammenti dell'esplosione (angoli ben distribuiti, distanze diverse).
const FRAMMENTI = Array.from({ length: 16 }, (_, i) => {
  const angolo = (i / 16) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
  const raggio = 34 + ((i * 37) % 30);
  return {
    dx: Math.round(Math.cos(angolo) * raggio), dy: Math.round(Math.sin(angolo) * raggio),
    dim: 3 + (i % 3), colore: ['#fff3c4', '#ffb15c', '#ff6a3d', '#d94a6b'][i % 4], giro: (i % 2 ? 1 : -1) * (180 + i * 20),
  };
});

const BOLLE = [
  { x: -6, dim: 6, ritardo: 0.95 }, { x: 5, dim: 4, ritardo: 1.05 }, { x: -1, dim: 8, ritardo: 1.15 },
  { x: 9, dim: 5, ritardo: 1.25 }, { x: -9, dim: 4, ritardo: 1.3 }, { x: 2, dim: 6, ritardo: 1.4 },
];

function Meteora() {
  return (
    <>
      <span className="fx-meteora" />
      <span className="fx-lampo" />
      <span className="fx-anello" />
      {FRAMMENTI.map((f, i) => (
        <span
          key={i} className="fx-frammento"
          style={{ '--dx': `${f.dx}px`, '--dy': `${f.dy}px`, '--giro': `${f.giro}deg`, width: f.dim, height: f.dim, background: f.colore } as React.CSSProperties}
        />
      ))}
    </>
  );
}

function Squalo() {
  return (
    <>
      <span className="fx-squalo">
        <svg viewBox="0 0 120 64" width="112" height="60" style={{ transform: 'scaleX(-1)', overflow: 'visible' }} aria-hidden="true">
          <defs>
            <linearGradient id="sq-corpo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#56718d" />
              <stop offset=".55" stopColor="#86a0b9" />
              <stop offset="1" stopColor="#dce7f0" />
            </linearGradient>
          </defs>
          <path d="M22 30 L2 6 Q9 27 9 32 Q9 37 2 58 Z" fill="#4d6882" />
          <path d="M50 17 L60 0 Q64 10 73 20 Z" fill="#4d6882" />
          <path d="M20 32 C30 14 72 9 100 28 L109 33 L80 36 C60 45 40 49 20 32 Z" fill="url(#sq-corpo)" />
          <path d="M58 44 L47 61 Q67 57 77 46 Z" fill="#4d6882" />
          <path d="M71 24q-3 5 0 10M76 23q-3 5 0 11M81 24q-3 5 0 10" stroke="#44607a" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <circle cx="92" cy="26" r="3.2" fill="#fff" />
          <circle cx="93" cy="26.4" r="1.7" fill="#10202e" />
          <g className="fx-mandibola">
            <path d="M77 36 L107 34 Q103 47 85 48 Q75 46 77 36 Z" fill="#7a1f2e" />
            <path d="M77 36 L107 34 Q104 44 88 46 C80 45 77 41 77 36 Z" fill="#dce7f0" />
            <path d="M84 38l2.4 -5 2.4 5M91 37l2.4 -5 2.4 5M98 36l2.2 -4.5 2.2 4.5" fill="#fff" />
          </g>
          <path d="M83 34.5l2.6 5 2.6 -5M90 34l2.6 5 2.6 -5M97 33.5l2.4 4.6 2.4 -4.6" fill="#fff" />
        </svg>
      </span>
      {BOLLE.map((b, i) => (
        <span key={i} className="fx-bolla" style={{ '--bx': `${b.x}px`, width: b.dim, height: b.dim, animationDelay: `${b.ritardo}s` } as React.CSSProperties} />
      ))}
    </>
  );
}

export type EffettoClic = { tipo: 'meteora' | 'squalo'; x: number; y: number; chiave: number };

export default function LivelloEffetti({ effetto }: { effetto: EffettoClic | null }) {
  if (!effetto || typeof document === 'undefined') return null;
  return createPortal(
    <div
      key={effetto.chiave}
      aria-hidden="true"
      className="pointer-events-none fixed z-[90]"
      style={{ left: effetto.x, top: effetto.y, width: 0, height: 0 }}
    >
      {effetto.tipo === 'meteora' ? <Meteora /> : <Squalo />}
    </div>,
    document.body,
  );
}
