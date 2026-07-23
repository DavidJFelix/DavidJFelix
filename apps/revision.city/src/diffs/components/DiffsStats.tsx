import { IconSymbolDiffstatFill } from '@pierre/icons';
import { memo, useEffect } from 'react';

import { css } from 'styled-system/css';

import { StatItem } from './StatItem';
import { StatusRow } from './StatusRow';
import type { DiffsStats as DiffsStatsData } from '@/diffs/lib/types';

interface DiffsStatsProps {
  expanded: boolean;
  onToggle(): void;
  stats: DiffsStatsData | null;
  streaming: boolean;
}

export const DiffsStats = memo(function DiffsStats({
  expanded,
  onToggle,
  stats,
  streaming,
}: DiffsStatsProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggle]);

  if (stats == null) {
    return null;
  }

  return (
    <>
      <StatusRow icon={IconSymbolDiffstatFill}>
        <button
          type="button"
          onClick={onToggle}
          className={css({
            color: 'diffs.muted.foreground',
            display: 'flex',
            w: 'full',
            cursor: 'pointer',
            alignItems: 'center',
            gap: '1',
            fontSize: 'sm',
            lineHeight: '1.25rem',
            _hover: { color: 'diffs.foreground' },
            _focus: { outline: 'none' },
          })}
          aria-expanded={expanded}
        >
          Diff Stats
          <span
            className={css({
              color: 'diffs.muted.foreground/50',
              display: { base: 'none', md: 'inline' },
            })}
          >
            (F2)
          </span>
          {streaming && <StreamingIndicator />}
        </button>
      </StatusRow>
      {expanded && (
        <div className={css({ ml: '10', mr: { md: '3' } })}>
          <StatItem
            label="Files"
            value={stats.fileCount}
            valueClassName={css({
              color: 'diffs.foreground',
              fontWeight: 'semibold',
            })}
          />
          <StatItem
            label="Additions"
            value={stats.addedLines}
            valueClassName={css({
              color: 'green.600',
              fontWeight: 'semibold',
              _dark: { color: 'green.400' },
            })}
          />
          <StatItem
            label="Deletions"
            value={stats.deletedLines}
            valueClassName={css({
              color: 'red.600',
              fontWeight: 'semibold',
              _dark: { color: 'red.400' },
            })}
          />
          <StatItem
            label="Lines"
            value={stats.totalLinesOfCode}
            valueClassName={css({
              color: 'diffs.foreground',
              fontWeight: 'semibold',
            })}
          />
        </div>
      )}
    </>
  );
});

function StreamingIndicator() {
  return (
    <span
      className={css({
        mr: '-2',
        ml: 'auto',
        rounded: 'full',
        borderWidth: '1px',
        borderColor: 'yellow.500/40',
        bg: 'yellow.500/10',
        px: '1.5',
        py: '0.5',
        fontSize: '10px',
        lineHeight: '1',
        fontWeight: 'medium',
        letterSpacing: 'wide',
        color: 'yellow.700',
        textTransform: 'uppercase',
        _dark: { color: 'yellow.300' },
      })}
    >
      streaming
    </span>
  );
}
