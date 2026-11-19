"use client";

import Link from "next/link";
import { PILLS, pill } from "@/components/explorer-v2/network/defi-switch";
import { RWA_VIEWS, type RwaSlug } from "./rwa-views";

/* The RWA view's facility switch, in the DeFi switch's pills beside it:
   one link per facility, in the views' order, each to the facility's own
   page. No visible label: OatFi's section rail already has a Facility tab. */

export function FacilitySwitch({ on }: { on: RwaSlug }) {
  return (
    <nav aria-label="RWA facility" className={PILLS}>
      {Object.values(RWA_VIEWS).map((v) => {
        const active = v.facility.slug === on;
        return (
          <Link
            key={v.facility.slug}
            href={v.href}
            aria-current={active ? "page" : undefined}
            className={pill(active)}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
