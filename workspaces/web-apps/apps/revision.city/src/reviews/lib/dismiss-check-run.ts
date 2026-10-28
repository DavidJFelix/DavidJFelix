import {z} from 'zod'
import {type GitHubRepository, type GitHubRequest, repositoryPath} from './github-api'
import {APP_SLUG, completeCheckRun} from './publish-review'
import {canPush} from './resolved-threads'

// A dismissed check run has this external id, so that resolved threads no
// longer change it.
export const DISMISSED_EXTERNAL_ID = 'dismissed'

const checkRunSchema = z.object({
  conclusion: z.string().nullable(),
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
  // The user who clicked the button.
  login: string
}

export type DismissResult = 'dismissed' | 'refused' | 'unchanged'

// Passes a failed check run of the app when a user who can push asks for it.
export async function dismissCheckRun({
  request,
  repository,
  checkRunId,
  login,
}: DismissCheckRunParams): Promise<DismissResult> {
  if (!(await canPush({request, repository, login}))) {
    return 'refused'
  }
  const checkRun = await request({
    path: `${repositoryPath(repository)}/check-runs/${checkRunId}`,
    schema: checkRunSchema,
  })
  if (checkRun.app?.slug !== APP_SLUG || checkRun.conclusion !== 'failure') {
    return 'unchanged'
  }
  const {title, summary, text} = checkRun.output
  await completeCheckRun({
    request,
    repository,
    checkRunId,
    conclusion: 'success',
    output: {
      title: `Dismissed: ${title ?? ''}`,
      // A login has only letters, digits, and hyphens, so it cannot add a
      // mention or markup.
      summary: `${login} dismissed the findings, so this check passes. ${summary ?? ''}`,
      ...(text === null ? {} : {text}),
    },
    externalId: DISMISSED_EXTERNAL_ID,
  })
  return 'dismissed'
}
