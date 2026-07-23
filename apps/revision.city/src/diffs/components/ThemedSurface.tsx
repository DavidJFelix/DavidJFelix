import type { CSSProperties, ElementType, ReactNode } from 'react';

import { useChromeThemeProps } from './use-chrome-theme-props';
import type { ChromeMapping } from '@/diffs/lib/theme/chrome-theme-props';
import { diffsChromeMapping } from '@/diffs/lib/theme/diffs-chrome-mapping';
import type { ThemeInput } from '@/diffs/lib/theme/theme-source';

interface ThemedSurfaceProps {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  mapping?: ChromeMapping;
  style?: CSSProperties;
  theme?: ThemeInput;
}

// A themed chrome host. Renders `as` (default div) with the chrome style applied
// from the active theme via the given mapping (default diffsChromeMapping).
// Caller `style` (spread after) still wins on key collisions.
export function ThemedSurface({
  as,
  children,
  className,
  mapping = diffsChromeMapping,
  style,
  theme,
}: ThemedSurfaceProps) {
  const Component = as ?? 'div';
  const themeProps = useChromeThemeProps(mapping, theme);
  return (
    <Component className={className} style={{ ...themeProps.style, ...style }}>
      {children}
    </Component>
  );
}
