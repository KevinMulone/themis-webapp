'use client';

import { useRef, type ReactNode, type PointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';

type Props = {
  children: ReactNode;
  className?: string;
  tilt?: boolean;
};

/**
 * Solleva la card con una molla. Il tilt 3D è spento su touch e se
 * l'utente ha chiesto meno animazioni.
 */
export default function HoverLift({ children, className = '', tilt = false }: Props) {
  const riduci = useReducedMotion();
  const rif = useRef<HTMLDivElement>(null);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!tilt || riduci || e.pointerType !== 'mouse') return;
    const nodo = rif.current;
    if (!nodo) return;
    const r = nodo.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    nodo.style.transform = `perspective(800px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-3px) scale(1.025)`;
  }

  function onLeave() {
    const nodo = rif.current;
    if (!nodo) return;
    nodo.style.transform = '';
  }

  if (riduci) {
    return <div className={`hover-lift-static ${className}`}>{children}</div>;
  }

  return (
    <motion.div
      ref={rif}
      className={className}
      style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
      transition={{ type: 'spring', stiffness: 420, damping: 28, mass: 0.6 }}
      whileHover={tilt ? undefined : { y: -3, scale: 1.025 }}
      whileTap={{ scale: 0.985 }}
      onPointerMove={tilt ? onMove : undefined}
      onPointerLeave={tilt ? onLeave : undefined}
    >
      {children}
    </motion.div>
  );
}
