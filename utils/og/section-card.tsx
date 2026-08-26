import {
  BrandRow,
  LedgerFooter,
  OG_INK,
  OG_MUTED,
  OG_PAD_X,
  SectionLabel,
  SheetFrame,
  clampText,
} from './sheet';

export type SectionCardProps = {
  title: string;
  description: string;
  path: string;
  icon?: React.ReactElement;
};

/** Per-section footer lines, derived from each section's own metadata copy. */
const SECTION_TAGLINES: Record<string, string> = {
  docs: 'DOCUMENTATION · GUIDES · REFERENCE',
  academy: 'LEARN BLOCKCHAIN DEVELOPMENT',
  blog: 'TAKEAWAYS · TUTORIALS · ENGINEERING',
  integrations: 'BEST-IN-CLASS INTEGRATIONS',
  events: 'EVENTS · HACKATHONS · CONFERENCES',
  hackathons: 'EVENTS · HACKATHONS · CONFERENCES',
  grants: 'GRANTS · FUNDING OPPORTUNITIES',
  stats: 'LIVE NETWORK DATA',
  explorer: 'BLOCKS · TRANSACTIONS · VALIDATORS',
  console: 'LAUNCH AND OPERATE L1S',
  solutions: 'PERFORMANCE · INTEROP · PRIVACY · COMPLIANCE',
  university: 'STUDENTS · EDUCATORS · RESEARCH',
  showcase: 'PROJECTS FROM THE COMMUNITY',
  tools: 'DEVELOPER TOOLS',
};

export function sectionFromPath(path: string): string {
  const first = path.split('/').filter(Boolean)[0] ?? '';
  return first.toUpperCase();
}

export function taglineFromPath(path: string): string {
  const first = path.split('/').filter(Boolean)[0] ?? '';
  return SECTION_TAGLINES[first] ?? 'ONE NETWORK · TWO WAYS TO BUILD';
}

/**
 * The shared section card: red section label, uppercase Geist-Medium title,
 * mono caps description, dark ledger footer with the canonical path.
 */
export function SectionCard({ title, description, path, icon }: SectionCardProps) {
  const label = sectionFromPath(path);
  // A label the title already carries (bare section cards like "Console", or
  // "Documentation" under DOCS) is noise; it earns its place only when the
  // title is real content. Redundant = title contains the label, or the
  // title's first word shares the label's stem (DOCS vs DOCUMENTATION).
  const normalizedTitle = title.trim().toUpperCase();
  const stem = label.endsWith('S') ? label.slice(0, -1) : label;
  const firstWord = normalizedTitle.split(/[^A-Z0-9-]/)[0] ?? '';
  const showLabel =
    label.length > 0 && !normalizedTitle.includes(label) && !firstWord.startsWith(stem);
  return (
    <SheetFrame>
      <BrandRow />
      <div
        style={{
          display: 'flex',
          flexGrow: 1,
          alignItems: 'center',
          padding: `0 ${OG_PAD_X}px`,
          gap: 44,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, maxWidth: icon ? 810 : 1050 }}>
          {showLabel ? <SectionLabel text={label} /> : null}
          <div
            style={{
              display: 'flex',
              marginTop: showLabel ? 22 : 0,
              fontFamily: 'Geist-Medium',
              fontSize: 58,
              letterSpacing: -1,
              color: OG_INK,
              lineHeight: 1.14,
            }}
          >
            {clampText(title.toUpperCase(), 64)}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 24,
              fontFamily: 'Geist-Mono',
              fontSize: 19,
              letterSpacing: 2.5,
              color: OG_MUTED,
              lineHeight: 1.6,
            }}
          >
            {clampText(description.toUpperCase(), 150)}
          </div>
        </div>
        {icon ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        ) : null}
      </div>
      <LedgerFooter
        left={`BUILD.AVAX.NETWORK/${path.toUpperCase()}`}
        right={taglineFromPath(path)}
      />
    </SheetFrame>
  );
}
