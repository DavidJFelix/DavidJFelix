import {createFileRoute} from '@tanstack/react-router'

import diffsCss from '@/diffs/diffs.css?url'
import {InboxPage} from '@/inbox/components/inbox-page'
import {site} from '@/site'

// Like the home page, the inbox uses the diffs theme but not the /diffs layout.
export const Route = createFileRoute('/inbox')({
  head: () => ({
    meta: [{title: `Inbox · ${site.title}`}],
    links: [{rel: 'stylesheet', href: diffsCss}],
  }),
  component: InboxPage,
})
