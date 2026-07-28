# Project entry point

Read [HANDOFF.md](HANDOFF.md) before taking task action. It routes you to the active project context and the repository's authoritative principles, permissions, and role guidance.

Do not duplicate those rules in this file. Follow the documents named by `HANDOFF.md`.

## Role agents and parallel operation

`meta/agents/*.md` is the shared role contract. Claude Code uses the corresponding
`.claude/agents/<role>.md` runtime definition; read
`meta/agent-runtime-mapping.md` before dispatching to confirm the role-to-runtime
mapping. Do not rewrite the shared role contract for one runtime.

Claude and Codex may develop this repository in parallel. Before starting a slice, read
the active context and inspect relevant open PRs. Do not edit another runtime's
unmerged project or shared `meta/**` changes without first coordinating through the
project branch and PR review.
