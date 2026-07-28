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

## Codex chat-first coordination

Codex uses chat to agree the direction before creating a reviewable PR. Before starting a
new slice, creating a replacement PR, or making a change that introduces a decision,
present a concise agreement checkpoint containing:

1. the goal and in-scope / out-of-scope work;
2. the decision and alternatives, when a decision is required;
3. the intended branch, PR scope, and verification; and
4. whether an existing PR or another runtime's work is affected.

Wait for the user's response that confirms the proposed scope before implementing and
opening the PR. A response such as "進めて" is sufficient when the checkpoint has made
the scope explicit. A chat agreement authorizes preparation and review of a PR; it does
not by itself change the human approval requirement for ADRs, contracts, or other
governance artifacts.

Use the PR to review the implementation of the agreed scope and its verification
results, not to introduce a new decision for the first time. If implementation exposes a
new decision, a conflict, or a materially broader scope, stop and return to chat before
changing or creating the PR. Mechanical follow-up that does not change the agreed scope
(for example, reporting CI completion) does not need a new checkpoint.

## Role-agent dispatch

`meta/agents/<role>.md` is the executable role contract for `architect`, `designer`,
`developer`, `tester`, and `reviewer`. A role definition is not discovered or applied
automatically by the Codex runtime.

When a task is delegated to one of these roles (only with the authorization required by
`meta/permissions.md`), the orchestrator must, before dispatching it:

1. read the selected `meta/agents/<role>.md` in full;
2. include the role name and that file path in the dispatch routing;
3. read `meta/agent-runtime-mapping.md` and select the Codex runtime model mapped to
   that role; and
4. state only routing: the task/slice, authoritative documents to read, requested
   artifact, and applicable existing rules. Do not inject domain decisions or answers.

The selected role agent must read its role file, `meta/PRINCIPLES.md`, the active
project's `activeContext.md`, and the role-specific sources named by the role file
before taking task action. `tools` in role frontmatter records the intended capability
boundary. If a runtime cannot technically restrict tools per agent, the boundary remains
mandatory behavior; do not represent it as sandbox-enforced.

### Runtime mapping and parallel operation

`meta/agents/*.md` remains the shared role contract. Runtime-specific model selection
is defined only by `meta/agent-runtime-mapping.md`; do not rewrite role definitions for
Codex. Read that table before dispatching a role agent. If its Codex model is
unavailable, do not silently substitute a different model: report the unavailable
mapping and request a human decision or a documented mapping update.

Claude and Codex may develop the repository in parallel. Before starting a slice, read
the active context and inspect relevant open PRs. Do not edit another runtime's
unmerged project or shared `meta/**` changes without first coordinating through the
project branch and PR review.
