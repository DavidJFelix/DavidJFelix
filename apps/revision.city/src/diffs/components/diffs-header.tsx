// cSpell:ignore Diffstat -- @pierre/icons export name
import type {DiffIndicators} from '@pierre/diffs'
import {
  IconCheck,
  IconChevronSm,
  IconCodeStyleBars,
  IconCollapsedRow,
  IconColorAuto,
  IconColorDark,
  IconColorLight,
  IconDiffSplit,
  IconDiffUnified,
  IconExpandAll,
  IconEyeSlash,
  IconFileTreeFill,
  IconGearFill,
  IconShare,
  IconSymbolDiffstat,
} from '@pierre/icons'
import {type ColorMode} from '@pierre/theming'
import {Link} from '@tanstack/react-router'
import {
  type CSSProperties,
  type Dispatch,
  memo,
  type SetStateAction,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {css, cx} from 'styled-system/css'
import {Button} from '@/diffs/components/button'
import {ButtonGroup, ButtonGroupItem} from '@/diffs/components/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/diffs/components/dropdown-menu'
import {GitHubTokenControl} from '@/diffs/components/github-token-control'
import {Switch} from '@/diffs/components/switch'
import {docsThemeCatalog} from '@/diffs/components/theme-catalog'
import {isNullish} from '@/diffs/lib/nullish'
import {diffsChromeMapping} from '@/diffs/lib/theme/diffs-chrome-mapping'
import {getDropdownThemeStyle} from '@/diffs/lib/theme/dropdown-chrome-style'
import {CHROME_ICON_BUTTON_CLASS} from './chrome-button-styles'
import {DiffUrlForm} from './diff-url-form'
import {useChromeThemeProps} from './use-chrome-theme-props'

type LightThemeName = string
type DarkThemeName = string

const SETTING_ROW_CLASS = css({
  w: 'full',
  display: 'flex',
  cursor: 'pointer',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4',
  px: '2',
  py: '1.5',
  fontSize: 'sm',
  lineHeight: '1.25rem',
})

const ICON_SIZE_CLASS = css({
  w: {base: '4', md: '3'},
  h: {base: '4', md: '3'},
})

// Menu items that must keep a transparent focus background (setting rows that
// host their own controls). The [role] selector outranks the DropdownMenuItem
// recipe's own focus background, since Panda's cx concatenates rather than
// merges conflicting utilities.
const MENU_ITEM_FOCUS_TRANSPARENT_CLASS = css({
  '&[role="menuitem"]': {_focus: {bg: 'transparent'}},
})

interface HeaderProps {
  className?: string
  collapseMode: 'expanded' | 'collapsed'
  colorMode: ColorMode
  darkThemeName: DarkThemeName
  diffIndicators: DiffIndicators
  diffStyle: 'split' | 'unified'
  fileTreeAvailable: boolean
  fileTreeOverlayOpen: boolean
  githubTokenActive: boolean
  initialUrl: string
  lightThemeName: LightThemeName
  lineNumbers: boolean
  overflow: 'wrap' | 'scroll'
  onClearGitHubToken(): void
  onSaveGitHubToken(token: string): void
  onToggleCollapseMode(): void
  onToggleFileTreeOverlay(): void
  setColorMode(mode: ColorMode): void
  setDarkThemeName(name: DarkThemeName): void
  setDiffIndicators: Dispatch<SetStateAction<DiffIndicators>>
  setDiffStyle: Dispatch<SetStateAction<'split' | 'unified'>>
  setLightThemeName(name: LightThemeName): void
  setLineNumbers: Dispatch<SetStateAction<boolean>>
  setOverflow: Dispatch<SetStateAction<'wrap' | 'scroll'>>
  setShowBackgrounds: Dispatch<SetStateAction<boolean>>
  showBackgrounds: boolean
}

export const DiffsHeader = memo(function DiffsHeader({
  className,
  collapseMode,
  colorMode,
  darkThemeName,
  diffIndicators,
  diffStyle,
  fileTreeAvailable,
  fileTreeOverlayOpen,
  githubTokenActive,
  initialUrl,
  lightThemeName,
  lineNumbers,
  overflow,
  onClearGitHubToken,
  onSaveGitHubToken,
  onToggleCollapseMode,
  onToggleFileTreeOverlay,
  setColorMode,
  setDarkThemeName,
  setDiffIndicators,
  setDiffStyle,
  setLightThemeName,
  setLineNumbers,
  setOverflow,
  setShowBackgrounds,
  showBackgrounds,
}: HeaderProps) {
  const [currentUrl, setCurrentUrl] = useState(initialUrl)
  // Only show the external-link button when the input still reflects the
  // committed URL — otherwise we'd be pointing at a draft the user is editing.
  const showExternalLink = currentUrl === initialUrl
  // Mirror the sidebar's themed chrome so the header bar lives on the same
  // Shiki surface (background, text, icons, borders) instead of the global
  // light/dark palette. Falls back to the diffs-sidebar-bg CSS variable
  // on first render while the theme is still resolving.
  const {style: headerChromeStyle} = useChromeThemeProps(diffsChromeMapping)
  const themeChromeStyle = Object.keys(headerChromeStyle).length > 0 ? headerChromeStyle : undefined
  const dropdownThemeStyle = useMemo(
    () => getDropdownThemeStyle(themeChromeStyle),
    [themeChromeStyle],
  )
  return (
    <div
      className={cx(
        css({
          zIndex: '10',
          contain: 'layout paint',
          display: 'flex',
          flexWrap: {base: 'wrap', md: 'nowrap'},
          alignItems: 'center',
          gap: '2.5',
          pt: {base: '3', md: '1.5'},
          pb: {base: '2', md: '1.5'},
          px: {base: '4', md: '3'},
          borderBottomWidth: '1px',
          borderColor: 'var(--border-opaque)',
        }),
        isNullish(themeChromeStyle) &&
          css({
            bg: {base: 'diffs.background', md: 'var(--diffs-sidebar-bg)'},
          }),
        className,
      )}
      style={themeChromeStyle}
    >
      <Link
        to="/diffs"
        className={css({
          position: {base: 'absolute', md: 'static'},
          top: '4',
          left: '50%',
          display: 'inline-flex',
          transform: {base: 'translateX(-50%)', md: 'translateX(0)'},
          transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          _hover: {
            transform: {
              base: 'translateX(-50%) scale(1.1)',
              md: 'scale(1.1)',
            },
          },
        })}
      >
        <span
          className={css({
            fontWeight: 'semibold',
            letterSpacing: 'tight',
            fontSize: 'lg',
            lineHeight: '1',
          })}
        >
          Diffs
        </span>
      </Link>
      <DiffUrlForm
        className={css({order: {base: '9999', md: '0'}, mr: {md: 'auto'}})}
        initialUrl={initialUrl}
        onUrlChange={setCurrentUrl}
        placeholder="https://github.com/org/repo/123"
        inputClassName={css({w: {base: 'full', md: 'auto'}})}
      />
      <div
        className={css({
          display: 'flex',
          w: {base: 'full', md: 'auto'},
          alignItems: 'center',
          justifyContent: {base: 'space-between', md: 'flex-end'},
          gap: '2',
        })}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-md"
          aria-pressed={fileTreeOverlayOpen}
          disabled={!fileTreeAvailable}
          title={fileTreeOverlayOpen ? 'Hide file tree' : 'Show file tree'}
          className={cx(CHROME_ICON_BUTTON_CLASS, css({display: {md: 'none'}}))}
          onClick={onToggleFileTreeOverlay}
        >
          <IconFileTreeFill className={ICON_SIZE_CLASS} />
        </Button>
        <div className={css({display: 'flex', alignItems: 'center', gap: '2'})}>
          {showExternalLink && (
            <>
              <Button
                asChild
                variant="ghost"
                size="icon-md"
                aria-label="Open source in new tab"
                title="Open source in new tab"
                className={cx(CHROME_ICON_BUTTON_CLASS, css({display: {base: 'none', md: 'flex'}}))}
              >
                <a href={initialUrl} target="_blank" rel="noreferrer noopener">
                  <IconShare className={ICON_SIZE_CLASS} />
                </a>
              </Button>
              <div
                className={css({
                  bg: 'diffs.border',
                  display: {base: 'none', md: 'block'},
                  h: '3',
                  w: '1px',
                })}
              />
            </>
          )}
          <div className={css({display: 'flex', alignItems: 'center'})}>
            <Button
              type="button"
              variant="ghost"
              size="icon-md"
              title={diffStyle === 'split' ? 'Switch to unified view' : 'Switch to split view'}
              className={cx(CHROME_ICON_BUTTON_CLASS, css({display: {base: 'none', md: 'flex'}}))}
              onClick={() => setDiffStyle(diffStyle === 'split' ? 'unified' : 'split')}
            >
              {diffStyle === 'split' ? (
                <IconDiffSplit className={ICON_SIZE_CLASS} />
              ) : (
                <IconDiffUnified className={ICON_SIZE_CLASS} />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-md"
              aria-pressed={collapseMode === 'collapsed'}
              title={collapseMode === 'expanded' ? 'Collapse all files' : 'Expand all files'}
              className={CHROME_ICON_BUTTON_CLASS}
              onClick={onToggleCollapseMode}
            >
              {collapseMode === 'expanded' ? (
                <IconExpandAll className={ICON_SIZE_CLASS} />
              ) : (
                <IconCollapsedRow className={ICON_SIZE_CLASS} />
              )}
            </Button>
            <ThemeDropdown
              colorMode={colorMode}
              darkThemeName={darkThemeName}
              lightThemeName={lightThemeName}
              setColorMode={setColorMode}
              setDarkThemeName={setDarkThemeName}
              setLightThemeName={setLightThemeName}
              themeDropdownStyle={dropdownThemeStyle}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-md"
                  aria-label="Display settings"
                  title="Display settings"
                  className={CHROME_ICON_BUTTON_CLASS}
                >
                  <IconGearFill className={ICON_SIZE_CLASS} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={css({w: '72', p: '2'})}
                style={dropdownThemeStyle}
              >
                <GitHubTokenControl
                  active={githubTokenActive}
                  onClear={onClearGitHubToken}
                  onSave={onSaveGitHubToken}
                />
                <div className={css({bg: 'diffs.border/70', my: '2', h: '1px'})} />
                <DropdownMenuItem
                  className={css({cursor: 'default', p: '0'})}
                  onSelect={(e) => e.preventDefault()}
                >
                  <label htmlFor="diffs-setting-backgrounds" className={SETTING_ROW_CLASS}>
                    <span className={css({minW: '0', flex: '1'})}>Backgrounds</span>
                    <Switch
                      id="diffs-setting-backgrounds"
                      checked={showBackgrounds}
                      onCheckedChange={setShowBackgrounds}
                    />
                  </label>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={css({cursor: 'default', p: '0'})}
                  onSelect={(e) => e.preventDefault()}
                >
                  <label htmlFor="diffs-setting-line-numbers" className={SETTING_ROW_CLASS}>
                    <span className={css({minW: '0', flex: '1'})}>Line numbers</span>
                    <Switch
                      id="diffs-setting-line-numbers"
                      checked={lineNumbers}
                      onCheckedChange={setLineNumbers}
                    />
                  </label>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={css({cursor: 'default', p: '0'})}
                  onSelect={(e) => e.preventDefault()}
                >
                  <label htmlFor="diffs-setting-word-wrap" className={SETTING_ROW_CLASS}>
                    <span className={css({minW: '0', flex: '1'})}>Word wrap</span>
                    <Switch
                      id="diffs-setting-word-wrap"
                      checked={overflow === 'wrap'}
                      onCheckedChange={(checked) => setOverflow(checked ? 'wrap' : 'scroll')}
                    />
                  </label>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cx(css({w: 'full', px: '2'}), MENU_ITEM_FOCUS_TRANSPARENT_CLASS)}
                  onSelect={(e) => e.preventDefault()}
                >
                  <span>Indicator style</span>
                  <ButtonGroup
                    className={css({ml: 'auto'})}
                    value={diffIndicators}
                    onValueChange={(value) => setDiffIndicators(value as DiffIndicators)}
                  >
                    <ButtonGroupItem value="bars" className={css({w: '7', h: '7', p: '0'})}>
                      <IconCodeStyleBars className={css({w: '3', h: '3'})} />
                    </ButtonGroupItem>
                    <ButtonGroupItem value="classic" className={css({w: '7', h: '7', p: '0'})}>
                      <IconSymbolDiffstat className={css({w: '3', h: '3'})} />
                    </ButtonGroupItem>
                    <ButtonGroupItem value="none" className={css({w: '7', h: '7', p: '0'})}>
                      <IconEyeSlash className={css({w: '3', h: '3'})} />
                    </ButtonGroupItem>
                  </ButtonGroup>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <hr
        className={css({
          borderColor: 'diffs.border/80',
          w: 'full',
          display: {md: 'none'},
        })}
      />
    </div>
  )
})

function colorModeIcon(colorMode: ColorMode) {
  if (colorMode === 'light') return IconColorLight
  if (colorMode === 'dark') return IconColorDark
  return IconColorAuto
}

interface ThemeDropdownProps {
  colorMode: ColorMode
  darkThemeName: DarkThemeName
  lightThemeName: LightThemeName
  setColorMode(mode: ColorMode): void
  setDarkThemeName(name: DarkThemeName): void
  setLightThemeName(name: LightThemeName): void
  themeDropdownStyle?: CSSProperties
}

// Theme picker shown next to the gear icon. Avoids horizontal sub-menus
// (which overflow on narrow viewports) by re-using the same DropdownMenu
// content for three "views" — main, light theme list, dark theme list —
// switched via local state. The user enters a list by clicking the
// corresponding row, picks a theme, and is returned to the main view. The
// menu auto-resets to the main view whenever it closes so the next open
// always starts from the top.
function ThemeDropdown({
  colorMode,
  darkThemeName,
  lightThemeName,
  setColorMode,
  setDarkThemeName,
  setLightThemeName,
  themeDropdownStyle,
}: ThemeDropdownProps) {
  const TriggerIcon = colorModeIcon(colorMode)
  const [view, setView] = useState<'main' | 'light' | 'dark'>('main')
  // Only offer a reset when at least one slot drifts from the default
  // theme pair, so the link stays out of the way until it's useful.
  const themesAreCustom =
    lightThemeName !== docsThemeCatalog.defaultLightThemeName ||
    darkThemeName !== docsThemeCatalog.defaultDarkThemeName
  return (
    // `modal={false}` lets the user scroll and click the code view while the
    // theme picker is open. The default Radix DropdownMenu blocks pointer
    // events outside its content (incl. wheel/scroll), which made the diff
    // feel frozen while previewing themes.
    <DropdownMenu
      modal={false}
      onOpenChange={(open) => {
        if (!open) setView('main')
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-md"
          aria-label="Theme settings"
          title="Theme settings"
          className={CHROME_ICON_BUTTON_CLASS}
        >
          <TriggerIcon className={ICON_SIZE_CLASS} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={css({w: '72', p: '2'})}
        style={themeDropdownStyle}
      >
        {view === 'main' ? (
          <>
            <DropdownMenuItem
              className={cx(css({cursor: 'default', p: '0'}), MENU_ITEM_FOCUS_TRANSPARENT_CLASS)}
              onSelect={(event) => event.preventDefault()}
            >
              <ButtonGroup
                className={css({w: 'full'})}
                value={colorMode}
                onValueChange={(value) => {
                  if (value === 'system' || value === 'light' || value === 'dark') {
                    setColorMode(value)
                  }
                }}
              >
                <ButtonGroupItem value="system" className={css({flex: '1'})}>
                  <IconColorAuto />
                  Auto
                </ButtonGroupItem>
                <ButtonGroupItem value="light" className={css({flex: '1'})}>
                  <IconColorLight />
                  Light
                </ButtonGroupItem>
                <ButtonGroupItem value="dark" className={css({flex: '1'})}>
                  <IconColorDark />
                  Dark
                </ButtonGroupItem>
              </ButtonGroup>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={css({
                mt: '1',
                display: 'flex',
                cursor: 'pointer',
                alignItems: 'center',
                gap: '2',
              })}
              onSelect={(event) => {
                event.preventDefault()
                setView('light')
              }}
            >
              <IconColorLight />
              <span className={css({minW: '0', flex: '1', truncate: true})}>{lightThemeName}</span>
              <IconChevronSm
                aria-hidden
                className={css({
                  color: 'diffs.muted.foreground',
                  transform: 'rotate(-90deg)',
                })}
              />
            </DropdownMenuItem>
            <DropdownMenuItem
              className={css({
                display: 'flex',
                cursor: 'pointer',
                alignItems: 'center',
                gap: '2',
              })}
              onSelect={(event) => {
                event.preventDefault()
                setView('dark')
              }}
            >
              <IconColorDark />
              <span className={css({minW: '0', flex: '1', truncate: true})}>{darkThemeName}</span>
              <IconChevronSm
                aria-hidden
                className={css({
                  color: 'diffs.muted.foreground',
                  transform: 'rotate(-90deg)',
                })}
              />
            </DropdownMenuItem>
            {themesAreCustom && (
              <DropdownMenuItem
                className={cx(
                  css({
                    color: 'diffs.muted.foreground',
                    mt: '1',
                    cursor: 'pointer',
                    justifyContent: 'center',
                    fontSize: 'xs',
                    lineHeight: '1rem',
                    _hover: {color: 'diffs.foreground'},
                  }),
                  MENU_ITEM_FOCUS_TRANSPARENT_CLASS,
                )}
                onSelect={(event) => {
                  event.preventDefault()
                  setLightThemeName(docsThemeCatalog.defaultLightThemeName)
                  setDarkThemeName(docsThemeCatalog.defaultDarkThemeName)
                }}
              >
                Reset to default themes
              </DropdownMenuItem>
            )}
          </>
        ) : (
          <ThemeList
            view={view}
            currentLight={lightThemeName}
            currentDark={darkThemeName}
            onBack={() => setView('main')}
            onPickLight={(theme) => {
              setLightThemeName(theme)
              setColorMode('light')
              setView('main')
            }}
            onPickDark={(theme) => {
              setDarkThemeName(theme)
              setColorMode('dark')
              setView('main')
            }}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ThemeListProps {
  view: 'light' | 'dark'
  currentLight: LightThemeName
  currentDark: DarkThemeName
  onBack(): void
  onPickLight(theme: LightThemeName): void
  onPickDark(theme: DarkThemeName): void
}

// Inline list of theme names shown after the user enters the light or dark
// "view" from the main panel. The list is keyboard-friendly (each row is a
// DropdownMenuItem) and scrolls in place so it fits inside the same
// dropdown content even on narrow viewports.
function ThemeList({
  view,
  currentLight,
  currentDark,
  onBack,
  onPickLight,
  onPickDark,
}: ThemeListProps) {
  const isLight = view === 'light'
  const themes = docsThemeCatalog.getThemeNames({
    colorScheme: isLight ? 'light' : 'dark',
  })
  const current = isLight ? currentLight : currentDark
  const HeaderIcon = isLight ? IconColorLight : IconColorDark
  // Auto-scroll so the currently-selected row sits at the second visible
  // position when the list opens. The current theme lands right under the
  // user's cursor (Radix opens the menu under the trigger) and the row
  // above it makes the previous theme easy to reach with one tap of the
  // up arrow — sequential browsing through themes feels natural without
  // the user having to hunt for the active row first.
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const container = scrollContainerRef.current
    const selected = selectedItemRef.current
    if (isNullish(container) || isNullish(selected)) return
    // `offsetTop` measures from the nearest positioned ancestor, which the
    // scroll container is not — use bounding rects so the math works
    // regardless of where ancestors set `position`. Subtract one row
    // height so the selected row appears as the second-from-top visible
    // row instead of flush with the top.
    const containerTop = container.getBoundingClientRect().top
    const selectedTop = selected.getBoundingClientRect().top
    const offsetWithinScroll = selectedTop - containerTop + container.scrollTop
    const rowHeight = selected.offsetHeight
    container.scrollTop = Math.max(0, offsetWithinScroll - rowHeight)
  }, [view])
  return (
    <>
      <DropdownMenuItem
        className={css({
          display: 'flex',
          cursor: 'pointer',
          alignItems: 'center',
          gap: '2',
        })}
        onSelect={(event) => {
          event.preventDefault()
          onBack()
        }}
      >
        <IconChevronSm
          aria-hidden
          className={css({
            color: 'diffs.muted.foreground',
            transform: 'rotate(90deg)',
          })}
        />
        <HeaderIcon />
        <span className={css({flex: '1', truncate: true})}>
          {isLight ? 'Light theme' : 'Dark theme'}
        </span>
      </DropdownMenuItem>
      <div
        ref={scrollContainerRef}
        className={cx(
          'cv-mini-scrollbar',
          css({
            mt: '1',
            maxH: '320px',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }),
        )}
      >
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme}
            ref={current === theme ? selectedItemRef : undefined}
            onSelect={(event) => {
              event.preventDefault()
              if (isLight) {
                onPickLight(theme)
              } else {
                onPickDark(theme)
              }
            }}
            selected={current === theme}
          >
            <span className={css({flex: '1', truncate: true})}>{theme}</span>
            {current === theme ? (
              <IconCheck className={css({ml: 'auto'})} />
            ) : (
              <div className={css({ml: '2', h: '4', w: '4'})} />
            )}
          </DropdownMenuItem>
        ))}
      </div>
    </>
  )
}
