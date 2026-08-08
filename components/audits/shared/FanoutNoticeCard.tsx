import { BlocksArt } from "@/components/audits/shared/BlocksArt";

// The step-4 fan-out notice (design 1b/1c): a dark card in BOTH themes, copy
// verbatim from the design package. Do not reword. The mono footer line moved
// to the wizard footer (round 2 board R-1), restoring step 4's footer anchor.
export function FanoutNoticeCard() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#121212] p-5 text-left">
      <BlocksArt variant="corner" palette="plate" className="absolute right-0 top-0" />
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#A2AFB2]">
        Fan-out · whitelist only
      </p>
      <p className="v2-display mt-2 text-[19px] text-white">Sent to all whitelisted auditors.</p>
      <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-[#A2AFB2]">
        Your request reaches every firm on the Ava Labs approved list at once · that&apos;s what
        makes the quotes competitive. Quotes are visible only to you and the Ava Labs program
        admins. Nothing is published.
      </p>
    </div>
  );
}
