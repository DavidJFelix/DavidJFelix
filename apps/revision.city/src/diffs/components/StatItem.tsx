import { css, cx } from 'styled-system/css';

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

interface StatItemProps {
  label: string;
  value: string | number;
  valueClassName?: string;
}

export function StatItem({ label, value, valueClassName }: StatItemProps) {
  const isZero = value === 0 || value === '0';
  const formatted =
    typeof value === 'number' ? NUMBER_FORMATTER.format(value) : value;
  return (
    <div
      className={css({
        borderColor: 'diffs.border/75',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: '1px',
        py: '1',
        pr: { base: '4', md: '0' },
        fontSize: '12px',
      })}
    >
      <div className={css({ color: 'diffs.muted.foreground' })}>{label}</div>
      <span
        className={cx(
          css({
            pl: '1ch',
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }),
          valueClassName
        )}
        style={{
          fontFamily: 'var(--font-jetbrains-mono)',
          opacity: isZero ? 0.5 : 1,
        }}
      >
        {formatted}
      </span>
    </div>
  );
}
