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

Follow the integration branch and PR target declared by `meta/guardrails.md`. Treat chat authorization as permission to draft unless the user explicitly approves the artifact. Report approval state from the artifact metadata and PR review state; a pushed branch or open PR is not itself human approval.

## Role-agent dispatch

`meta/agents/<role>.md` is the executable role contract for `architect`, `designer`,
`developer`, `tester`, and `reviewer`. A role definition is not discovered or applied
automatically by the Codex runtime.

When a task is delegated to one of these roles (only with the authorization required by
`meta/permissions.md`), the orchestrator must, before dispatching it:

1. read the selected `meta/agents/<role>.md` in full;
2. include the role name and that file path in the dispatch routing;
3. select the runtime model named by its `model` frontmatter; and
4. state only routing: the task/slice, authoritative documents to read, requested
   artifact, and applicable existing rules. Do not inject domain decisions or answers.

The selected role agent must read its role file, `meta/PRINCIPLES.md`, the active
project's `activeContext.md`, and the role-specific sources named by the role file
before taking task action. `tools` in role frontmatter records the intended capability
boundary. If a runtime cannot technically restrict tools per agent, the boundary remains
mandatory behavior; do not represent it as sandbox-enforced.

### Codex model mapping

The `model` value in each role definition is a Codex runtime identifier, not a Claude
alias. The current mapping is `sonnet` -> `gpt-5.6-terra` and `opus` -> `gpt-5.6-sol`.
If the named runtime is unavailable, do not silently substitute a different model:
report the unavailable mapping and request a human decision or a documented mapping
update.
