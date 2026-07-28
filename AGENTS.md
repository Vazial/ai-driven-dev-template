# Repository guidance

Before taking any task action, read [HANDOFF.md](HANDOFF.md). It is the repository onboarding entry point and identifies the authoritative context for the active project.

Then read, in this order:

1. the active project's `activeContext.md` — the sole source of current state and next work. For a new project, create it only after the project has been identified.
2. `meta/PRINCIPLES.md` — repository principles
3. `meta/permissions.md` — approval boundaries and escalation protocol
4. `meta/agents.md` — role responsibilities and the standard slice flow

Follow the documents above rather than repeating their rules here. In particular, do not treat `HANDOFF.md` as a progress log; update current state only through the mechanisms permitted by `meta/permissions.md`.

Before creating, committing, pushing, or reporting a reviewable artifact or PR, also read:

1. `meta/guardrails.md`
2. `meta/templates/pull-request.md`

Treat chat authorization as permission to draft unless the user explicitly approves the artifact. Report approval state from the artifact metadata and PR review state; a pushed branch or open PR is not itself human approval.
