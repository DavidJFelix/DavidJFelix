import type {
  CodeViewDiffItem,
  CodeViewItem,
  CodeViewLineSelection,
  CodeViewOptions,
  DiffIndicators,
  DiffLineAnnotation,
  FileDiffContentsLoader,
  SelectedLineRange,
  ThemeTypes,
} from '@pierre/diffs'
import {type CodeViewAnnotationArgs, useStableCallback} from '@pierre/diffs/react'
import {IconChevronSm} from '@pierre/icons'
import {useSelector, useStore} from '@xstate/store-react'
import {memo, type RefObject, useEffect, useMemo} from 'react'

import {css, cx} from 'styled-system/css'
import type {AvatarName} from '@/diffs/lib/annotation'
import {buildAnnotationThemeStyle} from '@/diffs/lib/annotation-theme-style'
import {classifyCommentLineType} from '@/diffs/lib/classify-comment-line-type'
import {CODE_VIEW_CUSTOM_CSS, CODE_VIEW_LAYOUT} from '@/diffs/lib/constants'
import {isDiffItem} from '@/diffs/lib/is-diff-item'
import {isDraftAnnotation} from '@/diffs/lib/is-draft-annotation'
import {isDraftMetadata} from '@/diffs/lib/is-draft-metadata'
import {isSavedAnnotation} from '@/diffs/lib/is-saved-annotation'
import {isNullish} from '@/diffs/lib/nullish'
import {diffsChromeMapping} from '@/diffs/lib/theme/diffs-chrome-mapping'
import type {
  CommentMetadata,
  DiffsDeletedCommentEvent,
  DiffsSavedCommentEvent,
  DiffsViewerHandle,
} from '@/diffs/lib/types'
import {type DraftComment, draftCommentLogic} from '@/diffs/state/draft-comment-store'
import {DraftAnnotation} from './draft-annotation'
import {ExampleAnnotation} from './example-annotation'
import {useChromeThemeProps} from './hooks/use-chrome-theme-props'
import {ThemedCodeView} from './themed-code-view'

function getNextItemVersion(item: CodeViewItem<CommentMetadata>): number {
  return typeof item.version === 'number' ? item.version + 1 : 1
}

function updateViewerDiffItem(
  viewer: DiffsViewerHandle | null,
  itemId: string,
  updateItem: (item: CodeViewDiffItem<CommentMetadata>) => boolean,
): CodeViewDiffItem<CommentMetadata> | undefined {
  const item = viewer?.getItem(itemId)
  if (isNullish(viewer) || isNullish(item) || !isDiffItem(item)) {
    return undefined
  }

  if (!updateItem(item)) {
    return undefined
  }

  item.version = getNextItemVersion(item)
  return viewer.updateItem(item) ? item : undefined
}

function removeAnnotation(item: CodeViewDiffItem<CommentMetadata>, key: string): boolean {
  if (isNullish(item.annotations)) {
    return false
  }

  const nextAnnotations = item.annotations.filter((annotation) => annotation.metadata.key !== key)
  if (nextAnnotations.length === item.annotations.length) {
    return false
  }

  item.annotations = nextAnnotations
  return true
}

function replaceDraftAnnotations(
  item: CodeViewDiffItem<CommentMetadata>,
  {key, lineNumber, range, side}: DraftComment,
): boolean {
  const nonDraftAnnotations = (item.annotations ?? []).filter(
    (annotation) => !isDraftMetadata(annotation.metadata),
  )
  const draftAnnotation: DiffLineAnnotation<CommentMetadata> = {
    side,
    lineNumber,
    metadata: {kind: 'draft', key, message: '', range},
  }
  item.annotations = [...nonDraftAnnotations, draftAnnotation]
  return true
}

function saveDraftAnnotation(
  item: CodeViewDiffItem<CommentMetadata>,
  {author, key, message}: Pick<DiffsSavedCommentEvent, 'author' | 'key' | 'message'>,
): boolean {
  const draftAnnotation = item.annotations?.find((annotation) => annotation.metadata.key === key)
  if (isNullish(draftAnnotation) || !isDraftAnnotation(draftAnnotation)) {
    return false
  }

  const savedAnnotation: DiffLineAnnotation<CommentMetadata> = {
    ...draftAnnotation,
    metadata: {kind: 'saved', key, author, message, range: draftAnnotation.metadata.range},
  }
  item.annotations = item.annotations?.map((annotation) =>
    annotation === draftAnnotation ? savedAnnotation : annotation,
  )
  return true
}

interface DiffsViewerProps {
  className?: string
  diffStyle: 'split' | 'unified'
  disableWorkerPool: boolean
  onCommentDeleted: (comment: DiffsDeletedCommentEvent) => void
  onCommentSaved: (comment: DiffsSavedCommentEvent) => void
  overflow: 'wrap' | 'scroll'
  showBackgrounds: boolean
  diffIndicators: DiffIndicators
  lineNumbers: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  themeType: ThemeTypes
  viewerRef: RefObject<DiffsViewerHandle | null>
  initialItems: CodeViewItem<CommentMetadata>[]
  loadDiffFiles?: FileDiffContentsLoader
  onLineLinkChange: (selection: CodeViewLineSelection | null) => void
  onViewerReady: () => void
}

export const DiffsViewer = memo(function DiffsViewer({
  className,
  diffStyle,
  disableWorkerPool,
  onCommentDeleted,
  onCommentSaved,
  overflow,
  showBackgrounds,
  diffIndicators,
  lineNumbers,
  scrollRef,
  themeType,
  viewerRef,
  initialItems,
  loadDiffFiles,
  onLineLinkChange,
  onViewerReady,
}: DiffsViewerProps) {
  const store = useStore(draftCommentLogic)
  const selectedLines = useSelector(store, ({context}) => context.selectedLines)
  const {style: chromeStyle} = useChromeThemeProps(diffsChromeMapping)
  // Preserve the previous `undefined`-means-not-resolved contract that
  // buildAnnotationThemeStyle and the className fallbacks depend on.
  const themeChromeStyle = Object.keys(chromeStyle).length > 0 ? chromeStyle : undefined
  const annotationThemeStyle = useMemo(
    () => buildAnnotationThemeStyle(themeChromeStyle),
    [themeChromeStyle],
  )

  // The viewer items keep the `annotations`, so this effect applies each change
  // that the store emits.
  useEffect(() => {
    const subscriptions = [
      store.on('draftDiscarded', ({itemId, key}) => {
        updateViewerDiffItem(viewerRef.current, itemId, (item) => removeAnnotation(item, key))
      }),
      store.on('draftOpened', (draft) => {
        updateViewerDiffItem(viewerRef.current, draft.itemId, (item) =>
          replaceDraftAnnotations(item, draft),
        )
      }),
      store.on('commentRemoved', ({itemId, key}) => {
        const {current: viewer} = viewerRef
        if (isNullish(viewer)) {
          return
        }
        const viewerItem = viewer.getItem(itemId)
        const removedAnnotation =
          !isNullish(viewerItem) && isDiffItem(viewerItem)
            ? viewerItem.annotations?.find((annotation) => annotation.metadata.key === key)
            : undefined

        updateViewerDiffItem(viewer, itemId, (item) => removeAnnotation(item, key))
        onLineLinkChange(null)
        if (!isNullish(removedAnnotation) && isSavedAnnotation(removedAnnotation)) {
          onCommentDeleted({itemId, key})
        }
      }),
      store.on('draftSaved', ({author, itemId, key, lineNumber, message, range, side}) => {
        const updatedItem = updateViewerDiffItem(viewerRef.current, itemId, (item) =>
          saveDraftAnnotation(item, {author, key, message}),
        )
        if (isNullish(updatedItem)) {
          return
        }

        onLineLinkChange(null)
        onCommentSaved({
          author,
          itemId,
          key,
          lineNumber,
          lineType: classifyCommentLineType(updatedItem.fileDiff, side, lineNumber),
          message,
          range,
          side,
        })
      }),
    ]
    return () => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe()
      }
    }
  }, [onCommentDeleted, onCommentSaved, onLineLinkChange, store, viewerRef])

  const handleSetSelection = useStableCallback((selection: CodeViewLineSelection | null) => {
    store.trigger.linesSelected({selection})
  })

  const handleToggleCommentSelection = useStableCallback((selection: CodeViewLineSelection) => {
    store.trigger.commentClicked({selection})
  })

  const handleLineSelectionEnd = useStableCallback(
    (range: SelectedLineRange | null, item: CodeViewItem<CommentMetadata>) => {
      if (isNullish(range) || item.type !== 'diff') {
        onLineLinkChange(null)
      } else {
        onLineLinkChange({id: item.id, range})
      }
    },
  )

  const handleViewerRef = useStableCallback((viewer: DiffsViewerHandle | null) => {
    viewerRef.current = viewer
    if (!isNullish(viewer)) {
      onViewerReady()
    }
  })

  const handleCreateDraftComment = useStableCallback((range: SelectedLineRange, itemId: string) => {
    store.trigger.gutterClicked({itemId, range})
  })

  const handleRemoveComment = useStableCallback((itemId: string, key: string) => {
    store.trigger.removeRequested({itemId, key})
  })

  const handleSaveDraftComment = useStableCallback(
    (comment: {itemId: string; key: string; message: string; author: AvatarName}) => {
      store.trigger.saveRequested(comment)
    },
  )

  const handleToggleItemCollapsed = useStableCallback((itemId: string) => {
    const {current: viewerHandle} = viewerRef
    const viewer = viewerHandle?.getInstance()
    const item = viewerHandle?.getItem(itemId)
    if (isNullish(viewerHandle) || isNullish(viewer) || isNullish(item)) {
      return
    }

    // NOTE(amadeus): If the top of the item is before the scrollTop, then
    // we'll want to apply a scroll fix on the next render to ensure we
    // keep the collapsed file in view and anchored.
    const itemTop = viewer.getTopForItem(itemId)
    item.collapsed = item.collapsed !== true
    item.version = getNextItemVersion(item)
    if (!viewerHandle.updateItem(item)) {
      return
    }

    if (!isNullish(itemTop) && itemTop < viewer.getScrollTop()) {
      viewer.scrollTo({
        type: 'item',
        id: item.id,
        align: 'start',
      })
    }
  })

  const renderCommentAnnotation = useStableCallback(
    (...[annotation, , item]: CodeViewAnnotationArgs<CommentMetadata>) => {
      if (!('side' in annotation) || item.type !== 'diff') {
        return null
      }

      if (isDraftAnnotation(annotation)) {
        return (
          <DraftAnnotation
            annotation={annotation}
            itemId={item.id}
            onCancel={handleRemoveComment}
            onSave={handleSaveDraftComment}
          />
        )
      }

      if (!isSavedAnnotation(annotation)) {
        return null
      }

      return (
        <ExampleAnnotation
          annotation={annotation}
          itemId={item.id}
          onDelete={handleRemoveComment}
          onToggleSelection={handleToggleCommentSelection}
        />
      )
    },
  )

  const renderHeaderPrefix = useStableCallback((item: CodeViewItem<CommentMetadata>) => {
    if (item.type !== 'diff') {
      return null
    }

    return (
      <CollapseDiffButton
        disabled={item.fileDiff.splitLineCount === 0 && item.fileDiff.unifiedLineCount === 0}
        collapsed={item.collapsed}
        onToggle={() => {
          handleToggleItemCollapsed(item.id)
        }}
      />
    )
  })

  // NOTE(amadeus): For some insane reason, the react compiler did not know how
  // to properly memoize this, so we pulled it into a `useMemo` for safety...
  const options: CodeViewOptions<CommentMetadata, undefined> = useMemo(
    () =>
      ({
        // Use this to validate itemMetrics when changing layout with unsafeCSS.
        // __devOnlyValidateItemHeights: true,
        layout: CODE_VIEW_LAYOUT,
        themeType,
        diffStyle,
        diffIndicators,
        overflow,
        loadDiffFiles,
        disableBackground: !showBackgrounds,
        disableLineNumbers: !lineNumbers,
        lineHoverHighlight: 'number',
        // hunkSeparators: 'line-info-basic',
        enableLineSelection: true,
        enableGutterUtility: true,
        stickyHeaders: true,
        unsafeCSS: CODE_VIEW_CUSTOM_CSS,
        // FIXME(amadeus): Move all `onX` methods onto the react component maybe?
        onGutterUtilityClick(range, context) {
          if (context.item.type !== 'diff') {
            return
          }
          handleCreateDraftComment(range, context.item.id)
        },
        onLineSelectionEnd(range, context) {
          handleLineSelectionEnd(range, context.item)
        },
      }) satisfies CodeViewOptions<CommentMetadata, undefined>,
    [
      diffIndicators,
      diffStyle,
      handleCreateDraftComment,
      handleLineSelectionEnd,
      lineNumbers,
      loadDiffFiles,
      overflow,
      showBackgrounds,
      themeType,
    ],
  )
  return (
    <ThemedCodeView<CommentMetadata>
      ref={handleViewerRef}
      containerRef={scrollRef}
      disableWorkerPool={disableWorkerPool}
      initialItems={initialItems}
      className={cx(
        className,
        'cv-scrollbar',
        css({
          position: 'relative',
          h: 'full',
          minH: '0',
          minW: '0',
          flex: '1',
          overflowY: 'auto',
          overflowX: 'clip',
          overscrollBehavior: 'contain',
          borderBottomWidth: {base: '1px', md: '0'},
          borderColor: 'diffs.border',
          w: 'full',
          contain: 'strict',
          overflowAnchor: 'none',
          willChange: 'scroll-position',
          '& diffs-container': {
            overflow: 'clip',
            contain: 'layout paint style',
            boxShadow:
              '[0 -1px 0 var(--diffs-diff-separator, var(--border-opaque)), 0 1px 0 var(--diffs-diff-separator, var(--border-opaque))]',
          },
        }),
      )}
      options={options}
      style={annotationThemeStyle}
      selectedLines={selectedLines}
      onSelectedLinesChange={handleSetSelection}
      renderAnnotation={renderCommentAnnotation}
      renderHeaderPrefix={renderHeaderPrefix}
    />
  )
})

interface CollapseDiffButtonProps {
  disabled?: boolean
  collapsed?: boolean
  onToggle: () => void
}

function CollapseDiffButton({
  disabled = false,
  collapsed = false,
  onToggle,
}: CollapseDiffButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-expanded={!disabled && !collapsed}
      aria-hidden={disabled}
      aria-label={disabled ? undefined : collapsed ? 'Expand diff' : 'Collapse diff'}
      className={css({
        color: 'diffs.muted.foreground',
        ml: '[-8px]',
        display: 'inline-flex',
        w: '6',
        h: '6',
        cursor: 'pointer',
        alignItems: 'center',
        justifyContent: 'center',
        rounded: 'diffs.md',
        transition:
          '[color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)]',
        _hover: {bg: 'diffs.muted', color: 'diffs.foreground'},
        _disabled: {pointerEvents: 'none', opacity: '0.5'},
      })}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
    >
      <IconChevronSm
        aria-hidden="true"
        className={cx(
          css({
            w: '4',
            h: '4',
            transition: '[transform 150ms cubic-bezier(0.4, 0, 0.2, 1)]',
          }),
          (disabled || collapsed) && css({transform: 'rotate(-90deg)'}),
        )}
      />
    </button>
  )
}
