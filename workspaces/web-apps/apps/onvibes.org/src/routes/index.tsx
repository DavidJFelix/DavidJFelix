import {createFileRoute} from '@tanstack/react-router'
import {useCallback, useId, useState} from 'react'

import {ActiveConversation, type MessagesChange} from '@/components/active-conversation'
import {AppShell} from '@/components/app-shell'
import {Sidebar} from '@/components/sidebar'
import {
  type Conversation,
  createConversation,
  replaceConversation,
  withMessages,
} from '@/lib/conversations'

export const Route = createFileRoute('/')({
  component: Home,
})

// Conversations are client state for the page's lifetime: the list and the
// selection live here, the active thread is driven by TanStack AI inside
// ActiveConversation and mirrored back through withMessages. Every transition
// goes through the pure functions in lib/conversations, so persisting the list
// later is a change to this component alone.
function Home() {
  // Stable across SSR and hydration, unlike a random id, so the first
  // conversation is the same one on both sides.
  const firstId = useId()
  const [conversations, setConversations] = useState<ReadonlyArray<Conversation>>(() => [
    createConversation({id: firstId, now: Date.now()}),
  ])
  const [activeId, setActiveId] = useState(firstId)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0]

  const select = (id: string) => {
    setActiveId(id)
    setSidebarOpen(false)
  }

  const startNew = () => {
    const fresh = createConversation({id: crypto.randomUUID(), now: Date.now()})
    setConversations([fresh, ...conversations])
    select(fresh.id)
  }

  // Stable identity: ActiveConversation re-syncs whenever this changes.
  const handleMessagesChange = useCallback(({id, messages}: MessagesChange) => {
    setConversations((current) => {
      const conversation = current.find((c) => c.id === id)
      if (conversation === undefined) return current
      const next = withMessages({conversation, messages, now: Date.now()})
      return next === conversation
        ? current
        : replaceConversation({conversations: current, conversation: next})
    })
  }, [])

  return (
    <AppShell
      sidebarOpen={sidebarOpen}
      onSidebarClose={closeSidebar}
      sidebar={
        <Sidebar
          conversations={conversations}
          activeId={active?.id ?? null}
          onSelect={select}
          onNew={startNew}
          onClose={closeSidebar}
        />
      }
    >
      {active === undefined ? null : (
        <ActiveConversation
          key={active.id}
          conversation={active}
          onMessagesChange={handleMessagesChange}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      )}
    </AppShell>
  )
}
