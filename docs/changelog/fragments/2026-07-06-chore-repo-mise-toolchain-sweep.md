### chore(repo): refresh mise-managed toolchain

Updated the mise-managed toolchain and lockfile for compatible patch and minor releases: pnpm,
Biome, Oxlint, Prettier, Depot, Warden, and Pi. Left Node 26.4.0 skipped because local GPG
verification for the Node release failed on a missing public key.
