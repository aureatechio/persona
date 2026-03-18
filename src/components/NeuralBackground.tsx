'use client';

import { useEffect, useRef } from 'react';

type ColorScheme = 'violet' | 'multi';

interface NeuralBackgroundProps {
  colorScheme?: ColorScheme;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  pulsePhase: number;
  pulseSpeed: number;
  colorIndex: number;
}

const CONNECTION_DISTANCE = 180;
const NODE_COUNT = 70;
const SPEED = 0.3;

// Color palettes: [r, g, b]
const PALETTES: Record<ColorScheme, { nodes: [number, number, number][]; core: [number, number, number][] }> = {
  violet: {
    nodes: [[139, 92, 246]],
    core: [[200, 180, 255]],
  },
  multi: {
    nodes: [
      [52, 211, 153],   // emerald-400
      [244, 114, 182],  // pink-400
      [139, 92, 246],   // violet-400
      [34, 211, 238],   // cyan-400
    ],
    core: [
      [167, 243, 208],  // emerald-200
      [251, 207, 232],  // pink-200
      [200, 180, 255],  // violet-200
      [165, 243, 252],  // cyan-200
    ],
  },
};

export function NeuralBackground({ colorScheme = 'violet' }: NeuralBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const frameRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const palette = PALETTES[colorScheme];
    let width = 0;
    let height = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      width = canvas!.parentElement?.clientWidth ?? window.innerWidth;
      height = canvas!.parentElement?.clientHeight ?? window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initNodes() {
      nodesRef.current = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * SPEED,
        vy: (Math.random() - 0.5) * SPEED,
        radius: Math.random() * 1.8 + 0.6,
        opacity: Math.random() * 0.5 + 0.15,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.01 + 0.005,
        colorIndex: Math.floor(Math.random() * palette.nodes.length),
      }));
    }

    function rgba(color: [number, number, number], a: number) {
      return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${a})`;
    }

    function draw(time: number) {
      ctx!.clearRect(0, 0, width, height);
      const nodes = nodesRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < -20) node.x = width + 20;
        if (node.x > width + 20) node.x = -20;
        if (node.y < -20) node.y = height + 20;
        if (node.y > height + 20) node.y = -20;

        // Subtle attraction toward mouse
        const dmx = mx - node.x;
        const dmy = my - node.y;
        const distMouse = Math.sqrt(dmx * dmx + dmy * dmy);
        if (distMouse < 250) {
          const force = (1 - distMouse / 250) * 0.003;
          node.vx += dmx * force;
          node.vy += dmy * force;
        }

        // Speed cap
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > SPEED * 2) {
          node.vx = (node.vx / speed) * SPEED * 2;
          node.vy = (node.vy / speed) * SPEED * 2;
        }

        node.pulsePhase += node.pulseSpeed;
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.12;
            const c = palette.nodes[nodes[i].colorIndex];
            ctx!.strokeStyle = rgba(c, alpha);
            ctx!.lineWidth = 0.5;
            ctx!.beginPath();
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const pulse = Math.sin(node.pulsePhase) * 0.3 + 0.7;
        const alpha = node.opacity * pulse;
        const c = palette.nodes[node.colorIndex];
        const cc = palette.core[node.colorIndex];

        // Glow
        const gradient = ctx!.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, node.radius * 6
        );
        gradient.addColorStop(0, rgba(c, alpha * 0.4));
        gradient.addColorStop(0.4, rgba(c, alpha * 0.1));
        gradient.addColorStop(1, rgba(c, 0));
        ctx!.fillStyle = gradient;
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, node.radius * 6, 0, Math.PI * 2);
        ctx!.fill();

        // Core
        ctx!.fillStyle = rgba(cc, alpha);
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Occasional data "pulse" traveling along a connection
      const pulseTime = (time * 0.001) % 4;
      if (pulseTime < 2 && nodes.length > 1) {
        const idx = Math.floor((time * 0.0003) % (nodes.length - 1));
        const a = nodes[idx];
        const b = nodes[(idx + 1) % nodes.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DISTANCE * 1.5) {
          const t = (pulseTime / 2);
          const px = a.x + dx * t;
          const py = a.y + dy * t;
          const pc = palette.core[a.colorIndex];
          const pg = ctx!.createRadialGradient(px, py, 0, px, py, 4);
          pg.addColorStop(0, rgba(pc, 0.7));
          pg.addColorStop(1, rgba(pc, 0));
          ctx!.fillStyle = pg;
          ctx!.beginPath();
          ctx!.arc(px, py, 4, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000 };
    }

    resize();
    initNodes();
    frameRef.current = requestAnimationFrame(draw);

    window.addEventListener('resize', () => { resize(); initNodes(); });
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [colorScheme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
