import {fetchServerSentEvents, useChat} from '@tanstack/ai-react'
import {useEffect, useMemo} from 'react'
import {ConversationView} from '@/components/conversation-view'
import {describeChatError} from '@/lib/chat-errors'
import {type Conversation, type Message, messagesFromUI, messageToUI} from '@/lib/conversations'

export const CHAT_ENDPOINT = '/api/chat'

// Hoisted: useChat rebuilds its client whenever the connection changes.
const connection = fetchServerSentEvents(CHAT_ENDPOINT)

export interface MessagesChange {
  id: string
  messages: ReadonlyArray<Message>
}

export interface ActiveConversationProps {
  conversation: Conversation
  onMessagesChange: (change: MessagesChange) => void
  onOpenSidebar: () => void
}

// The one conversation TanStack AI is driving. Mount it keyed by conversation
// id: the hook seeds from the stored messages, then every change -- the send,
// each streamed delta, a stop -- flows back up through onMessagesChange, so the
// sidebar follows the thread and the thread survives switching away and back.
export function ActiveConversation({
  conversation,
  onMessagesChange,
  onOpenSidebar,
}: ActiveConversationProps) {
  const chat = useChat({
    connection,
    threadId: conversation.id,
    initialMessages: conversation.messages.map(messageToUI),
  })

  const messages = useMemo(() => messagesFromUI(chat.messages), [chat.messages])
  useEffect(() => {
    onMessagesChange({id: conversation.id, messages})
  }, [conversation.id, messages, onMessagesChange])

  return (
    <ConversationView
      conversation={{...conversation, messages}}
      busy={chat.isLoading}
      error={chat.error === undefined ? undefined : describeChatError(chat.error)}
      onSend={(text) => void chat.sendMessage(text)}
      onStop={chat.stop}
      onRetry={() => void chat.reload()}
      onOpenSidebar={onOpenSidebar}
    />
  )
}
