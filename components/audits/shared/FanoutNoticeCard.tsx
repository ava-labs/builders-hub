// The step-4 fan-out notice (design 1b/1c): a dark card in BOTH themes, copy
// verbatim from the design package. Do not reword.
export function FanoutNoticeCard() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121212] p-5 text-left">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#A2AFB2]">
        Fan-out · whitelist only
      </p>
      <p className="mt-2 text-lg font-semibold text-white">Sent to all whitelisted auditors.</p>
      <p className="mt-2 text-sm leading-relaxed text-[#A2AFB2]">
        Your request reaches every firm on the Ava Labs approved list at once · that&apos;s what
        makes the quotes competitive. Quotes are visible only to you and the Ava Labs program
        admins. Nothing is published.
      </p>
      <p className="mt-4 border-t border-white/10 pt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#A2AFB2]">
        Free · no fees · subsidy reviewed after quotes arrive
      </p>
    </div>
  );
}
