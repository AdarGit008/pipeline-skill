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

## Status

**Spec locked (v0.1) — implementation pending.** The build-ready spec lives in
[`docs/spec/`](docs/spec/): `SPEC.md` (vision/scope/profiles) · `RULES.md` (the locked
catalog, every rule with verbatim quote+URL source) · `ARCHITECTURE.md` (file map,
engine, check kinds, ledger, config, CI wiring) · `SKILL-DRAFT.md` · `FOLLOW-UPS.md`.

## License

MIT
