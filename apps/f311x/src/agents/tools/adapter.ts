import { tool, type Tool, type ToolSet } from 'ai'
import type { SchemaInput, ServerTool } from '@tanstack/ai'

// Bridge TanStack AI's `toolDefinition(...).server(execute)` output (a
// `ServerTool`) into the Vercel AI SDK's `tool({...})` shape. Both speak
// Zod / Standard Schema, so this is a wrapping exercise.
//
// Used inside `AIChatAgent.onChatMessage` to expose the same tool defs
// that React server-function callers use.

export const toAiSdkTool = (
  serverTool: ServerTool<SchemaInput, SchemaInput, string>,
): Tool => {
  return tool({
    description: serverTool.description,
    inputSchema: serverTool.inputSchema as never,
    execute: serverTool.execute as never,
  })
}

export const toAiSdkToolSet = (
  serverTools: Record<string, ServerTool<SchemaInput, SchemaInput, string>>,
): ToolSet => {
  const out: Record<string, Tool> = {}
  for (const [key, t] of Object.entries(serverTools)) {
    out[key] = toAiSdkTool(t)
  }
  return out as ToolSet
}
