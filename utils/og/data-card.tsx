import {
  BrandRow,
  LedgerFooter,
  OG_FAINT,
  OG_HAIRLINE,
  OG_INK,
  OG_MUTED,
  OG_PAD_X,
  SectionLabel,
  SheetFrame,
} from './sheet';

/**
 * Shared satori primitives for data-driven og cards (validator health,
 * transaction, address, block): a red section label, a mono identifier line,
 * a hero figure, and a hairline ledger row of stat cells.
 */

export function MonoLine({ text, size = 26 }: { text: string; size?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        marginTop: 18,
        fontFamily: 'Geist-Mono',
        fontSize: size,
        letterSpacing: 0.5,
        color: OG_INK,
      }}
    >
      {text}
    </div>
  );
}

export function Hero({
  text,
  sub,
  color = OG_INK,
  size = 106,
}: {
  text: string;
  sub: string;
  color?: string;
  size?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          marginTop: 26,
          fontFamily: 'Geist-Medium',
          fontSize: size,
          letterSpacing: -3,
          color,
          lineHeight: 1,
        }}
      >
        {text}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 12,
          fontFamily: 'Geist-Mono',
          fontSize: 15,
          letterSpacing: 3,
          color: OG_MUTED,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

export function StatCell({
  label,
  value,
  valueColor = OG_INK,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          fontFamily: 'Geist-Mono',
          fontSize: 14,
          letterSpacing: 2.5,
          color: OG_FAINT,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 8,
          fontFamily: 'Geist-Mono',
          fontSize: 22,
          letterSpacing: 1,
          color: valueColor,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function LedgerRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        marginTop: 28,
        paddingTop: 22,
        borderTop: `1.5px solid ${OG_HAIRLINE}`,
        gap: 64,
        maxWidth: 1000,
      }}
    >
      {children}
    </div>
  );
}

export function DataCard({
  label,
  footerRight,
  children,
}: {
  label: string;
  footerRight: string;
  children: React.ReactNode;
}) {
  return (
    <SheetFrame>
      <BrandRow />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'center',
          padding: `0 ${OG_PAD_X}px`,
        }}
      >
        <SectionLabel text={label} />
        {children}
      </div>
      <LedgerFooter left="BUILD.AVAX.NETWORK/EXPLORER" right={footerRight} />
    </SheetFrame>
  );
}
