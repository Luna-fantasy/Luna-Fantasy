'use client';

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import type { PointerEvent, ReactNode } from 'react';

export function PortraitDepth({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const spring = { stiffness: 215, damping: 25, mass: .65 };
  const x = useSpring(targetX, spring);
  const y = useSpring(targetY, spring);
  const rotateY = useTransform(x, [-1, 1], [-4.4, 4.4]);
  const rotateX = useTransform(y, [-1, 1], [3.4, -3.4]);
  const artX = useTransform(x, [-1, 1], [3.2, -3.2]);
  const artY = useTransform(y, [-1, 1], [2.4, -2.4]);
  const rimX = useTransform(x, [-1, 1], [-6, 6]);
  const rimY = useTransform(y, [-1, 1], [-4, 4]);
  const gleam = useTransform(x, [-1, 0, 1], ['-32%', '0%', '32%']);
  function aim(event: PointerEvent<HTMLDivElement>) {
    if (reduced || !event.isPrimary) return;
    const b = event.currentTarget.getBoundingClientRect();
    targetX.set(Math.max(-1, Math.min(1, ((event.clientX - b.left) / b.width) * 2 - 1)));
    targetY.set(Math.max(-1, Math.min(1, ((event.clientY - b.top) / b.height) * 2 - 1)));
  }
  function clear() { targetX.set(0); targetY.set(0); }
  return <div className="luna-portrait-depth" data-portrait-depth onPointerMove={aim} onPointerDown={aim}
    onPointerLeave={clear} onPointerCancel={clear} onPointerUp={e => { if (e.pointerType !== 'mouse') clear(); }}>
    <motion.div className="luna-portrait-mount" style={reduced ? undefined : { rotateX, rotateY, transformPerspective: 850 }}>
      <motion.div className="luna-portrait-image" style={reduced ? undefined : { x: artX, y: artY }}>{children}</motion.div>
      <motion.span aria-hidden="true" className="luna-portrait-rim" style={reduced ? undefined : { x: rimX, y: rimY }} />
      <motion.span aria-hidden="true" className="luna-portrait-glass" style={reduced ? undefined : { x: gleam }} />
    </motion.div>
    <span aria-hidden="true" className="luna-portrait-reveal" />
  </div>;
}
