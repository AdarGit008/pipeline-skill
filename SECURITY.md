# Security policy

The `pipeline` checker (`check.mjs` / `pipeline.mjs`) is a set of zero-dependency
Node scripts that run **locally** and **read-only** over a repository — they install
nothing and make no network calls of their own. (`gh`, if present, is shelled out to
for the optional forge-reading rules; absent or unauthenticated, those rules degrade
to a labeled `SKIP`.) The attack surface is small, but we still take reports seriously.

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** via GitHub security advisories:
<https://github.com/AdarGit008/pipeline-skill/security/advisories/new>

Do **not** open a public issue for a security report. We aim to acknowledge within a
few days and will coordinate a fix and disclosure with you.

## Scope

In scope: the checker (`check.mjs`), the unified CLI (`pipeline.mjs`), and the judgment
ledger writer (`pipeline jdg new`) — e.g. a crafted repo, descriptor, config, or ledger
record that causes command execution, path traversal outside the target repo, or a crash
that is not degraded to a `SKIP`. The `gh` subprocess is invoked only to read forge state;
a report of it being made to write or to run an attacker-controlled command is in scope.

Out of scope: findings that require the user to point the tool at a repository they already
fully trust, or that require an already-compromised `gh`/`git` on `PATH`.
