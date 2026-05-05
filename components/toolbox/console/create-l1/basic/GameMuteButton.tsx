'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useGameAudio } from './useGameAudio';

/**
 * Sibling of GameExitButton, sits immediately to its right. Toggles the
 * shared procedural background loop owned by GameAudioProvider.
 *
 * `stopPropagation` for the same reason as GameExitButton — game canvases
 * have an outer onClick that triggers jump/flap/restart and would also fire
 * on a bubble.
 *
 * Faded opacity until first user gesture has unlocked the AudioContext, so
 * the icon visually communicates "available but not yet engaged" rather
 * than feeling like a regular button that does nothing on first press.
 */
export function GameMuteButton() {
  const { muted, toggleMute, isReady } = useGameAudio();

  const Icon = muted ? VolumeX : Volume2;
  const label = muted ? 'Unmute background music' : 'Mute background music';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleMute();
      }}
      aria-pressed={!muted}
      aria-label={label}
      title={label}
      className={`absolute top-2 left-[88px] z-20 flex items-center justify-center rounded-md border border-zinc-300/80 dark:border-zinc-700/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm px-1.5 py-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors ${
        muted && !isReady ? 'opacity-60' : 'opacity-100'
      }`}
    >
      <Icon className="h-3 w-3" aria-hidden />
    </button>
  );
}
