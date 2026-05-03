'use client';

/**
 * Single global keyframe block for the Encrypted ERC surface.
 *
 * Mounted exactly once at the top of `EERCToolShell` so every leaf tool
 * page picks the animations up. Overview previously injected its own copy
 * (≈130 lines of `<style jsx global>`), and `EERCStepNav` shipped a second
 * near-identical block — duplication that drifted in cosmetics whenever
 * one surface tweaked an easing curve. Consolidating here means there is
 * one place to read, audit, or extend the EERC motion vocabulary.
 *
 * Only the animation classes still referenced by the current EERC code
 * survive the move. Decorative-only ones tied to the (now-deleted)
 * CiphertextStream are dropped — see Task 5.4.
 *
 * The wrapping `prefers-reduced-motion` rule disables every animation for
 * users who have requested it. Hover micro-motions are short enough that
 * scaling/translating still feels intentional, but full keyframe loops
 * (`encFlicker`, `keyWobble`, `eyeBlink`, `shieldPulse`, `twinkle`) become
 * static.
 */
export function EERCKeyframes() {
  return (
    <style jsx global>{`
      /* Decorative ciphertext rail in the Overview hero. Renders the
         row block twice and translates by -50% so the seam loops
         invisibly. Pure cosmetic — disabled under reduced-motion. */
      @keyframes ciphertextRoll {
        0% {
          transform: translateY(0);
        }
        100% {
          transform: translateY(-50%);
        }
      }
      .cipher-roll {
        animation: ciphertextRoll 12s linear infinite;
      }

      /* "Live" pulse on chain-connected indicators. */
      @keyframes encFlicker {
        0%,
        100% {
          opacity: 1;
        }
        4% {
          opacity: 0.65;
        }
        6% {
          opacity: 1;
        }
      }
      .enc-flicker {
        animation: encFlicker 4.2s ease-in-out infinite;
      }

      /* Lock shackle lift on hover (hero card). */
      .lock-shackle path:nth-child(1) {
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        transform-origin: center bottom;
      }
      .group:hover .lock-shackle path:nth-child(1) {
        transform: translateY(-2px);
      }

      /* Eye closed ↔ open flip (overview balance / step-nav balance icon). */
      @keyframes eyeBlink {
        0%,
        100% {
          transform: scaleY(1);
        }
        45%,
        50% {
          transform: scaleY(0.15);
        }
      }
      .group:hover .eye-blink {
        animation: eyeBlink 0.6s ease-in-out;
      }

      /* Send icon micro-slide on hover (transfer step). */
      .send-icon {
        transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .group:hover .send-icon {
        transform: translate(2px, -2px);
      }

      /* Arrow slides (deposit / withdraw steps). */
      .arrow-down {
        transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .group:hover .arrow-down {
        transform: translateY(2px);
      }
      .arrow-up {
        transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .group:hover .arrow-up {
        transform: translateY(-2px);
      }

      /* Shield pulse — kept because StepNav's auditor icon uses it. */
      @keyframes shieldPulse {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.08);
        }
      }
      .group:hover .shield-pulse {
        animation: shieldPulse 0.8s ease-in-out;
      }

      /* Key wobble on hover (register step). */
      @keyframes keyWobble {
        0%,
        100% {
          transform: rotate(0deg);
        }
        25% {
          transform: rotate(-12deg);
        }
        75% {
          transform: rotate(12deg);
        }
      }
      .group:hover .key-wobble {
        animation: keyWobble 0.55s ease-in-out;
      }

      /* Sparkle twinkle (Journey card heading). */
      @keyframes twinkle {
        0%,
        100% {
          opacity: 0.3;
          transform: scale(0.85);
        }
        50% {
          opacity: 1;
          transform: scale(1.2);
        }
      }
      .twinkle-a {
        animation: twinkle 2.4s ease-in-out infinite;
      }
      .twinkle-b {
        animation: twinkle 2.4s ease-in-out 0.8s infinite;
      }
      .twinkle-c {
        animation: twinkle 2.4s ease-in-out 1.6s infinite;
      }

      /* Honor the OS-level reduced-motion preference. We disable the
         continuous loops; one-shot hover transitions (the transition
         rules above) are short enough to feel like a tap rather than
         a "motion" — Mac VoiceOver guidance treats sub-second
         transforms as acceptable. */
      @media (prefers-reduced-motion: reduce) {
        .enc-flicker,
        .twinkle-a,
        .twinkle-b,
        .twinkle-c,
        .cipher-roll {
          animation: none !important;
        }
        .group:hover .lock-shackle path:nth-child(1),
        .group:hover .eye-blink,
        .group:hover .send-icon,
        .group:hover .arrow-down,
        .group:hover .arrow-up,
        .group:hover .shield-pulse,
        .group:hover .key-wobble {
          animation: none !important;
          transform: none !important;
        }
      }
    `}</style>
  );
}
