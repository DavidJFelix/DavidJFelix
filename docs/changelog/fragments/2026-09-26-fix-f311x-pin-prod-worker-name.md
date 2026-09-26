### fix(f311x): pin the prod Worker name so a deploy can re-adopt it

Every f311x prod deploy since 2026-08-31 died at planning with an HTTP 500 from the account's
alchemy state store on the prod `Website` record, on alchemy beta.72, beta.77 and beta.79 alike.
Depot's stored diagnostics trace it to the PR 529 preview at 00:03 UTC that day: the store's
`/version` probe failed, and `--yes` made the CLI re-bootstrap the state store from empty local
state instead of failing, which minted a new encryption key over the existing one. The store
encrypts records with AES-CTR, which never rejects a wrong key, so every record written before that
moment now decrypts to garbage and the Worker's JSON parse dies. Preview stages written afterwards
were fine, which is why only prod broke; f311x.com kept serving the 08-30 build throughout.

The prod record is unrecoverable, so recovery deletes it and lets the next deploy adopt the live
Worker. That only works if alchemy computes the same physical name, and the name's random suffix
lived in the lost record, so prod now pins `name` to the Worker the smoke test already targets.
Adoption keeps the Worker's Durable Objects and domain attachments, and a `--dry-run` plan shows it
before anything is applied.
