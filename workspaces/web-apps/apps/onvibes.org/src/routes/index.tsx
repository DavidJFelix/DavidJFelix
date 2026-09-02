import {createFileRoute} from '@tanstack/react-router'
import {useCallback, useState} from 'react'

import {AppShell} from '@/components/app-shell'
import {ConversationView} from '@/components/conversation-view'
import {Sidebar} from '@/components/sidebar'
import {
  appendMessage,
  type Conversation,
  createConversation,
  replaceConversation,
  SEED_CONVERSATIONS,
} from '@/lib/conversations'

export const Route = createFileRoute('/')({
  component: Home,
})

// Client state only: the seed fixtures are the "backend" until TanStack AI
// lands. Every transition goes through the pure functions in lib/conversations
// so swapping the store later is a change to this component alone.
function Home() {
  const [conversations, setConversations] =
    useState<ReadonlyArray<Conversation>>(SEED_CONVERSATIONS)
  const [activeId, setActiveId] = useState<string>(SEED_CONVERSATIONS[0]?.id ?? '')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0]

  const select = (id: string) => {
    setActiveId(id)
    setSidebarOpen(false)
  }

  const startNew = () => {
    const fresh = createConversation({id: crypto.randomUUID()})
    setConversations([fresh, ...conversations])
    select(fresh.id)
  }

  const send = (text: string) => {
    if (active === undefined) return
    const message = {id: crypto.randomUUID(), role: 'user' as const, text}
    setConversations(
      replaceConversation({
        conversations,
        conversation: appendMessage({conversation: active, message}),
      }),
    )
  }

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
        <ConversationView
          conversation={active}
          onSend={send}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      )}
    </AppShell>
  )
}
