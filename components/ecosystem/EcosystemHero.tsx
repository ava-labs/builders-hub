'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { EASE, MaskText } from '@/components/landing-v2/SpecKit';

/* The header: a base camp under the peaks, full-bleed across the sheet,
   the title on the open snowfield to its left. Tents and paths lead to
   one hall, and its beacon is the only red in the photograph. As on the
   /solutions hero, the desktop band holds the photograph's own aspect,
   so the glow pins to the beacon's pixel, and the band zooms toward it
   as the page scrolls away. Phones get a taller crop on the camp. */

// the beacon's centre in the photograph (3168x1344), measured from its red pixels
const BEACON = { x: '81.47%', y: '40.41%' };

export default function EcosystemHero() {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  return (
    <section ref={ref} className="relative -mx-5 -mt-14 overflow-hidden bg-zinc-950 md:-mx-6 md:-mt-20">
      <div className="relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-[3168/1344]">
        {/* zoom origin sits on the beacon, so it holds still: 61% of the phone crop, the photo's own spot above */}
        <motion.div
          className="absolute inset-0 origin-[61%_40.41%] sm:origin-[81.47%_40.41%]"
          style={reducedMotion ? undefined : { scale }}
        >
          <motion.div
            className="absolute inset-0 origin-[61%_40.41%] sm:origin-[81.47%_40.41%]"
            initial={reducedMotion ? false : { scale: 1.06, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 2.4, ease: EASE }}
          >
            <Image
              src="/images/ecosystem/base-camp.webp"
              alt="A base camp of lit tents on a snowfield below a mountain range, its paths leading to one hall with a red beacon"
              fill
              priority
              // the band is 90rem at most; a phone or tablet crop draws the photo 295vw or 148vw wide
              sizes="(min-width: 90rem) 90rem, (min-width: 64rem) 100vw, (min-width: 40rem) 148vw, 295vw"
              className="object-cover object-[92%_50%] sm:object-[82%_50%] lg:object-center"
            />
            {/* the beacon breathes: red is the thing that is alive */}
            <motion.span
              aria-hidden
              className="absolute hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E6212F] blur-xl lg:block"
              style={{ left: BEACON.x, top: BEACON.y }}
              initial={{ opacity: 0.2 }}
              animate={reducedMotion ? undefined : { opacity: [0.2, 0.55, 0.2] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        </motion.div>

        {/* scrims: the fog darkens under the words, the foot into the page */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-zinc-950/20 via-45% to-transparent"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-transparent via-40% to-transparent"
        />

        <div className="absolute inset-0 flex flex-col px-5 py-12 md:px-10 lg:px-14 lg:py-16">
          <h1 className="v2-display text-[clamp(2.75rem,7vw,5.5rem)] text-white">
            <MaskText delay={0.3}>
              Ecosystem
              <span aria-hidden className="text-[#E6212F]">
                .
              </span>
            </MaskText>
          </h1>
          <motion.p
            className="mt-auto max-w-[20rem] text-[15px] leading-relaxed text-white/80 md:text-base"
            initial={reducedMotion ? false : { opacity: 0, filter: 'blur(10px)', y: 8 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ duration: 1.4, delay: 1.1, ease: EASE }}
          >
            Events, programs, guides and tools for builders on Avalanche.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
