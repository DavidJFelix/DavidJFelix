### feat(alchemy-state-viewer): read the state-store token via a Secrets Store binding

The viewer no longer wants the alchemy state-store bearer token copied into its own worker secrets.
Instead, `wrangler.toml` declares a `secrets_store_secrets` binding (`ALCHEMY_STATE_TOKEN_SECRET`)
to the `AlchemyStateStoreToken` secret the alchemy bootstrap already maintains in the account
Secrets Store, and the config resolver reads it at request time (`binding.get()`). The token value
is never handled by a human, and rotation is picked up automatically. `ALCHEMY_STATE_URL` stays as
the one plain worker secret; the `ALCHEMY_STATE_TOKEN` string env survives purely as the local-dev
override in `.dev.vars`, where the real binding is not available.
