// Tool registry. Each tool is a single definition consumed by:
//   1. React components, as a TanStack Start server function
//   2. The chat agent, adapted into the Vercel AI SDK tool shape
//
// Add new tools here and they show up in both surfaces.

export {generateAndDeployHandler} from './generate-and-deploy-handler'
export {readFile} from './read-file'
export {runCommand} from './run-command'
export {scheduleResearch} from './schedule-research'
export {searchKnowledge} from './search-knowledge'
export {writeFile} from './write-file'

import {generateAndDeployHandler} from './generate-and-deploy-handler'
import {readFile} from './read-file'
import {runCommand} from './run-command'
import {scheduleResearch} from './schedule-research'
import {searchKnowledge} from './search-knowledge'
import {writeFile} from './write-file'

export const tools = {
  searchKnowledge,
  readFile,
  writeFile,
  runCommand,
  scheduleResearch,
  generateAndDeployHandler,
} as const
