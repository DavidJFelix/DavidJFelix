import { z } from 'zod'

export const searchKnowledgeInput = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(50).default(8),
})
export type SearchKnowledgeInput = z.infer<typeof searchKnowledgeInput>

export const readFileInput = z.object({
  bucket: z.enum(['uploads', 'workspace']),
  key: z.string().min(1),
})
export type ReadFileInput = z.infer<typeof readFileInput>

export const writeFileInput = z.object({
  bucket: z.enum(['uploads', 'workspace']),
  key: z.string().min(1),
  contents: z.string(),
  contentType: z.string().optional(),
})
export type WriteFileInput = z.infer<typeof writeFileInput>

export const runCommandInput = z.object({
  cmd: z.string().min(1),
  cwd: z.string().optional(),
  timeoutMs: z.number().int().positive().max(120_000).default(30_000),
})
export type RunCommandInput = z.infer<typeof runCommandInput>

export const scheduleResearchInput = z.object({
  topic: z.string().min(1),
  depth: z.enum(['shallow', 'medium', 'deep']).default('medium'),
})
export type ScheduleResearchInput = z.infer<typeof scheduleResearchInput>

export const generateAndDeployHandlerInput = z.object({
  planId: z.string().min(1),
  source: z.string().min(1),
})
export type GenerateAndDeployHandlerInput = z.infer<
  typeof generateAndDeployHandlerInput
>
