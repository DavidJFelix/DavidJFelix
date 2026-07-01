// Alchemy v2 stack that provisions the CI credentials for f311x: a
// least-privilege Cloudflare account API token, pushed into this repo's
// GitHub Actions secrets. Effect-native and loaded by the Alchemy CLI,
// like alchemy.run.ts.

import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as GitHub from 'alchemy/GitHub'
import * as Config from 'effect/Config'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Redacted from 'effect/Redacted'

export default Alchemy.Stack(
  'github',
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const accountId = yield* Config.string('CLOUDFLARE_ACCOUNT_ID')
    const apiToken = yield* Cloudflare.AccountApiToken('CIToken', {
      accountId,
      policies: [
        {
          effect: 'allow',
          permissionGroups: [
            'Workers Scripts Write',
            'Workers KV Storage Write',
            'Workers R2 Storage Write',
            'D1 Write',
            'Queues Write',
            'Pages Write',
            'Account Settings Write',
            'Workers Tail Read',
          ],
          resources: {
            [`com.cloudflare.api.account.${accountId}`]: '*',
          },
        },
      ],
    })

    yield* GitHub.Secret('cf-api-token', {
      owner: 'DavidJFelix',
      repository: 'DavidJFelix',
      name: 'F311X_CLOUDFLARE_API_TOKEN',
      value: apiToken.value,
    })

    yield* GitHub.Secret('cf-account-id', {
      owner: 'DavidJFelix',
      repository: 'DavidJFelix',
      name: 'F311X_CLOUDFLARE_ACCOUNT_ID',
      value: Redacted.make(accountId),
    })
  }),
)
