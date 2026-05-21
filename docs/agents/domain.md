# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **Per-context `CONTEXT.md`** files (e.g. `apps/web/CONTEXT.md`, `apps/api/CONTEXT.md`).
- **`docs/adr/`** at the repo root for system-wide decisions, and **`apps/<context>/docs/adr/`** for context-scoped decisions. Read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

This is a multi-context repo (Turborepo monorepo). Expected layout:

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← system-wide decisions
├── apps/
│   ├── web/
│   │   ├── CONTEXT.md                 ← frontend domain language
│   │   └── docs/adr/                  ← frontend-scoped decisions
│   └── api/
│       ├── CONTEXT.md                 ← backend domain language
│       └── docs/adr/                  ← backend-scoped decisions
└── packages/
    ├── ui/
    ├── types/
    └── config/
```

`packages/*` share types and components across `apps/web` and `apps/api`; they don't get their own `CONTEXT.md` unless one of them grows enough domain language to warrant it.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
