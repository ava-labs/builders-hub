'use client';

import { BorderBeam, type BorderBeamColorVariant } from 'border-beam';
import { useTheme } from 'next-themes';

/** The animated border beam around a composer; it runs the whole time the box is on screen. */
export function ComposerBeam({
  className,
  colorVariant = 'mono',
  children,
}: {
  className?: string;
  colorVariant?: BorderBeamColorVariant;
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();

  return (
    <BorderBeam
      size="pulse-inner"
      colorVariant={colorVariant}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      borderRadius={0}
      className={className}
    >
      {children}
    </BorderBeam>
  );
}
