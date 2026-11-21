import {z} from 'zod'
import {checkRunLogic, decodeCheckRun} from '../state/check-run-store'
import {type GitHubRepository, type GitHubRequest, repositoryPath} from './github-api'
import {APP_SLUG, updateCheckRun} from './publish-review'
import {canPush} from './resolved-threads'

const checkRunSchema = z.object({
  status: z.string(),
  conclusion: z.string().nullable(),
  external_id: z.string().nullable(),
  app: z.object({slug: z.string()}).nullable(),
  output: z.object({
    title: z.string().nullable(),
    summary: z.string().nullable(),
    text: z.string().nullable(),
  }),
})

export interface DismissCheckRunParams {
  request: GitHubRequest
  repository: GitHubRepository
  checkRunId: number
  clickedBy: string
}

export type DismissResult = 'dismissed' | 'refused' | 'unchanged'

// Passes a failed check run of the app when a user who can push asks for it.
export async function dismissCheckRun({
  request,
  repository,
  checkRunId,
  clickedBy,
}: DismissCheckRunParams): Promise<DismissResult> {
  if (!(await canPush({request, repository, login: clickedBy}))) {
    return 'refused'
  }
  const checkRun = await request({
    path: `${repositoryPath(repository)}/check-runs/${checkRunId}`,
    schema: checkRunSchema,
  })
  const store = checkRunLogic.createStore(decodeCheckRun(checkRun))
  if (checkRun.app?.slug !== APP_SLUG || !store.can.dismissed({by: clickedBy})) {
    return 'unchanged'
  }
  store.trigger.dismissed({by: clickedBy})
  await updateCheckRun({request, repository, checkRunId, state: store.getSnapshot().context})
  return 'dismissed'
}
