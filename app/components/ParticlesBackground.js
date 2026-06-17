'use client';

import { useEffect, useRef } from 'react';

export default function ParticlesBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId;
    let particles = [];
    const PARTICLE_COUNT = 60;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticle = (randomY = false) => ({
      x: Math.random() * canvas.width,
      y: randomY ? Math.random() * canvas.height : canvas.height + Math.random() * 40,
      size: 1 + Math.random() * 2,
      speedY: 0.2 + Math.random() * 0.6,
      drift: Math.random() * Math.PI * 2,
      driftSpeed: 0.003 + Math.random() * 0.008,
      driftAmplitude: 0.3 + Math.random() * 0.7,
      alpha: 0.15 + Math.random() * 0.55,
    });

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(createParticle(true));
      }
    };

    const drawParticle = (p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = '#d4a843';
      ctx.shadowBlur = 6 + p.size * 2;
      ctx.fillStyle = '#d4a843';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Float upward
        p.y -= p.speedY;

        // Sine-wave horizontal drift
        p.drift += p.driftSpeed;
        p.x += Math.sin(p.drift) * p.driftAmplitude;

        // Reset particle when it exits the top
        if (p.y < -10) {
          particles[i] = createParticle(false);
        }

        drawParticle(p);
      }

      animationId = requestAnimationFrame(update);
    };

    resize();
    initParticles();
    update();

    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 99,
        pointerEvents: 'none',
      }}
    />
  );
}
