import type { CodeViewHandle } from '@pierre/diffs/react';
import {
  IconComment,
  IconFileTree,
  IconFilter,
  IconSearch,
  IconXSquircle,
} from '@pierre/icons';
import { FileTree } from '@pierre/trees';
import type { GitStatus } from '@pierre/trees';
import { useFileTreeSearch } from '@pierre/trees/react';
import {
  type CSSProperties,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { css, cx } from 'styled-system/css';

import { CHROME_ICON_BUTTON_CLASS } from './chrome-button-styles';
import { DiffsCommentsList } from './DiffsCommentsList';
import { DiffsStats } from './DiffsStats';
import { DiffsFileTree } from './DiffsFileTree';
import { useChromeThemeProps } from './use-chrome-theme-props';
import type { ThemeCycleControls } from './use-theme-cycle';
import { WorkerPoolStatus } from './WorkerPoolStatus';
import { Button } from '@/diffs/components/Button';
import { ButtonGroup, ButtonGroupItem } from '@/diffs/components/ButtonGroup';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/diffs/components/DropdownMenu';
import { filterDiffsFileTreeSource } from '@/diffs/lib/filter-diffs-file-tree-source';
import { getDiffsFileTreeAvailableStatuses } from '@/diffs/lib/get-diffs-file-tree-available-statuses';
import { diffsChromeMapping } from '@/diffs/lib/theme/diffs-chrome-mapping';
import { getDropdownThemeStyle } from '@/diffs/lib/theme/dropdown-chrome-style';
import type {
  CommentMetadata,
  DiffsStats as DiffsStatsData,
  DiffsFileTreeSource,
  DiffsSavedCommentEntry,
  DiffsSavedCommentItem,
} from '@/diffs/lib/types';

type SidebarTab = 'files' | 'comments';
type SidebarStatusPanel = 'diffStats' | 'systemMonitor';

const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

// Shared 16/12px icon size for the tab-row toggle buttons (search, filter,
// mobile close), matching the header's own ICON_SIZE_CLASS.
const ICON_SIZE_CLASS = css({
  w: { base: '4', md: '3' },
  h: { base: '4', md: '3' },
});

interface DiffsSidebarProps {
  className?: string;
  commentSections: readonly DiffsSavedCommentItem[];
  diffStats: DiffsStatsData | null;
  mobileOverlayOpen?: boolean;
  onMobileClose(): void;
  onSelectComment(comment: DiffsSavedCommentEntry): void;
  onSelectItem(itemId: string): void;
  scrollRef: RefObject<HTMLDivElement | null>;
  source: DiffsFileTreeSource;
  streaming: boolean;
  themeCycle: ThemeCycleControls;
  viewerRef: RefObject<CodeViewHandle<CommentMetadata> | null>;
}

export const DiffsSidebar = memo(function DiffsSidebar({
  className,
  commentSections,
  diffStats,
  mobileOverlayOpen = false,
  onMobileClose,
  onSelectComment,
  onSelectItem,
  scrollRef,
  source,
  streaming,
  themeCycle,
  viewerRef,
}: DiffsSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('files');
  let totalCommentCount = 0;
  for (const section of commentSections) {
    totalCommentCount += section.comments.length;
  }
  // Pull the resolved Shiki theme so the whole sidebar (tabs row, file
  // tree, diff stats panel, footer) sits on the theme's sidebar surface
  // and its chrome text follows the theme's own foreground tokens
  // instead of an opacity-derived fade of the file-tree's muted text.
  // Shared with the header so both chrome surfaces stay in sync.
  const { style: sidebarChromeStyle } = useChromeThemeProps(
    diffsChromeMapping
  );
  const sidebarStyle =
    Object.keys(sidebarChromeStyle).length > 0 ? sidebarChromeStyle : undefined;
  // Portaled dropdowns (the Git-status filter) render outside the sidebar
  // wrapper, so the chrome variables set on it don't cascade. Re-apply the
  // resolved chrome on the menu surface itself, mirroring the header dropdowns.
  const dropdownThemeStyle = useMemo(
    () => getDropdownThemeStyle(sidebarStyle),
    [sidebarStyle]
  );
  const [activeStatusPanel, setActiveStatusPanel] =
    useState<SidebarStatusPanel | null>('diffStats');
  const [fileTreeModel, setFileTreeModel] = useState<FileTree | null>(null);
  // Inclusion filter: the statuses the tree should show. Empty means "no
  // filter" — every file is shown — so the menu opens with nothing checked and
  // checking statuses narrows the tree to just those.
  const [selectedStatuses, setSelectedStatuses] = useState<
    ReadonlySet<GitStatus>
  >(() => new Set());
  const availableStatuses = useMemo(
    () => getDiffsFileTreeAvailableStatuses(source),
    [source]
  );
  const filteredSource = useMemo(
    () => filterDiffsFileTreeSource(source, selectedStatuses),
    [source, selectedStatuses]
  );
  const handleModelReady = useCallback((model: FileTree | null) => {
    setFileTreeModel(model);
  }, []);
  const toggleStatusPanel = useCallback((panel: SidebarStatusPanel) => {
    setActiveStatusPanel((current) => (current === panel ? null : panel));
  }, []);

  const clearStatusFilter = useCallback(() => {
    setSelectedStatuses(new Set());
  }, []);

  const toggleSelectedStatus = useCallback((status: GitStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  // Alt+click "isolate": narrow the filter to only the clicked status. If it's
  // already the sole selection, clear the filter instead so the tree returns to
  // showing everything.
  const isolateStatus = useCallback((status: GitStatus) => {
    setSelectedStatuses((prev) => {
      if (prev.size === 1 && prev.has(status)) {
        return new Set();
      }
      return new Set([status]);
    });
  }, []);

  useEffect(() => {
    if (mobileOverlayOpen && window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
      setActiveStatusPanel(null);
    }
  }, [mobileOverlayOpen]);

  useEffect(() => {
    if (!mobileOverlayOpen || !window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
      return undefined;
    }

    const { body, documentElement } = document;
    const codeViewScroll = scrollRef.current;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverscrollBehavior =
      documentElement.style.overscrollBehavior;
    const previousCodeViewOverflow = codeViewScroll?.style.overflow;

    body.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    if (codeViewScroll != null) {
      codeViewScroll.style.overflow = 'hidden';
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overscrollBehavior = previousRootOverscrollBehavior;
      if (codeViewScroll != null) {
        codeViewScroll.style.overflow = previousCodeViewOverflow ?? '';
      }
    };
  }, [mobileOverlayOpen, scrollRef]);

  return (
    <>
      <button
        type="button"
        aria-hidden={!mobileOverlayOpen}
        aria-label="Close file tree"
        tabIndex={mobileOverlayOpen ? 0 : -1}
        className={cx(
          css({
            zIndex: '20',
            cursor: 'default',
            bg: 'diffs.background/60',
            backdropFilter: 'blur(4px)',
            transition: 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            gridColumn: '1 / -1',
            gridRow: '1 / -1',
            display: { md: 'none' },
          }),
          mobileOverlayOpen
            ? css({ pointerEvents: 'auto', opacity: '1' })
            : css({ pointerEvents: 'none', opacity: '0' })
        )}
        onClick={onMobileClose}
      />
      <SidebarWrapper
        className={className}
        mobileOverlayOpen={mobileOverlayOpen}
        themeStyle={sidebarStyle}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '3',
            px: { base: '4', md: '3' },
            pt: { base: '5', md: '0.5' },
            pb: { base: '2', md: '0' },
          })}
        >
          <ButtonGroup
            aria-label="Sidebar sections"
            className={css({
              mr: 'auto',
              display: 'flex',
              minW: '0',
              gap: { base: '3', md: '2' },
              bg: 'transparent',
            })}
            variant="ghost"
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as SidebarTab)}
          >
            <ButtonGroupItem
              value="files"
              size="icon-only"
              className={css({ boxShadow: 'none' })}
            >
              <IconFileTree className={ICON_SIZE_CLASS} />
              <span className={css({ srOnly: true })}>Files</span>
            </ButtonGroupItem>
            <ButtonGroupItem
              value="comments"
              size="icon-only"
              className={cx(
                css({ boxShadow: 'none' }),
                totalCommentCount > 0 &&
                  css({ w: 'auto', gap: '1', pr: '1' })
              )}
            >
              <IconComment className={ICON_SIZE_CLASS} />
              <span className={css({ srOnly: true })}>Comments</span>
              {totalCommentCount > 0 && (
                <span
                  aria-hidden="true"
                  // Tint the badge with the chrome's current text color so
                  // it follows the active Shiki theme instead of staying
                  // on hardcoded neutral grays. `currentColor` resolves to
                  // whichever fg the button inherits (chrome primaryFg
                  // for the unselected ghost variant, accent-foreground
                  // when this tab is selected), so the pill stays
                  // on-palette in both states.
                  className={css({
                    display: 'inline-flex',
                    h: '3.5',
                    minW: '3.5',
                    alignItems: 'center',
                    justifyContent: 'center',
                    rounded: 'full',
                    bg: 'color-mix(in srgb, currentColor 18%, transparent)',
                    px: '1',
                    fontSize: '10px',
                    lineHeight: '1',
                    fontWeight: 'medium',
                    fontVariantNumeric: 'tabular-nums',
                  })}
                >
                  {totalCommentCount}
                </span>
              )}
            </ButtonGroupItem>
          </ButtonGroup>
          {activeTab === 'files' && fileTreeModel != null && (
            <FileTreeSearchToggle model={fileTreeModel} />
          )}
          {activeTab === 'files' && availableStatuses.size > 1 && (
            <FileTreeFilterButton
              availableStatuses={availableStatuses}
              selectedStatuses={selectedStatuses}
              onClear={clearStatusFilter}
              onToggle={toggleSelectedStatus}
              onIsolate={isolateStatus}
              dropdownThemeStyle={dropdownThemeStyle}
            />
          )}
          {onMobileClose != null && (
            <Button
              variant="ghost"
              size="icon-only"
              className={cx(
                CHROME_ICON_BUTTON_CLASS,
                css({ display: { md: 'none' } })
              )}
              aria-label="Close file tree"
              onClick={onMobileClose}
            >
              <IconXSquircle className={ICON_SIZE_CLASS} />
            </Button>
          )}
        </div>
        <div className={css({ mt: '3', minH: '0', flex: '1' })}>
          <div
            role="region"
            aria-label="Files"
            hidden={activeTab !== 'files'}
            className={css({ h: 'full', minH: '0' })}
          >
            <DiffsFileTree
              source={filteredSource}
              onModelReady={handleModelReady}
              onSelectItem={onSelectItem}
            />
          </div>
          <div
            role="region"
            aria-label="Comments"
            hidden={activeTab !== 'comments'}
            className={css({ h: 'full', minH: '0' })}
          >
            <DiffsCommentsList
              commentSections={commentSections}
              onSelectComment={onSelectComment}
              onSelectItem={onSelectItem}
            />
          </div>
        </div>
        <DiffsStats
          expanded={activeStatusPanel === 'diffStats'}
          onToggle={() => toggleStatusPanel('diffStats')}
          stats={diffStats}
          streaming={streaming}
        />
        <WorkerPoolStatus
          expanded={activeStatusPanel === 'systemMonitor'}
          onToggle={() => toggleStatusPanel('systemMonitor')}
          viewerRef={viewerRef}
          themeCycle={themeCycle}
        />
      </SidebarWrapper>
    </>
  );
});

interface SidebarWrapperProps {
  children: ReactNode;
  className?: string;
  mobileOverlayOpen: boolean;
  themeStyle?: CSSProperties;
}

function SidebarWrapper({
  children,
  className,
  mobileOverlayOpen,
  themeStyle,
}: SidebarWrapperProps) {
  return (
    <div
      className={cx(
        className,
        css({
          contain: 'strict',
          zIndex: { base: '30', md: 'auto' },
          display: 'flex',
          h: 'full',
          minH: '0',
          flexDirection: 'column',
          transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: { base: 'transform', md: 'auto' },
          transform: { md: 'translateY(0)' },
          _motionReduce: { transition: 'none' },
        }),
        // Fall back to the neutral diffs chrome background when no Shiki
        // theme bg is available yet (initial render before the resolver
        // returns).
        themeStyle == null && css({ bg: 'var(--diffs-sidebar-bg)' }),
        mobileOverlayOpen
          ? css({
              pointerEvents: 'auto',
              transform: 'translateY(0)',
              overflow: { base: 'hidden', md: 'visible' },
              roundedTop: 'diffs.xl',
              boxShadow: {
                base:
                  '0 0 0 1px var(--border-opaque), 0 16px 32px rgb(0 0 0 / 0.25)',
                md: 'none',
              },
              h: { md: 'full' },
              rounded: { md: '0' },
              borderWidth: { md: '0' },
            })
          : css({
              pointerEvents: { base: 'none', md: 'auto' },
              transform: 'translateY(calc(100% + 1.5rem))',
              overflow: { base: 'hidden', md: 'visible' },
              rounded: { base: 'diffs.xl', md: '0' },
              h: { md: 'full' },
              pt: '3',
              borderRightWidth: '1px',
              borderColor: 'var(--border-opaque)',
            })
      )}
      style={themeStyle}
    >
      {children}
    </div>
  );
}

// Statuses that can appear in a diff, in the order they should appear in the
// filter dropdown. Colors mirror the exact light-dark() values from the tree's
// style.css so the badges match what the tree rows show.
const DIFF_STATUS_ITEMS: {
  status: GitStatus;
  label: string;
  short: string;
  color: string;
}[] = [
  {
    status: 'added',
    label: 'Added',
    short: 'A',
    color: 'light-dark(#16a994, #00cab1)',
  },
  {
    status: 'modified',
    label: 'Modified',
    short: 'M',
    color: 'light-dark(#1ca1c7, #08c0ef)',
  },
  {
    status: 'renamed',
    label: 'Renamed',
    short: 'R',
    color: 'light-dark(#d5a910, #ffd452)',
  },
  {
    status: 'deleted',
    label: 'Deleted',
    short: 'D',
    color: 'light-dark(#ff2e3f, #ff6762)',
  },
];

interface FileTreeFilterButtonProps {
  availableStatuses: ReadonlySet<GitStatus>;
  dropdownThemeStyle?: CSSProperties;
  onClear(): void;
  onIsolate(status: GitStatus): void;
  onToggle(status: GitStatus): void;
  selectedStatuses: ReadonlySet<GitStatus>;
}

function FileTreeFilterButton({
  availableStatuses,
  dropdownThemeStyle,
  onClear,
  onIsolate,
  onToggle,
  selectedStatuses,
}: FileTreeFilterButtonProps) {
  const isFiltered = selectedStatuses.size > 0;
  const visibleItems = DIFF_STATUS_ITEMS.filter(({ status }) =>
    availableStatuses.has(status)
  );
  const [isMac] = useState(
    () => typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
  );
  // Track whether Alt was held on the most recent pointer-down so the
  // onCheckedChange handler (which receives no event) can branch on it.
  const altKeyRef = useRef(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-only"
          aria-label="Filter by Git status"
          aria-pressed={isFiltered}
          className={cx(
            CHROME_ICON_BUTTON_CLASS,
            css({ position: 'relative' })
          )}
        >
          <IconFilter className={ICON_SIZE_CLASS} />
          {isFiltered && (
            <span
              className={css({
                position: 'absolute',
                top: '-0.5',
                right: '-0.5',
                w: '2',
                h: '2',
                rounded: 'full',
                borderWidth: '1px',
                borderColor: 'var(--diffs-sidebar-bg)',
                bg: 'blue.500',
                _dark: { bg: 'blue.400' },
              })}
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={css({ p: '2' })}
        style={dropdownThemeStyle}
      >
        <DropdownMenuLabel
          className={css({
            display: 'flex',
            flexDirection: 'column',
            px: '2',
            fontWeight: 'normal',
          })}
        >
          Filter by Git status
          <small
            className={css({
              color: 'diffs.muted.foreground',
              fontSize: 'xs',
              lineHeight: '1rem',
            })}
          >
            {isMac ? 'Option' : 'Alt'}-click to show only one status
          </small>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className={css({ mx: '2' })} />
        {visibleItems.map(({ status, label, short, color }) => (
          <DropdownMenuCheckboxItem
            key={status}
            checked={selectedStatuses.has(status)}
            indicatorSide="right"
            onPointerDown={(e) => {
              altKeyRef.current = e.altKey;
            }}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => {
              if (altKeyRef.current) {
                onIsolate(status);
              } else {
                onToggle(status);
              }
            }}
            className={
              isFiltered && !selectedStatuses.has(status)
                ? css({ color: 'diffs.muted.foreground' })
                : undefined
            }
          >
            <span
              className={css({
                mr: '2',
                w: '4',
                flexShrink: '0',
                rounded: 'diffs.sm',
                textAlign: 'center',
                fontFamily: 'diffs.mono',
                fontSize: 'xs',
                lineHeight: '1rem',
                fontWeight: 'semibold',
              })}
              style={{
                color,
                backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
              }}
            >
              {short}
            </span>
            {label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator className={css({ mx: '2' })} />
        <DropdownMenuItem
          className={css({ px: '2' })}
          disabled={!isFiltered}
          onSelect={onClear}
        >
          <IconXSquircle className={css({ mr: '2', opacity: '0.5' })} />
          Clear filter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Lives in its own component so we can call useFileTreeSearch only once we
// actually have a model; conditional hook calls aren't allowed in the parent.
function FileTreeSearchToggle({ model }: { model: FileTree }) {
  const search = useFileTreeSearch(model);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-only"
      aria-label={search.isOpen ? 'Hide file search' : 'Show file search'}
      aria-pressed={search.isOpen}
      className={CHROME_ICON_BUTTON_CLASS}
      // Avoid focus moving to this button before click: the tree search input
      // closes on blur, so without preventDefault the blur runs first, then
      // click sees isOpen false and calls open() again.
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => {
        if (search.isOpen) {
          search.close();
        } else {
          search.open();
        }
      }}
    >
      <IconSearch className={ICON_SIZE_CLASS} />
    </Button>
  );
}
