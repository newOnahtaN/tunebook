# Agent guidance

Read `CLAUDE.md` for the site's data, privacy and no-playback rules, and read
`ROADMAP.md` before starting work. Update the relevant roadmap status and log
before finishing.

## Default delivery: push to main

Nate is the only contributor and considers this a low-risk personal project.
His standing preference, confirmed Sep 29, 2026, is to finish routine requested
work by committing and pushing directly to `origin/main`, not by leaving it on
a feature branch or requiring a pull request. Do not ask for another approval
just to deliver completed work this way. A request for a draft, review-only work,
a PR, or no deployment takes precedence for that task.

App-managed sessions may still use isolated worktree branches. Work in the
session's own worktree; do not switch or edit the shared main checkout.

1. Inspect the worktree and preserve unrelated edits. Fetch the latest
   `origin/main` and merge it into the session branch before final validation.
2. Resolve ordinary conflicts automatically by reading both sides and preserving
   both intended changes. Reconcile newer facts and differing scopes in docs;
   do not blindly choose an entire "ours" or "theirs" file. Regenerate derived
   files with the appropriate tool when needed.
3. Run the relevant tests/build, review the combined changes, and commit the
   completed work. From the session branch, push `HEAD:main` without force.
4. If another session advances `main`, fetch, merge, resolve, rerun affected
   checks, and retry the normal push. Do not make Nate coordinate ordinary
   concurrent-session conflicts.
5. Verify that the intended commit reached `origin/main`. Main pushes trigger
   Cloudflare deployment; check the deployment or relevant live behavior before
   calling it deployed. Report any deployment failure explicitly.

On Nate's Windows workstation, project-local `git personal` and `git gh` aliases
use the repository's personal GitHub account. For example:

```powershell
git personal fetch origin
git merge origin/main
# Resolve conflicts, validate and commit before pushing.
git personal push origin HEAD:main
```

Use normally configured Git on hosts without those aliases. Never copy tokens
into commands or source files, or alter unrelated projects' authentication.

This preference does not authorize force-pushing shared history, dropping another
session's work, destructive data/schema changes, bypassing access controls or
privacy rules, or merging with failing checks. Ask only when a conflict requires
a genuine product decision or cannot be resolved confidently without losing
intent. Low process overhead does not make Nate's private data disposable.

Keep delivery reports precise: committed locally, pushed to which branch, merged
into main, deployed, and live data imported are different states. Database
enrichment still uses the signed-in editor API; a Git push does not import data.
