'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Procedural background-music engine for the "play while you wait" mini-games
 * shown in BasicSetupProgress. Owns a single AudioContext + master gain that
 * survives game-swap remounts inside `AvaxGame`, so the loop continues
 * uninterrupted across kind changes.
 *
 * Design notes:
 * - Always starts muted on every session. No persistence — quiet by default
 *   matches the developer-tool context (offices, calls, headphones plugged
 *   into something else) and avoids the "I muted months ago and forgot"
 *   silent-deny pitfall that surfaced via the inverse persistence design.
 * - AudioContext is created lazily on the first user gesture (mute toggle).
 *   iOS Safari throws if you `new AudioContext()` before any gesture.
 * - Sequencer is a single setInterval scheduling fresh oscillators per
 *   step. ~300ms granularity drift over a 3-min deploy is inaudible.
 * - All gain transitions ramp via setTargetAtTime / exponentialRampToValueAtTime
 *   to a 0.0001 floor — never to zero, which produces clicks on iOS.
 * - Tab visibility suspends/resumes the context (only resumes if unmuted).
 *   `visibilitychange` is preferred over `blur`, which fires on devtools.
 * - `playLoseSound()` is fired by each game on its `'over'` transition.
 *   Respects the mute state — if the user has muted music, the lose sound
 *   stays silent too. The mute button is the user's "no audio" signal.
 */

const MASTER_VOLUME = 0.1;
const FADE_TC = 0.12; // setTargetAtTime time constant (~120ms to reach target)
const FADE_OUT_MS = 400;

const ATTACK_S = 0.005;
const RELEASE_S = 0.08;
const GAIN_FLOOR = 0.0001;

const STEP_MS = 300; // 100 BPM, 1/8 notes
const NOTE_DURATION_S = (STEP_MS / 1000) * 0.85;
const BASS_HOLD_FACTOR = 4;

const LEAD_GAIN = 0.7;
const BASS_GAIN = 0.5;

// Lose-sound: descending sawtooth chirp 440Hz → 110Hz over 600ms with a
// short attack. Reads as "wah-wah-fail" without sounding harsh.
const LOSE_SOUND_FROM_HZ = 440;
const LOSE_SOUND_TO_HZ = 110;
const LOSE_SOUND_DURATION_S = 0.6;
const LOSE_SOUND_PEAK_GAIN = 0.45;

// 16-step loop in G major. Ascending melodic arc with a descending answer
// and a brief lead-in at step 9. `null` = rest. Bass alternates root/fifth.
const LEAD: ReadonlyArray<number | null> = [
  392.0,
  493.88,
  587.33,
  null,
  659.25,
  587.33,
  493.88,
  392.0,
  440.0,
  523.25,
  659.25,
  null,
  587.33,
  523.25,
  440.0,
  392.0,
];

const BASS: ReadonlyArray<number | null> = [
  98.0,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  146.83,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

type Ctx = {
  muted: boolean;
  toggleMute: () => void;
  isReady: boolean;
  playLoseSound: () => void;
};

const GameAudioContext = createContext<Ctx | null>(null);

export function GameAudioProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const stepRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sequencerRunning = useRef(false);

  // Mirror muted in a ref so the visibility / lose-sound handlers see the
  // current value without resubscribing.
  const mutedRef = useRef(true);
  mutedRef.current = muted;

  const ensureCtx = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    if (typeof window === 'undefined') return null;
    try {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(GAIN_FLOOR, ctx.currentTime);
      gain.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = gain;
      return ctx;
    } catch {
      return null;
    }
  }, []);

  const scheduleNote = useCallback(
    (freq: number, type: OscillatorType, when: number, durationS: number, voiceGain: number) => {
      const ctx = ctxRef.current;
      const master = gainRef.current;
      if (!ctx || !master) return;
      let osc: OscillatorNode;
      let env: GainNode;
      try {
        osc = ctx.createOscillator();
        env = ctx.createGain();
      } catch {
        return;
      }
      osc.type = type;
      osc.frequency.setValueAtTime(freq, when);
      // ADSR via exponential ramps to GAIN_FLOOR (never literally 0).
      env.gain.setValueAtTime(GAIN_FLOOR, when);
      env.gain.exponentialRampToValueAtTime(voiceGain, when + ATTACK_S);
      const sustainEnd = Math.max(when + ATTACK_S + 0.001, when + durationS - RELEASE_S);
      env.gain.setValueAtTime(voiceGain, sustainEnd);
      env.gain.exponentialRampToValueAtTime(GAIN_FLOOR, when + durationS);
      osc.connect(env);
      env.connect(master);
      try {
        osc.start(when);
        osc.stop(when + durationS + 0.05);
      } catch {
        // Context may have been closed between create and start.
      }
    },
    [],
  );

  const tick = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const i = stepRef.current;
    const t = ctx.currentTime;
    const lead = LEAD[i];
    const bass = BASS[i];
    if (lead != null) scheduleNote(lead, 'triangle', t, NOTE_DURATION_S, LEAD_GAIN);
    if (bass != null) scheduleNote(bass, 'sine', t, NOTE_DURATION_S * BASS_HOLD_FACTOR, BASS_GAIN);
    stepRef.current = (i + 1) % LEAD.length;
  }, [scheduleNote]);

  const startSequencer = useCallback(() => {
    if (sequencerRunning.current) return;
    sequencerRunning.current = true;
    stepRef.current = 0;
    tick();
    intervalRef.current = setInterval(tick, STEP_MS);
  }, [tick]);

  const stopSequencer = useCallback(() => {
    sequencerRunning.current = false;
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fadeIn = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const gain = gainRef.current;
    if (!gain) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(MASTER_VOLUME, ctx.currentTime, FADE_TC);
    startSequencer();
    setIsReady(true);
  }, [ensureCtx, startSequencer]);

  const fadeOut = useCallback(() => {
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(GAIN_FLOOR, ctx.currentTime, FADE_TC);
    // Let the fade settle, then stop the sequencer to save CPU.
    setTimeout(() => {
      if (mutedRef.current) stopSequencer();
    }, FADE_OUT_MS);
  }, [stopSequencer]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (!next) {
        fadeIn();
      } else {
        fadeOut();
      }
      return next;
    });
  }, [fadeIn, fadeOut]);

  // Lose sound — short descending pitch sweep, played over the music.
  // Skipped when muted so the mute button remains the single source of
  // truth for "I want silence". Uses the master gain bus, so the music's
  // current volume modulates the sting (sting is louder when music is on,
  // inaudible when faded out).
  const playLoseSound = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = ctxRef.current;
    const master = gainRef.current;
    if (!ctx || !master || ctx.state === 'closed') return;
    let osc: OscillatorNode;
    let env: GainNode;
    try {
      osc = ctx.createOscillator();
      env = ctx.createGain();
    } catch {
      return;
    }
    const t = ctx.currentTime;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(LOSE_SOUND_FROM_HZ, t);
    osc.frequency.exponentialRampToValueAtTime(LOSE_SOUND_TO_HZ, t + LOSE_SOUND_DURATION_S);
    env.gain.setValueAtTime(GAIN_FLOOR, t);
    env.gain.exponentialRampToValueAtTime(LOSE_SOUND_PEAK_GAIN, t + 0.02);
    env.gain.exponentialRampToValueAtTime(GAIN_FLOOR, t + LOSE_SOUND_DURATION_S);
    osc.connect(env);
    env.connect(master);
    try {
      osc.start(t);
      osc.stop(t + LOSE_SOUND_DURATION_S + 0.05);
    } catch {
      // Context may have been closed between create and start.
    }
  }, []);

  // Pause on tab hide; resume only if the user had it unmuted.
  useEffect(() => {
    const onVisibility = () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (document.hidden) {
        ctx.suspend().catch(() => {});
      } else if (!mutedRef.current) {
        ctx.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Final teardown — instant gain=0 (no tail) then close().
  useEffect(() => {
    return () => {
      sequencerRunning.current = false;
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const ctx = ctxRef.current;
      const gain = gainRef.current;
      if (ctx && gain) {
        try {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(GAIN_FLOOR, ctx.currentTime);
          ctx.close().catch(() => {});
        } catch {
          /* ignore */
        }
      }
      ctxRef.current = null;
      gainRef.current = null;
    };
  }, []);

  const value: Ctx = { muted, toggleMute, isReady, playLoseSound };

  return <GameAudioContext.Provider value={value}>{children}</GameAudioContext.Provider>;
}

export function useGameAudio(): Ctx {
  const ctx = useContext(GameAudioContext);
  if (!ctx) {
    // Safe fallback so games rendered outside the provider don't crash.
    return { muted: true, toggleMute: () => {}, isReady: false, playLoseSound: () => {} };
  }
  return ctx;
}
