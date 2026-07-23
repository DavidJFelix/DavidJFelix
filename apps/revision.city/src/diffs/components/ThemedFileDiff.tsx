import { FileDiff, type FileDiffProps } from '@pierre/diffs/react';
import { useMemo } from 'react';

import { useDiffThemeProps } from './use-diff-theme-props';
import { useWorkerDiffTheme } from './use-worker-diff-theme';
import type { DiffThemeInput } from '@/diffs/lib/theme/diff-theme-props';

interface ThemedFileDiffProps<
  LAnnotation = undefined,
> extends FileDiffProps<LAnnotation> {
  // Names-now override (omitted => follow the provider/source).
  theme?: DiffThemeInput;
}

// Sugar over useDiffThemeProps: applies the active theme names + themeType to
// the React <FileDiff> options and keeps the worker pool in step when present.
export function ThemedFileDiff<LAnnotation = undefined>({
  disableWorkerPool = false,
  options,
  theme,
  ...props
}: ThemedFileDiffProps<LAnnotation>) {
  const diffTheme = useDiffThemeProps(theme);
  useWorkerDiffTheme(diffTheme.theme, disableWorkerPool);
  const themedOptions = useMemo(
    () => ({
      ...options,
      theme: diffTheme.theme,
      themeType: options?.themeType ?? diffTheme.themeType,
    }),
    [diffTheme, options]
  );
  return (
    <FileDiff<LAnnotation>
      {...props}
      disableWorkerPool={disableWorkerPool}
      options={themedOptions}
    />
  );
}
