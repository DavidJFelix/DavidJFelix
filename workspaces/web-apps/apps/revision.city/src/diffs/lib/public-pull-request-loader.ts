import {createServerFn} from '@tanstack/react-start'

import {readGitHubAppCredentials} from './github-auth'
import {fetchPublicPullRequest, type PublicPullRequest} from './github-public-pull-request'
import {type PullRequestReference, validatePullRequestReference} from './pull-request-reference'

// The viewer loader's window onto GitHub's public view of a pull request. A
// server function because the loader also runs in the browser on client-side
// navigation, while the app credentials, the edge cache, and GitHub's rate
// limit all live on the Worker. The validator's declared input is what the
// loader must hand over; the check inside it is what the wire gets.
export const loadPublicPullRequest = createServerFn()
  .validator((input: PullRequestReference) => validatePullRequestReference(input))
  .handler(({data}): Promise<PublicPullRequest | undefined> =>
    fetchPublicPullRequest({
      repo: {owner: data.owner, repo: data.repo},
      number: data.number,
      credentials: readGitHubAppCredentials(),
    }),
  )
