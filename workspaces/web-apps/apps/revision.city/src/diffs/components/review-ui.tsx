import {useStableCallback} from '@pierre/diffs/react'
import {type ColorMode} from '@pierre/theming'
import {useThemeController} from '@pierre/theming/react'
import {shallowEqual, useSelector, useStore} from '@xstate/store-react'
import {type ReactNode, useCallback, useEffect, useMemo, useRef, useSyncExternalStore} from 'react'

import {css} from 'styled-system/css'
import {CODEBERG_HOST, canReadCodebergFiles} from '@/diffs/lib/codeberg-diff-source'
import {
  createCodebergDiffFileLoader,
  createGitHubDiffFileLoader,
} from '@/diffs/lib/diff-file-loader'
import {isNullish} from '@/diffs/lib/nullish'
import type {DarkThemeName, LightThemeName} from '@/diffs/lib/theme-names'
import type {
  DiffsDeletedCommentEvent,
  DiffsSavedCommentEntry,
  DiffsSavedCommentEvent,
  DiffsViewerHandle,
} from '@/diffs/lib/types'
import {docsThemeCatalog, themeController} from '@/diffs/state/theme-controller'
import {
  type ViewSettingsContext,
  type ViewSettingsStore,
  viewSettingsLogic,
} from '@/diffs/state/view-settings-store'
import type {SymbolSelection} from '@/symbols/components/symbol-changes-list'
import type {SymbolDiffRequest} from '@/symbols/lib/symbol-diff-client'
import {OverridableThemeSourceProvider} from './contexts/overridable-theme-source-provider'
import {DiffsHeader} from './diffs-header'
import {DiffsSidebar} from './diffs-sidebar'
import {DiffsStatusPanel} from './diffs-status-panel'
import {DiffsViewer} from './diffs-viewer'
import {useBaseMovedOn} from './hooks/use-base-moved-on'
import {useFirstGitHubSession} from './hooks/use-github-session'
import {usePatchLoader} from './hooks/use-patch-loader'
import {useThemeCycle} from './hooks/use-theme-cycle'
import {useWorkerPoolState} from './worker-pool-context'

interface ReviewUIProps {
  domain?: string
  path: string
}

export function ReviewUI({domain, path}: ReviewUIProps) {
  // Provide the diffs-scoped theme context, then render the body BELOW it so
  // the diffs hook + selection hook can read the controller context.
  return (
    <OverridableThemeSourceProvider controller={themeController}>
      <ReviewUIInner domain={domain} path={path} />
    </OverridableThemeSourceProvider>
  )
}

function ReviewUIInner({domain, path}: ReviewUIProps) {
  const workerPoolState = useWorkerPoolState()
  const viewSettingsStore = useStore(viewSettingsLogic)
  const {
    collapseMode,
    diffIndicators,
    diffStyle,
    lineNumbers,
    overflow,
    showBackgrounds,
    status: fileTreeOverlayStatus,
  } = useSelector(viewSettingsStore, ({context}) => context, shallowEqual)
  const fileTreeOverlayOpen = fileTreeOverlayStatus === 'open'
  const {setDiffIndicators, setDiffStyle, setLineNumbers, setOverflow, setShowBackgrounds} =
    useMemo(() => createViewSettingSetters(viewSettingsStore), [viewSettingsStore])
  // The viewer keeps the first answer: CodeView does not compute its file heights
  // again when a later answer changes `loadDiffFiles`.
  const githubSession = useFirstGitHubSession()
  const baseMovedOn = useBaseMovedOn({
    domain,
    path,
    signedIn: githubSession.status === 'authenticated',
  })
  // All theming state — color mode and the light/dark theme-name picks — lives
  // in the single @pierre/theming controller (the same instance the app-wide
  // ThemeProvider is bound to). Reading it here means picking Auto/Light/Dark
  // flips both the CodeView's `themeType` and the app's <html> class, and the
  // theme-name picks persist with no separate local state.
  const themeState = useThemeController(themeController)

  // The controller reads persisted values synchronously when its module loads
  // on the client, so useSyncExternalStore would surface them on the very first
  // client render — but the server rendered the defaults. Gate every
  // theme-derived value (rendered into inline chrome styles + the CodeView
  // themeType) behind a client-mounted flag so the first client render matches
  // the SSR markup, then flips to the user's selection. This also keeps the
  // long-lived WorkerPool and the CodeView from mounting against the default
  // palette before the persisted values apply.
  const themesHydrated = useSyncExternalStore(
    () => () => {}, // Subscribe - there's nothing to subscribe to
    () => true, // Client snapshot: we are hydrated
    () => false, // Server snapshot: we are not hydrated
  )

  const colorMode: ColorMode = themesHydrated ? themeState.mode : 'system'
  const appResolvedTheme = themesHydrated ? themeState.resolvedColorScheme : undefined
  const lightThemeName = themesHydrated
    ? themeState.lightThemeName
    : docsThemeCatalog.defaultLightThemeName
  const darkThemeName = themesHydrated
    ? themeState.darkThemeName
    : docsThemeCatalog.defaultDarkThemeName
  const setColorMode = useCallback((mode: ColorMode) => {
    themeController.setColorMode(mode)
  }, [])
  const setLightThemeName = useCallback((name: LightThemeName) => {
    themeController.setThemeNameForScheme('light', name)
  }, [])
  const setDarkThemeName = useCallback((name: DarkThemeName) => {
    themeController.setThemeNameForScheme('dark', name)
  }, [])
  // The cycle button in the System Monitor sweeps through every Shiki
  // theme so reviewers can preview the full set without manually picking
  // each one. The hook captures the user's current pick when cycling
  // starts so the visible theme anchors the rotation.
  const themeCycle = useThemeCycle({
    lightThemeName,
    darkThemeName,
    resolvedThemeMode: appResolvedTheme,
    setLightThemeName,
    setDarkThemeName,
    setColorMode,
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<DiffsViewerHandle | null>(null)
  const loadDiffFiles = useMemo(() => {
    if (domain === CODEBERG_HOST) {
      return createCodebergDiffFileLoader(path)
    }
    return isNullish(domain) && githubSession.status === 'authenticated'
      ? createGitHubDiffFileLoader(path)
      : undefined
  }, [domain, githubSession.status, path])
  const handleCloseFileTreeOverlay = useStableCallback(() => {
    viewSettingsStore.trigger.fileTreeOverlayClosed()
  })
  const {
    allItems,
    applyCollapseModeToLoaded,
    commentFileByItemId,
    commentSections,
    diffStats,
    errorMessage,
    errorRemedy,
    initialItems,
    loadState,
    onLineLinkChange,
    onViewerReady,
    retryLoad,
    savedComments,
    treeSource,
    viewerKey,
  } = usePatchLoader({
    domain,
    onLoadStart: handleCloseFileTreeOverlay,
    path,
    viewerRef,
    viewSettingsStore,
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => {
      viewSettingsStore.trigger.viewportChanged({mobile: event.matches})
    }

    viewSettingsStore.trigger.viewportChanged({mobile: mediaQuery.matches})
    mediaQuery.addEventListener('change', handleChange)
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [viewSettingsStore])
  const handleSelectTreeItem = useStableCallback((itemId: string) => {
    viewSettingsStore.trigger.fileTreeOverlayClosed()
    const viewer = viewerRef.current
    if (isNullish(viewer)) {
      return
    }
    const item = viewer.getItem(itemId)
    if (!isNullish(item) && item.collapsed === true) {
      item.collapsed = false
      item.version = typeof item.version === 'number' ? item.version + 1 : 1
      viewer.updateItem(item)
    }
    viewer.scrollTo({
      type: 'item',
      id: itemId,
      align: 'start',
      behavior: 'smooth',
    })
  })
  const handleToggleCollapseMode = useStableCallback(() => {
    viewSettingsStore.trigger.collapseModeToggled()
    applyCollapseModeToLoaded(viewSettingsStore.getSnapshot().context.collapseMode)
  })
  const handleCommentSaved = useCallback(
    (comment: DiffsSavedCommentEvent) => {
      savedComments.trigger.commentSaved({comment, files: commentFileByItemId})
    },
    [commentFileByItemId, savedComments],
  )
  const handleCommentDeleted = useCallback(
    (comment: DiffsDeletedCommentEvent) => {
      savedComments.trigger.commentDeleted(comment)
    },
    [savedComments],
  )
  const handleToggleFileTreeOverlay = useStableCallback(() => {
    viewSettingsStore.trigger.fileTreeOverlayToggled()
  })
  // Only diff items carry two revisions to compare; a plain file item in the
  // viewer has nothing to diff against.
  const symbolDiffRequests = useMemo<readonly SymbolDiffRequest[]>(
    () =>
      allItems.flatMap((item) =>
        item.type === 'diff'
          ? [
              {
                itemId: item.id,
                name: item.fileDiff.name,
                prevName: item.fileDiff.prevName,
                type: item.fileDiff.type,
              },
            ]
          : [],
      ),
    [allItems],
  )
  const handleSelectSymbol = useStableCallback((selection: SymbolSelection) => {
    viewSettingsStore.trigger.fileTreeOverlayClosed()
    const viewer = viewerRef.current
    if (isNullish(viewer)) {
      return
    }
    // A collapsed file cannot be scrolled into, so open it first -- the same
    // dance the file tree does when selecting a collapsed item.
    const item = viewer.getItem(selection.itemId)
    if (!isNullish(item) && item.collapsed === true) {
      item.collapsed = false
      item.version = typeof item.version === 'number' ? item.version + 1 : 1
      viewer.updateItem(item)
    }
    viewer.scrollTo({
      type: 'line',
      id: selection.itemId,
      lineNumber: selection.lineNumber,
      side: selection.side,
      align: 'center',
      behavior: 'smooth-auto',
    })
  })
  const handleSelectComment = useStableCallback((comment: DiffsSavedCommentEntry) => {
    viewSettingsStore.trigger.fileTreeOverlayClosed()
    viewerRef.current?.setSelectedLines({
      id: comment.itemId,
      range: comment.range,
    })
    viewerRef.current?.scrollTo({
      type: 'line',
      id: comment.itemId,
      lineNumber: comment.range.end,
      side: comment.range.endSide ?? comment.range.side,
      align: 'center',
      behavior: 'smooth-auto',
    })
  })
  const patchShown = loadState === 'ready' || (loadState === 'streaming' && initialItems.length > 0)
  // Withhold the viewer until the persisted themes have been read from
  // localStorage. Otherwise on client-side navigation back into a diff the
  // CodeView would mount during the brief render where lightThemeName/darkThemeName
  // are still at their `DEFAULT_*_THEME` initial values and tokenize the
  // first batch of files against the wrong palette.
  // Also withhold it until the session is known. The session decides
  // `loadDiffFiles`, which adds a "more unchanged context" row to each partial
  // file. CodeView does not compute its file heights again when that option
  // changes. So a late session makes the scroll height too short for the last file.
  const viewerAvailable =
    workerPoolState !== 'initializing' &&
    themesHydrated &&
    githubSession.status !== 'loading' &&
    patchShown

  return (
    <ReviewGrid>
      <InertContents inert={fileTreeOverlayOpen}>
        <DiffsHeader
          className={css({gridArea: 'header'})}
          collapseMode={collapseMode}
          colorMode={colorMode}
          darkThemeName={darkThemeName}
          diffIndicators={diffIndicators}
          diffStyle={diffStyle}
          lightThemeName={lightThemeName}
          lineNumbers={lineNumbers}
          overflow={overflow}
          fileTreeOverlayOpen={fileTreeOverlayOpen}
          fileTreeAvailable={!isNullish(treeSource)}
          onToggleCollapseMode={handleToggleCollapseMode}
          onToggleFileTreeOverlay={handleToggleFileTreeOverlay}
          setColorMode={setColorMode}
          setDarkThemeName={setDarkThemeName}
          setDiffIndicators={setDiffIndicators}
          setDiffStyle={setDiffStyle}
          setLightThemeName={setLightThemeName}
          setLineNumbers={setLineNumbers}
          setOverflow={setOverflow}
          setShowBackgrounds={setShowBackgrounds}
          showBackgrounds={showBackgrounds}
        />
      </InertContents>
      {viewerAvailable && !isNullish(treeSource) ? (
        <>
          <DiffsSidebar
            baseMovedOn={baseMovedOn}
            className={css({gridArea: {base: 'viewer', md: 'tree'}})}
            commentSections={commentSections}
            diffStats={diffStats}
            domain={domain}
            symbolDiffRequests={symbolDiffRequests}
            mobileOverlayOpen={fileTreeOverlayOpen}
            onMobileClose={handleCloseFileTreeOverlay}
            onSelectComment={handleSelectComment}
            onSelectSymbol={handleSelectSymbol}
            scrollRef={scrollRef}
            source={treeSource}
            sourcePath={path}
            streaming={loadState === 'streaming'}
            symbolsAvailable={
              isNullish(domain) || (domain === CODEBERG_HOST && canReadCodebergFiles(path))
            }
            themeCycle={themeCycle}
            viewerRef={viewerRef}
            onSelectItem={handleSelectTreeItem}
          />
          <InertContents inert={fileTreeOverlayOpen}>
            <DiffsViewer
              key={viewerKey}
              className={css({gridArea: 'viewer'})}
              diffStyle={diffStyle}
              // A viewer that uses a failed pool starts a new initialization each
              // time it sets its theme. Without the pool, the viewer highlights on
              // the main thread with its own theme.
              disableWorkerPool={workerPoolState === 'failed'}
              overflow={overflow}
              showBackgrounds={showBackgrounds}
              diffIndicators={diffIndicators}
              lineNumbers={lineNumbers}
              scrollRef={scrollRef}
              themeType={colorMode}
              viewerRef={viewerRef}
              initialItems={initialItems}
              loadDiffFiles={loadDiffFiles}
              onCommentDeleted={handleCommentDeleted}
              onCommentSaved={handleCommentSaved}
              onLineLinkChange={onLineLinkChange}
              onViewerReady={onViewerReady}
            />
          </InertContents>
        </>
      ) : (
        <DiffsStatusPanel
          errorMessage={errorMessage}
          onRetry={retryLoad}
          remedy={errorRemedy}
          sourceName={isNullish(domain) ? 'GitHub' : domain}
          state={loadState}
          waitingFor={patchShown ? 'highlighter' : 'patch'}
        />
      )}
    </ReviewGrid>
  )
}

function createViewSettingSetters(store: ViewSettingsStore) {
  return {
    setDiffIndicators: (diffIndicators: ViewSettingsContext['diffIndicators']) =>
      store.trigger.diffIndicatorsChanged({diffIndicators}),
    setDiffStyle: (diffStyle: ViewSettingsContext['diffStyle']) =>
      store.trigger.diffStyleChanged({diffStyle}),
    setLineNumbers: (lineNumbers: boolean) => store.trigger.lineNumbersChanged({lineNumbers}),
    setOverflow: (overflow: ViewSettingsContext['overflow']) =>
      store.trigger.overflowChanged({overflow}),
    setShowBackgrounds: (showBackgrounds: boolean) =>
      store.trigger.showBackgroundsChanged({showBackgrounds}),
  }
}

interface ReviewGridProps {
  children: ReactNode
}

interface InertContentsProps {
  children: ReactNode
  inert: boolean
}

// A box with no layout of its own, so its child stays a grid item of
// ReviewGrid. While the phone file tree is open, `inert` keeps the parts
// behind it out of focus and out of the accessibility tree.
function InertContents({children, inert}: InertContentsProps) {
  return (
    <div className={css({display: 'contents'})} inert={inert}>
      {children}
    </div>
  )
}

function ReviewGrid({children}: ReviewGridProps) {
  return (
    <div
      className={css({
        display: 'grid',
        minH: '0',
        flex: '1',
        gridTemplateColumns: {
          base: 'repeat(1, minmax(0, 1fr))',
          md: '320px minmax(0, 1fr)',
        },
        gridTemplateRows: 'auto minmax(0, 1fr)',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        contain: 'strict',
        gridTemplateAreas: {
          base: '"header" "viewer"',
          md: '"header header" "tree viewer"',
        },
      })}
    >
      {children}
    </div>
  )
}
