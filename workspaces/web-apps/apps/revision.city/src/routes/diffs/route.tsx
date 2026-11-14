import {ogTags} from '@davidjfelix/og'
import {createFileRoute, Outlet} from '@tanstack/react-router'
import {ThemeProvider} from '@/diffs/components/contexts/theme-context'
import {PreloadHighlighter} from '@/diffs/components/preload-highlighter'
import {ScrollbarGutterVariables} from '@/diffs/components/scrollbar-gutter-variables'
import {Toaster} from '@/diffs/components/ui/toaster'
import {WorkerPoolContext} from '@/diffs/components/worker-pool-context'
import diffsCss from '@/diffs/diffs.css?url'
import {SITE_DESCRIPTION, SITE_NAME} from '@/diffs/lib/site'

export const Route = createFileRoute('/diffs')({
  head: () => ({
    meta: [
      {title: `${SITE_NAME} · revision.city`},
      {name: 'description', content: SITE_DESCRIPTION},
      ...ogTags({title: `${SITE_NAME} · revision.city`, description: SITE_DESCRIPTION}),
      // The diffs surface is a full-viewport app, so it extends into the safe
      // areas. Do not lock the scale: people must be able to zoom. The text
      // boxes are 16px on phones, so iOS does not zoom the page on focus.
      {name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover'},
    ],
    links: [{rel: 'stylesheet', href: diffsCss}],
  }),
  component: DiffsLayout,
})

function DiffsLayout() {
  return (
    <>
      <ScrollbarGutterVariables />
      <WorkerPoolContext>
        <ThemeProvider attribute="class">
          <Outlet />
          <Toaster />
          <div id="dark-mode-portal-container" className="dark" data-theme="dark"></div>
          <div id="light-mode-portal-container" className="light" data-theme="light"></div>
        </ThemeProvider>
      </WorkerPoolContext>
      <PreloadHighlighter />
    </>
  )
}
