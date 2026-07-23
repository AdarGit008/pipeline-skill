# pipeline-skill

The **`pipeline`** skill: a zero-dependency delivery-operations checker packaged as an
installable agent skill — sibling of [baseline-skill](https://github.com/AdarGit008/baseline-skill).

Where baseline asks *"is this repo ready to build and maintain?"*, pipeline asks
*"can this repo ship, recover, and prove it?"* — **39 rules across 9 families**
(descriptor, branching, CI/CD, environments, IaC, feature flags, rollback,
hotfix/incident, ledger), calibrated to declared failure cost via profiles
`solo` / `team` / `critical`. Blockers fail CI (exit 1); judgment calls resolve
via a dated sign-off ledger.

> The premise (inherited from its sibling): *don't trust a written promise — make something check it.*

## Quickstart

Zero dependencies. Requires **Node ≥ 18** and `git` on PATH; `gh` is optional (forge-reading
rules degrade to labeled SKIPs when it is absent or unauthenticated). Invoke by absolute path
— `check.mjs` loads its rule set from its own directory.

```sh
node check.mjs --repo /path/to/target        # score a repo's delivery posture (scorecard)
node check.mjs --repo /path/to/target --json # machine output
node check.mjs --self-check                  # validate the rule set's structural laws + coverage
```

Exit codes: `1` = a blocker FAILed · `0` = otherwise (warnings and SKIPs ride the output).

Declare posture in a `pipeline.repo.json` descriptor (start from
[`config-presets/`](config-presets/) or [`templates/pipeline.repo.json`](templates/pipeline.repo.json))
and tune checks in an optional `pipeline.config.json` (see [`config.example.json`](config.example.json)).

The judgment ledger authors and evaluates dated sign-offs, deviations, risk-acceptances, and
break-glass records:

```sh
node pipeline.mjs jdg new --kind sign-off --subject RB-02 --reason "drill ok" --review-by 2026-10-01
node pipeline.mjs jdg check                   # exit 1 on any tripped / expired / invalid record
```

Make a `pipeline` job a required status check so the standard runs on every PR — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) for this repo's self-gating setup.

## Docs

- **[`SKILL.md`](SKILL.md)** — the agent surface (score / init / fix / explain modes).
- **[`REFERENCE.md`](REFERENCE.md)** — data flow, config keys, CI wiring, ledger format.
- **[`GLOSSARY.md`](GLOSSARY.md)** — term definitions.
- **[`docs/spec/`](docs/spec/)** — the locked v0.1 spec: `SPEC.md` · `RULES.md` (every rule
  with a verbatim quote + URL source) · `ARCHITECTURE.md` · `SKILL-DRAFT.md` · `FOLLOW-UPS.md`.

## Community & contributing

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — build/test/PR flow, the zero-dependency rule, and the three CI gates.
- **[SUPPORT.md](SUPPORT.md)** — where questions and help requests belong.
- **[SECURITY.md](SECURITY.md)** — report a vulnerability privately (never in a public issue).
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — the Contributor Covenant this community follows.

This repo dogfoods its sibling for its own readiness — score it with
`node ../baseline/baseline-skill/check.mjs --repo .` (posture declared in `baseline.repo.json`).

## License

MIT

