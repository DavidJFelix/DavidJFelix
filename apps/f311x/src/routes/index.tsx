import {fetchServerSentEvents, useChat} from '@tanstack/ai-react'
import {createFileRoute} from '@tanstack/react-router'
import {ArrowUp, Square} from 'lucide-react'
import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from '@/components/ui/chat-container'
import {Loader} from '@/components/ui/loader'
import {Message, MessageAvatar, MessageContent} from '@/components/ui/message'
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input'
import {ScrollButton} from '@/components/ui/scroll-button'

export const Route = createFileRoute('/')({component: ChatPage})

const AGENT_ENDPOINT = '/agents/chat-agent/default'

type ChatMessagePart = {type: string; text?: string}

function ChatPage() {
  const chat = useChat({
    connection: fetchServerSentEvents(AGENT_ENDPOINT),
  })
  const [draft, setDraft] = useState('')

  const isStreaming = chat.status === 'streaming'

  const handleSubmit = async () => {
    const text = draft.trim()
    if (!text || isStreaming) return
    setDraft('')
    await chat.sendMessage(text)
  }

  const handleButtonClick = () => {
    if (isStreaming) {
      chat.stop()
      return
    }
    void handleSubmit()
  }

  return (
    <main className="flex h-dvh flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight">f311x</h1>
          <p className="text-muted-foreground text-xs">
            Effect-native agent on Cloudflare Workers
          </p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden">
        <ChatContainerRoot className="relative flex-1 px-4 py-6">
          <ChatContainerContent className="space-y-6">
            {chat.messages.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-20 text-sm">
                <p>Start a conversation with the agent.</p>
              </div>
            ) : (
              chat.messages.map((m) => {
                const body = renderMessageBody(m)
                const isUser = m.role === 'user'
                return (
                  <Message
                    key={m.id}
                    className={isUser ? 'flex-row-reverse' : ''}
                  >
                    <MessageAvatar
                      src=""
                      alt={m.role}
                      fallback={isUser ? 'U' : 'A'}
                    />
                    <MessageContent
                      markdown={!isUser}
                      className={
                        isUser
                          ? 'bg-primary text-primary-foreground max-w-[80%]'
                          : 'max-w-[80%]'
                      }
                    >
                      {body || (isStreaming ? '…' : '')}
                    </MessageContent>
                  </Message>
                )
              })
            )}
            {isStreaming && (
              <div className="text-muted-foreground flex items-center gap-2 pl-11 text-xs">
                <Loader variant="typing" />
                <span>Thinking…</span>
              </div>
            )}
            <ChatContainerScrollAnchor />
          </ChatContainerContent>
          <div className="pointer-events-none absolute right-4 bottom-4 flex justify-end">
            <div className="pointer-events-auto">
              <ScrollButton />
            </div>
          </div>
        </ChatContainerRoot>

        <div className="border-border border-t px-4 py-4">
          <PromptInput
            value={draft}
            onValueChange={setDraft}
            isLoading={isStreaming}
            onSubmit={handleSubmit}
          >
            <PromptInputTextarea placeholder="Message the agent…" />
            <PromptInputActions className="justify-end pt-2">
              <Button
                size="icon"
                className="size-9 rounded-full"
                onClick={handleButtonClick}
                disabled={!isStreaming && draft.trim().length === 0}
                aria-label={isStreaming ? 'Stop' : 'Send'}
              >
                {isStreaming ? (
                  <Square className="size-4 fill-current" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </Button>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </main>
  )
}

const renderMessageBody = (m: {parts?: Array<ChatMessagePart>}) =>
  (m.parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('')
