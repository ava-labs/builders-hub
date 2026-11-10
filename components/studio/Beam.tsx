'use client';

import { useId, useSyncExternalStore } from 'react';
import { BorderBeam, type BorderBeamColorVariant } from 'border-beam';
import { useTheme } from 'next-themes';

const noop = () => () => {};

/** Beam colours: the package's presets, plus 'avalanche', its mono beam tinted Avalanche red. */
export type ComposerBeamColor = BorderBeamColorVariant | 'avalanche';

/**
 * The package has no custom-colour option and its mono layers are hard-coded greys. This matrix maps each grey level
 * straight onto Avalanche red (#E84142 at the beam's usual brightness); CSS hue-rotate only approximates and lands on orange.
 */
const AVALANCHE_MATRIX = '0.44 0.44 0.44 0 0  0.123 0.123 0.123 0 0  0.125 0.125 0.125 0 0  0 0 0 1 0';

const tintCss = (filterId: string) => `
[data-beam="{id}"]::before,
[data-beam="{id}"]::after,
[data-beam="{id}"] [data-beam-bloom] {
  filter: url(#${filterId}) !important;
}`;

/** The animated border beam around a composer; it runs the whole time the box is on screen. */
export function ComposerBeam({
  className,
  colorVariant = 'mono',
  children,
}: {
  className?: string;
  colorVariant?: ComposerBeamColor;
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  // The theme is only known in the browser; render the server's light beam until hydration is done.
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const avalanche = colorVariant === 'avalanche';
  const filterId = `beam-tint-${useId().replace(/:/g, '')}`;

  return (
    <>
      {avalanche && (
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={AVALANCHE_MATRIX} />
          </filter>
        </svg>
      )}
      <BorderBeam
        size="pulse-inner"
        colorVariant={avalanche ? 'mono' : colorVariant}
        staticColors={avalanche}
        css={avalanche ? tintCss(filterId) : undefined}
        theme={hydrated && resolvedTheme === 'dark' ? 'dark' : 'light'}
        borderRadius={0}
        className={className}
      >
        {children}
      </BorderBeam>
    </>
  );
}
