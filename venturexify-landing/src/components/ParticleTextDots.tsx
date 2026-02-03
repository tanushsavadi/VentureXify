"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "dark" | "light";

interface ParticleTextDotsProps {
  text: string;
  variant?: Variant;
  className?: string;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  depth: number;
  size: number;
  phase: number;
};

type MouseState = {
  x: number;
  y: number;
  active: boolean;
};

export function ParticleTextDots({
  text,
  variant = "dark",
  className,
}: ParticleTextDotsProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const mouseRef = React.useRef<MouseState>({
    x: 0,
    y: 0,
    active: false,
  });

  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];

    const dpr = window.devicePixelRatio || 1;

    const createParticlesFromText = (
      w: number,
      h: number,
      raw: string,
    ): Particle[] => {
      const label = raw.trim() || "VX";

      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d");
      if (!octx) return [];

      octx.clearRect(0, 0, w, h);

      const maxFontHeight = h * 0.65;
      const approxCharWidth = 0.6;
      const targetWidth = w * 0.8;
      const fontSize = Math.min(
        maxFontHeight,
        targetWidth / Math.max(1, label.length * approxCharWidth),
      );

      octx.fillStyle = variant === "dark" ? "#ffffff" : "#020617";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.font = `800 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
      octx.fillText(label, w / 2, h / 2);

      const img = octx.getImageData(0, 0, w, h);
      const data = img.data;

      const baseGap = Math.min(w, h) / 65;
      const gap = Math.max(5, Math.round(baseGap));
      const alphaThreshold = 70;

      const pts: Particle[] = [];

      for (let y = 0; y < h; y += gap) {
        for (let x = 0; x < w; x += gap) {
          const idx = (y * w + x) * 4;
          const alpha = data[idx + 3];
          if (alpha > alphaThreshold) {
            const depth = Math.random();

            const jitterX = (Math.random() - 0.5) * gap * 0.2;
            const jitterY = (Math.random() - 0.5) * gap * 0.2;
            const baseX = x + jitterX;
            const baseY = y + jitterY;

            const startOffset = 22;
            const sx = baseX + (Math.random() - 0.5) * startOffset;
            const sy = baseY + (Math.random() - 0.5) * startOffset;

            pts.push({
              x: sx,
              y: sy,
              vx: 0,
              vy: 0,
              baseX,
              baseY,
              depth,
              size: 1.4 + depth * 1.3,
              phase: Math.random() * Math.PI * 2,
            });
          }
        }
      }

      return pts;
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      particles = createParticlesFromText(width, height, text);

      mouseRef.current.x = width / 2;
      mouseRef.current.y = height / 2;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let lastTime = performance.now();

    const render = (time: number) => {
      if (disposed) return;

      const dtMs = time - lastTime;
      lastTime = time;
      const dt = Math.min(2, dtMs / 16.67);

      const t = time * 0.0012;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, width, height);

      const influenceRadius = Math.min(width, height) * 0.35;
      const influenceRadiusSq = influenceRadius * influenceRadius;

      for (const p of particles) {
        if (mouse.active) {
          const dxm = p.x - mouse.x;
          const dym = p.y - mouse.y;
          const distSq = dxm * dxm + dym * dym;
          if (distSq < influenceRadiusSq && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const force = (1 - dist / influenceRadius) * 1.5;
            const nx = dxm / dist;
            const ny = dym / dist;
            const k = force * (0.4 + p.depth * 0.6);
            p.vx += nx * k;
            p.vy += ny * k;
          }
        }

        const spring = 0.06 + p.depth * 0.03;
        const dx = p.baseX - p.x;
        const dy = p.baseY - p.y;
        p.vx += dx * spring * dt;
        p.vy += dy * spring * dt;

        const wobble = 0.07 + p.depth * 0.09;
        p.vx += Math.cos(t * 1.2 + p.phase) * wobble * 0.16 * dt;
        p.vy += Math.sin(t * 1.3 + p.phase) * wobble * 0.16 * dt;

        p.vx *= 0.9;
        p.vy *= 0.9;

        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      for (const p of particles) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const near = mouse.active ? Math.max(0, 1 - dist / influenceRadius) : 0;

        const flickerBase = (Math.sin(t * 1.0 + p.phase * 1.7) + 1) * 0.5;
        const flicker = 0.85 + 0.15 * flickerBase;

        const depthFactor = 0.55 + p.depth * 0.45;
        const alpha = (0.55 + 0.3 * near) * depthFactor * flicker;

        // Use amber/orange for the brand color
        const hue = 30 + p.depth * 20; // amber range
        const lightness = 55 + p.depth * 20;

        ctx.fillStyle = `hsla(${hue}, 90%, ${lightness}%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(render);
    };

    frameRef.current = requestAnimationFrame(render);

    return () => {
      disposed = true;
      ro.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [text, variant]);

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current.x = e.clientX - rect.left;
    mouseRef.current.y = e.clientY - rect.top;
    mouseRef.current.active = true;
  };

  const handlePointerLeave: React.PointerEventHandler<HTMLDivElement> = () => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    mouseRef.current.x = rect.width / 2;
    mouseRef.current.y = rect.height / 2;
    mouseRef.current.active = false;
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn(
        "relative w-full overflow-hidden rounded-3xl border",
        "min-h-[260px] sm:min-h-[320px] md:min-h-[360px]",
        "shadow-[0_22px_90px_rgba(0,0,0,0.7)]",
        variant === "dark"
          ? "border-white/10 bg-[#0A0A0B]"
          : "border-slate-200 bg-slate-50",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {variant === "dark" ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),transparent_60%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.9),transparent_55%)]" />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),transparent_60%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.05),transparent_55%)]" />
      )}
    </div>
  );
}
