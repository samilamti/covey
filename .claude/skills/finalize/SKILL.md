---
name: finalize
description: Post-plan wrap-up — review and update docs, CLAUDE.md, and memory, then create logical commits. Use every time you finish implementing an accepted plan.
---

Run this procedure after completing all implementation work from an accepted plan. Do NOT skip steps.

## 1. Identify what changed

```bash
git diff --stat
git diff --cached --stat
git status -u
```

Build a mental model of every file touched and what each change does.

## 2. Review and update project documentation

For each file in `docs/` (especially `architecture.md`, `roadmap.md`, `development.md`, `project-structure.md`):
- Read the file
- Check whether any section is now outdated or incomplete given the changes just made
- Update sections that need it — keep the same style and structure
- Do NOT touch files that don't need changes

Also check `docs-site/` if the changes affect user-facing concepts documented there.

## 3. Review and update CLAUDE.md

Read `CLAUDE.md` and check whether any of these sections need updating:
- **Architecture patterns** — new pattern introduced? Existing one changed?
- **Important files** — new files added? Existing ones renamed or removed?
- **Known issues / technical debt** — issue fixed? New debt introduced?
- **Development notes** — new gotcha discovered? Convention changed?
- **Current state** — phase status changed?

If CLAUDE.md needs changes, make them directly. Keep the same style — terse, factual, no filler.

## 4. Review and update session memory

Read `MEMORY.md` at `/Users/hiretsu/.claude/projects/-Users-hiretsu-Projects-Covey-app/memory/MEMORY.md`.

Check if anything learned during this implementation should be persisted:
- New debugging patterns → add to `debugging.md`
- New verified test data → add to MEMORY.md tables
- Environment quirks discovered → add to MEMORY.md
- Corrections to existing memory → update in place

Do NOT add session-specific context or speculative conclusions.

## 5. Create logical commits

Group the changes into logical, atomic commits. Each commit should be one coherent unit of work. Common groupings:

- **Feature code** — the core implementation (backend + frontend together if tightly coupled)
- **Tests** — new or updated tests for the feature
- **Locale/i18n** — translation key additions or changes
- **Docs** — documentation updates (docs/, CLAUDE.md)
- **Infra/config** — Docker, CI, env changes

For each commit:
1. Stage only the files belonging to that logical group (`git add <specific files>`)
2. Write a concise commit message — imperative mood, explains the *why* not just the *what*
3. Commit with the Co-Authored-By trailer

```bash
git commit -m "$(cat <<'EOF'
<imperative summary>

<optional body explaining why, not what>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

Order commits so that foundational changes come first (migrations → backend → frontend → tests → docs).

### Commit discipline
- Never use `git add -A` or `git add .` — always name files explicitly
- Check `git diff --cached` before each commit to verify only intended changes are staged
- If a file has mixed concerns (e.g., a route file with both feature code and a bug fix), commit it with the primary concern
- Do NOT amend previous commits — always create new ones

## 6. Final verification

After all commits:
```bash
git log --oneline -10
git status
```

Confirm working tree is clean and commit history reads as a coherent narrative.

## Notes
- This skill is meant to be invoked (manually or by habit) at the end of every plan execution
- If there are no doc changes needed, say so and skip step 2
- If CLAUDE.md is already accurate, say so and skip step 3
- Memory updates are optional — only persist genuinely reusable knowledge
