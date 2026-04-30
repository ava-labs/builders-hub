'use client';

import { useEffect, useRef, useState } from 'react';
import { GameExitButton } from './GameExitButton';

const WIDTH = 280;
const HEIGHT = 500;
const PLAYER = 22;
const GRAVITY = 0.34;
const JUMP = -9.4;
const MOVE = 3.4;

type Platform = { x: number; y: number; w: number; moving: boolean; vx: number };
type Keys = { left: boolean; right: boolean };

function makePlatform(y: number, moving = false): Platform {
  return {
    x: 18 + Math.random() * (WIDTH - 92),
    y,
    w: 54 + Math.random() * 22,
    moving,
    vx: moving ? (Math.random() > 0.5 ? 0.8 : -0.8) : 0,
  };
}

export function AvaxJumper({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef<Keys>({ left: false, right: false });
  const touchStart = useRef<number | null>(null);
  // Mirror of the loop's `over` flag, exposed to the React JSX pointer
  // handler so a single tap on the canvas can trigger a restart only
  // when the game is actually over (not mid-play).
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
    let bestY = 0;
    let player = { x: WIDTH / 2 - PLAYER / 2, y: HEIGHT - 96, vx: 0, vy: JUMP };
    let platforms: Platform[] = [
      { x: WIDTH / 2 - 36, y: HEIGHT - 42, w: 72, moving: false, vx: 0 },
      ...Array.from({ length: 9 }, (_, i) => makePlatform(HEIGHT - 95 - i * 55, i > 3 && i % 3 === 0)),
    ];

    const reset = () => {
      over = false;
      overRef.current = false;
      score = 0;
      bestY = 0;
      // Reset input flags too — without this, holding left/right when the
      // game ends and re-pressing nothing on restart leaves the player
      // drifting against phantom input from the prior run.
      keys.current.left = false;
      keys.current.right = false;
      player = { x: WIDTH / 2 - PLAYER / 2, y: HEIGHT - 96, vx: 0, vy: JUMP };
      platforms = [
        { x: WIDTH / 2 - 36, y: HEIGHT - 42, w: 72, moving: false, vx: 0 },
        ...Array.from({ length: 9 }, (_, i) => makePlatform(HEIGHT - 95 - i * 55, i > 3 && i % 3 === 0)),
      ];
    };

    const drawBg = () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, '#fff7f7');
      gradient.addColorStop(1, '#f4f4f5');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.08)';
      for (let y = 20; y < HEIGHT; y += 34) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }
    };

    const draw = () => {
      drawBg();
      ctx.fillStyle = '#dc2626';
      ctx.font = '700 14px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(String(score), 14, 28);

      for (const p of platforms) {
        ctx.fillStyle = p.moving ? '#0f766e' : '#27272a';
        roundRect(ctx, p.x, p.y, p.w, 8, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        roundRect(ctx, p.x + 5, p.y + 2, Math.max(10, p.w - 10), 2, 2);
        ctx.fill();
      }

      ctx.fillStyle = '#ef4444';
      roundRect(ctx, player.x, player.y, PLAYER, PLAYER, 7);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(player.x + 6, player.y + 7, 4, 4);
      ctx.fillRect(player.x + 14, player.y + 7, 4, 4);

      if (over) {
        ctx.fillStyle = 'rgba(24,24,27,0.78)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '700 18px ui-sans-serif, system-ui';
        ctx.fillText('Fall out', WIDTH / 2, HEIGHT / 2 - 10);
        ctx.font = '500 11px ui-sans-serif, system-ui';
        ctx.fillText('Tap or press Space to restart', WIDTH / 2, HEIGHT / 2 + 14);
        ctx.textAlign = 'start';
      }
    };

    const step = () => {
      if (!over) {
        player.vx = keys.current.left ? -MOVE : keys.current.right ? MOVE : player.vx * 0.82;
        player.x += player.vx;
        player.y += player.vy;
        player.vy += GRAVITY;
        if (player.x < -PLAYER) player.x = WIDTH;
        if (player.x > WIDTH) player.x = -PLAYER;

        for (const p of platforms) {
          if (p.moving) {
            p.x += p.vx;
            if (p.x < 8 || p.x + p.w > WIDTH - 8) p.vx *= -1;
          }
          const falling = player.vy > 0;
          const overlapsX = player.x + PLAYER > p.x && player.x < p.x + p.w;
          const lands = player.y + PLAYER >= p.y && player.y + PLAYER <= p.y + 12;
          if (falling && overlapsX && lands) player.vy = JUMP;
        }

        if (player.y < HEIGHT * 0.38) {
          const lift = HEIGHT * 0.38 - player.y;
          player.y += lift;
          bestY += lift;
          score = Math.max(score, Math.floor(bestY / 8));
          platforms = platforms.map((p) => ({ ...p, y: p.y + lift }));
        }

        platforms = platforms.filter((p) => p.y < HEIGHT + 20);
        // Spread.min over an empty array returns +Infinity, which would
        // make the while-loop spawn at -Infinity forever and freeze the
        // tab. Guard with an explicit seed if the array is somehow empty.
        if (platforms.length === 0) {
          platforms.push({ x: WIDTH / 2 - 36, y: HEIGHT / 2, w: 72, moving: false, vx: 0 });
        }
        while (platforms.length < 10) {
          const highest = Math.min(...platforms.map((p) => p.y));
          platforms.push(makePlatform(highest - 48 - Math.random() * 18, score > 80 && Math.random() > 0.55));
        }

        if (player.y > HEIGHT + 40) {
          over = true;
          overRef.current = true;
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
        e.key === ' ' ||
        e.key === 'Enter' ||
        e.key.toLowerCase() === 'a' ||
        e.key.toLowerCase() === 'd';
      if (consumed) e.preventDefault();
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.current.left = true;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.current.right = true;
      if ((e.key === ' ' || e.key === 'Enter') && over) reset();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.current.left = false;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.current.right = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    step();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
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
          // Single-tap restart only when the game is actually over —
          // bumping runId remounts the effect with a fresh game state.
          // Mid-play taps are tilt input, not restart triggers.
          if (overRef.current) {
            setRunId((n) => n + 1);
            return;
          }
          touchStart.current = e.clientX;
          if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (touchStart.current === null) return;
          keys.current.left = e.clientX < touchStart.current - 8;
          keys.current.right = e.clientX > touchStart.current + 8;
        }}
        onPointerUp={() => {
          touchStart.current = null;
          keys.current.left = false;
          keys.current.right = false;
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
