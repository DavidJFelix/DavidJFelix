---
description: Run the dependency-freshness skill — discover, evaluate, apply, and PR dependency updates across npm, mise, and Cargo
---

Run the `dependency-freshness` skill. Follow its SKILL.md exactly:

1. Discover outdated packages across npm, mise, and Cargo.
2. Classify each update (patch/minor/major/non-semver) and pull changelogs.
3. Group into PR batches: patch+minor per ecosystem, majors per package, known-incompatible isolated.
4. For each batch: branch, update, refresh lockfiles, install, verify (lint + test + build per affected project), commit, push, open a PR.
5. PR bodies must include the update table, changelog excerpts, verification results, and risks.
6. Open an escalation issue for anything the skill can't apply automatically.

If $ARGUMENTS is non-empty, treat it as an ecosystem filter (`npm`, `mise`, `cargo`) and only run that ecosystem.
