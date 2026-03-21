'use client';

import { useEffect } from 'react';

export default function AdminParticles() {
  useEffect(() => {
    const container = document.getElementById('admin-particles');
    if (!container || container.children.length > 0) return;

    const particleCount = 30;
    const colors = ['#00d4ff', '#c9a227', '#8b5cf6'];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'admin-particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 8 + 's';
      particle.style.animationDuration = (6 + Math.random() * 4) + 's';

      const color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.background = color;
      particle.style.boxShadow = `0 0 6px ${color}`;

      container.appendChild(particle);
    }
  }, []);

  return null;
}
