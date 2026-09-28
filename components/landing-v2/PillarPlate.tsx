"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import PillarDiagram from "@/components/landing-v2/PillarDiagrams";
import { PILLARS, type PillarSlug } from "@/components/landing-v2/pillars";
import { pad2 } from "@/components/landing-v2/SpecKit";
import { photoOverlay } from "@/components/landing-v2/PhotoOverlays";
import PlateVideo, { type PlateVideoSpec } from "@/components/landing-v2/PlateVideo";

/* ------------------------------------------------------------------ */
/* Plates: a photograph (or graphite ground) with a drawing laid on top */
/*                                                                      */
/* Always 4:5, the shape the photographs are generated in, so the frame */
/* never crops them. The photo sits under a dark scrim and drifts in a  */
/* slow zoom; the drawing renders in its dark palette above it.         */
/* ------------------------------------------------------------------ */

const PHOTOS: Partial<Record<PillarSlug, string>> = {
  interoperability: "/images/solutions/delta-districts.jpg",
  performance: "/images/solutions/f1-finality.jpg",
  privacy: "/images/solutions/glass-boardroom.jpg",
  compliance: "/images/solutions/vault-lock.jpg",
};

// pillars whose plate is a silent loop; the photo above is its poster
const VIDEOS: Partial<Record<PillarSlug, PlateVideoSpec>> = {
  performance: {
    mp4: "/videos/solutions/f1-finality.mp4",
    webm: "/videos/solutions/f1-finality.webm",
    poster: "/images/solutions/f1-finality.jpg",
  },
  compliance: {
    mp4: "/videos/solutions/vault-lock.mp4",
    webm: "/videos/solutions/vault-lock.webm",
    poster: "/images/solutions/vault-lock.jpg",
  },
};

/** What a plate is made of, for callers that layer the parts themselves. */
export interface PlateSpec {
  photo?: string;
  video?: PlateVideoSpec;
  drawing: React.ReactNode;
  caption: [string, string];
}

export function Plate({
  photo,
  video,
  caption,
  priority = false,
  className,
  children,
}: {
  photo?: string;
  video?: PlateVideoSpec;
  caption?: [string, string];
  priority?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <figure className={cn("relative aspect-[4/5] w-full overflow-hidden bg-zinc-950", className)}>
      {/* photo, scrim, and drawing drift as one, so a drawing traced onto
          its photo never slides off its features */}
      <motion.div
        data-plate
        className="absolute inset-0"
        // footage already moves; only stills get the slow drift
        animate={reducedMotion || video ? undefined : { scale: [1, 1.05] }}
        transition={{ duration: 22, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      >
        {video ? (
          <PlateVideo video={video} priority={priority} />
        ) : photo ? (
          <Image
            src={photo}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#2a2d33_0%,#101113_70%)]"
          />
        )}
        {/* scrim and vignette: the photograph becomes ground for the drawing */}
        <div aria-hidden className="absolute inset-0 bg-zinc-950/35" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(9,9,11,0.75)_100%)]"
        />
        <div className="dark absolute inset-0 flex items-center justify-center px-[9%] py-[14%] [&_svg]:max-w-none">
          {children}
        </div>
      </motion.div>
      {caption && (
        <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between px-6 py-5 text-[12px] text-white/60">
          <span className="tabular-nums">{caption[0]}</span>
          <span>{caption[1]}</span>
        </figcaption>
      )}
    </figure>
  );
}

/** A pillar's plate parts: its photograph (once one exists), drawing, caption. */
export function pillarPlate(slug: PillarSlug): PlateSpec {
  const index = PILLARS.findIndex((p) => p.slug === slug);
  const label = PILLARS[index].label;
  return {
    photo: PHOTOS[slug],
    video: VIDEOS[slug],
    // a photographed pillar gets its drawing surveyed onto the photo;
    // one still waiting for its photo keeps the schematic drawing
    drawing: PHOTOS[slug] ? photoOverlay(slug) : <PillarDiagram slug={slug} />,
    caption: [`${pad2(index + 1)} / ${pad2(PILLARS.length)}`, label.charAt(0) + label.slice(1).toLowerCase()],
  };
}

/** A pillar's plate, assembled. */
export default function PillarPlate({
  slug,
  priority = false,
  className,
}: {
  slug: PillarSlug;
  priority?: boolean;
  className?: string;
}) {
  const { photo, video, drawing, caption } = pillarPlate(slug);
  return (
    <Plate photo={photo} video={video} caption={caption} priority={priority} className={className}>
      {drawing}
    </Plate>
  );
}
