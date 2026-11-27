'use client';

import { useEffect, useRef } from 'react';

/**
 * Small particles behind the sign-in panel's green side.
 *
 * They drift slowly, step aside from the mouse and settle back, and a
 * faint line joins two that pass close. Drawn on one canvas, so it costs
 * almost nothing. Nothing moves for anyone who has asked their device
 * for less motion, and it stops while the tab is hidden.
 */
export function Particles({ count = 70, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return undefined;
    const ctx = canvas.getContext('2d');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    const mouse = { x: -9999, y: -9999, on: false };
    let dots = [];

    const seed = () => {
      dots = Array.from({ length: count }, () => {
        const x = Math.random() * w;
        const y = Math.random() * h;
        return {
          x, y, hx: x, hy: y, vx: 0, vy: 0,
          r: 0.8 + Math.random() * 1.8,
          a: 0.25 + Math.random() * 0.5,
          // Each drifts on its own slow loop around its home.
          t: Math.random() * Math.PI * 2,
          s: 0.002 + Math.random() * 0.004,
          lime: Math.random() < 0.35,
        };
      });
    };

    const size = () => {
      const box = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.width;
      h = box.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const R = 110; // how far the mouse reaches

      for (const d of dots) {
        if (!still) {
          d.t += d.s;
          const tx = d.hx + Math.cos(d.t) * 14;
          const ty = d.hy + Math.sin(d.t * 1.3) * 10;
          // Pulled home, pushed from the mouse.
          d.vx += (tx - d.x) * 0.004;
          d.vy += (ty - d.y) * 0.004;
          if (mouse.on) {
            const dx = d.x - mouse.x;
            const dy = d.y - mouse.y;
            const dist = Math.hypot(dx, dy);
            if (dist < R && dist > 0.1) {
              const push = (1 - dist / R) * 0.9;
              d.vx += (dx / dist) * push;
              d.vy += (dy / dist) * push;
            }
          }
          d.vx *= 0.9;
          d.vy *= 0.9;
          d.x += d.vx;
          d.y += d.vy;
        }
      }

      // Faint lines between near neighbours, brighter near the mouse.
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i];
          const b = dots[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 90) {
            const near = mouse.on ? Math.max(0, 1 - Math.hypot(a.x - mouse.x, a.y - mouse.y) / 220) : 0;
            ctx.strokeStyle = `rgba(214,240,180,${(1 - dist / 90) * (0.08 + near * 0.22)})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const d of dots) {
        ctx.fillStyle = d.lime ? `rgba(160,220,90,${d.a + 0.2})` : `rgba(255,255,255,${d.a})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e) => {
      const box = host.getBoundingClientRect();
      mouse.x = e.clientX - box.left;
      mouse.y = e.clientY - box.top;
      mouse.on = true;
    };
    const onLeave = () => { mouse.on = false; };
    const onVisible = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !still) loop();
    };

    size();
    if (still) draw();
    else loop();

    const ro = new ResizeObserver(() => { size(); if (still) draw(); });
    ro.observe(host);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [count]);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} />;
}
