'use client';

import { useEffect, useRef, useState } from 'react';
import { GameExitButton } from './GameExitButton';

const WIDTH = 280;
const HEIGHT = 500;
const LANES = [70, 140, 210];
const GROUND_Y = 388;

type Obstacle = { lane: number; y: number; kind: 'barrier' | 'low' };
type Input = { left: boolean; right: boolean; jump: boolean };

export function AvaxDasher({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const input = useRef<Input>({ left: false, right: false, jump: false });
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // Mirror of the loop's `over` flag so JSX pointer handlers can branch
  // on it without going through React state.
  const overRef = useRef(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let over = false;
    overRef.current = false;
    let score = 0;
    let speed = 3.2;
    let spawn = 0;
    let lane = 1;
    let targetLane = 1;
    let x = LANES[lane];
    let jumpY = 0;
    let jumpV = 0;
    let obstacles: Obstacle[] = [];

    const reset = () => {
      over = false;
      overRef.current = false;
      score = 0;
      speed = 3.2;
      spawn = 0;
      lane = 1;
      targetLane = 1;
      x = LANES[lane];
      jumpY = 0;
      jumpV = 0;
      obstacles = [];
      input.current.left = false;
      input.current.right = false;
      input.current.jump = false;
    };

    const drawTrack = () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, '#fff7f7');
      gradient.addColorStop(1, '#e4e4e7');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.moveTo(52, 80);
      ctx.lineTo(228, 80);
      ctx.lineTo(270, HEIGHT);
      ctx.lineTo(10, HEIGHT);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      for (const lx of [WIDTH / 2 - 42, WIDTH / 2 + 42]) {
        ctx.beginPath();
        ctx.moveTo(lx, 86);
        ctx.lineTo(lx + (lx < WIDTH / 2 ? -38 : 38), HEIGHT);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(239,68,68,0.45)';
      for (let y = (score * 3) % 58; y < HEIGHT; y += 58) {
        ctx.beginPath();
        ctx.moveTo(WIDTH / 2 - 6, y + 100);
        ctx.lineTo(WIDTH / 2 - 12, y + 132);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(WIDTH / 2 + 6, y + 100);
        ctx.lineTo(WIDTH / 2 + 12, y + 132);
        ctx.stroke();
      }
    };

    const draw = () => {
      drawTrack();
      ctx.fillStyle = '#dc2626';
      ctx.font = '700 14px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(String(score), 14, 28);

      for (const o of obstacles) {
        const ox = LANES[o.lane];
        const scale = 0.55 + o.y / HEIGHT;
        const w = 26 * scale;
        const h = (o.kind === 'low' ? 18 : 34) * scale;
        const y = o.y;
        ctx.fillStyle = o.kind === 'low' ? '#f59e0b' : '#ef4444';
        roundRect(ctx, ox - w / 2, y - h, w, h, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.fillRect(ox - w / 2 + 5, y - h + 5, w - 10, 3);
      }

      const py = GROUND_Y - jumpY;
      ctx.fillStyle = '#fafafa';
      roundRect(ctx, x - 13, py - 34, 26, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      roundRect(ctx, x - 10, py - 45, 20, 18, 8);
      ctx.fill();
      ctx.fillStyle = '#18181b';
      ctx.fillRect(x - 5, py - 39, 3, 3);
      ctx.fillRect(x + 4, py - 39, 3, 3);

      if (over) {
        ctx.fillStyle = 'rgba(24,24,27,0.78)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '700 18px ui-sans-serif, system-ui';
        ctx.fillText('Crash', WIDTH / 2, HEIGHT / 2 - 10);
        ctx.font = '500 11px ui-sans-serif, system-ui';
        ctx.fillText('Tap or press Space to restart', WIDTH / 2, HEIGHT / 2 + 14);
        ctx.textAlign = 'start';
      }
    };

    const moveLane = (dir: -1 | 1) => {
      targetLane = Math.max(0, Math.min(2, targetLane + dir));
    };

    const step = () => {
      if (!over) {
        if (input.current.left) {
          moveLane(-1);
          input.current.left = false;
        }
        if (input.current.right) {
          moveLane(1);
          input.current.right = false;
        }
        if (input.current.jump && jumpY === 0) {
          jumpV = 8.8;
          input.current.jump = false;
        }

        x += (LANES[targetLane] - x) * 0.24;
        if (Math.abs(LANES[targetLane] - x) < 1) lane = targetLane;
        if (jumpY > 0 || jumpV > 0) {
          jumpY += jumpV;
          jumpV -= 0.52;
          if (jumpY < 0) {
            jumpY = 0;
            jumpV = 0;
          }
        }

        speed += 0.0018;
        score += 1;
        spawn -= speed;
        if (spawn <= 0) {
          const lastLane = obstacles[obstacles.length - 1]?.lane;
          let nextLane = Math.floor(Math.random() * 3);
          if (Math.random() > 0.65 && lastLane !== undefined)
            nextLane = (lastLane + 1 + Math.floor(Math.random() * 2)) % 3;
          obstacles.push({ lane: nextLane, y: 90, kind: Math.random() > 0.58 ? 'low' : 'barrier' });
          spawn = 72 + Math.random() * 54 - Math.min(32, speed * 4);
        }
        obstacles = obstacles
          .map((o) => ({ ...o, y: o.y + speed * (0.65 + o.y / HEIGHT) }))
          .filter((o) => o.y < HEIGHT + 40);

        for (const o of obstacles) {
          const nearY = o.y > GROUND_Y - 38 && o.y < GROUND_Y + 14;
          // Use the player's actual x position (which lerps between lanes)
          // rather than the lane index — `lane` only updates after the
          // transition completes, so checking by lane caused the player
          // to die in the lane they were leaving even after they'd
          // visually moved past it.
          const sameLane = Math.abs(x - LANES[o.lane]) < 20;
          // Low obstacles render at height ≈ 18 * scale where scale grows
          // with depth; clearance threshold needs to match the rendered
          // peak height plus a small margin. 36px reliably clears low
          // obstacles at all on-screen scales.
          const clearsLow = o.kind === 'low' && jumpY > 36;
          if (nearY && sameLane && !clearsLow) {
            over = true;
            overRef.current = true;
          }
        }
      }

      draw();
      raf = requestAnimationFrame(step);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Skip when the user is typing in a form field elsewhere on the page.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const consumed =
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === ' ' ||
        e.key === 'Enter' ||
        e.key.toLowerCase() === 'a' ||
        e.key.toLowerCase() === 'd' ||
        e.key.toLowerCase() === 'w';
      if (consumed) e.preventDefault();
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') input.current.left = true;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') input.current.right = true;
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') input.current.jump = true;
      if ((e.key === ' ' || e.key === 'Enter') && over) reset();
    };

    window.addEventListener('keydown', onKeyDown);
    step();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [runId]);

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
      style={{ width: WIDTH, height: HEIGHT }}
    >
      <GameExitButton onExit={onExit} />
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="block bg-zinc-50"
        onPointerDown={(e) => {
          // Single-tap restart only when the game is over. During play,
          // pointer-down begins a swipe/tap input.
          if (overRef.current) {
            setRunId((n) => n + 1);
            return;
          }
          touchStart.current = { x: e.clientX, y: e.clientY };
          if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 18) input.current[dx < 0 ? 'left' : 'right'] = true;
          else input.current.jump = true;
        }}
      />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
