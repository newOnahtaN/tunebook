# Agent guidance

Read `CLAUDE.md` for the site's data, privacy and no-playback rules, and read
`ROADMAP.md` before starting work. Update the relevant roadmap status and log
before finishing.

## Different devices, different workflows

Work on this repo happens from more than one device, and each has different tools, so the delivery steps differ.
Before following a device-specific step, check what this session actually has (a git checkout? Wrangler? only a
browser?) and do not assume another device's setup exists. The rules in `CLAUDE.md` (privacy, no media playback,
fully enriched tunes) and the roadmap and reporting duties apply on every device.

| Device | What it has | Code delivery | Data |
|---|---|---|---|
| Nate's Windows workstation (local app sessions) | A git checkout with the `git personal` / `git gh` aliases; Node and Wrangler for dry-run builds and tests; Wrangler authorized for the `tunebook` D1 database through device OAuth, with credentials in Windows Credential Manager | Worktree, validate, push `HEAD:main` (steps below) | Signed-in editor API for writes; read-only D1 queries through Wrangler for verification |
| Cloud or mobile session linked to Nate's browser | No checkout, no Wrangler or D1 credentials, and no build or test runner. `gh api` is blocked unless the repo is attached with push access (`add_repo`). The browser pane can be signed in to GitHub and, as Nate, to the site | Attach the repo with push access and use normal git, or commit through GitHub's web editor (below). Either way the commit goes straight to `main` | Signed-in editor API from a tab on the site; no direct D1 |

Delivering through GitHub's web editor (no checkout):

1. On a github.com tab, fetch the current file from `https://github.com/newOnahtaN/tunebook/raw/refs/heads/main/<path>`
   without credentials, and apply exact string replacements, checking that each target matches exactly once.
2. Keep the new text in `localStorage` on github.com so it survives navigating to `.../edit/main/<path>`, load it into
   the CodeMirror editor with `view.dispatch`, and confirm the editor text hashes (SHA-256) to the intended content.
3. Open "Commit changes...", click into the visible message fields and type the message. Never find the fields with a
   script query for `input[type=text]`: the filename input matches, and a "/" in the message silently renames the file.
4. Commit one file at a time, then re-fetch the raw file and compare hashes. With no build or tests available,
   the Workers build and a check of the live site are the validation; do not call the work deployed before both.
5. Code reaches `main` this way but data does not: data still goes through the editor API.

Browser-tool notes for cloud sessions (learned in Oct 2026):

- Reading: JavaScript results from the Chrome extension are capped at roughly 1,500 characters, and its output
filter blanks any result containing `?`, `=`, `&` or words that look like secrets, so replace those characters
before returning text. To read a whole file, open `https://github.com/newOnahtaN/tunebook/raw/main/<path>` and
extract the page text, which returns tens of thousands of characters.
- Carrying text between pages: `window.name` survives a same-tab navigation, even across origins (site tab to
github.com and back); `localStorage` only works within one origin. Anything that must outlive the session (inputs,
research, lists) belongs in the repo, never only in a browser's storage.
- A tab left in the background can stop resolving `fetch` calls made from injected scripts, and stale tabs cause
"Couldn't determine which page this action targets". Open a fresh tab in the session's group and close old ones.
- The "Commit changes..." button sometimes has to be clicked twice before the dialog and its own "Commit changes"
button exist. GitHub may replace the commit message with an auto-generated one.
- New files: open `.../new/main/<folder>`, set the input labeled "File name", then load the editor.
- In Oct 2026 several commits landed as empty files and a Worker that imported an empty module took the API down.
Compare each committed file's length or hash with the intended text before moving on, and commit a new module
before the code that imports it.

When reporting, say which device the work ran on and which of committed, pushed, deployed and live data changed.

## Default delivery: push to main

Nate is the only contributor and considers this a low-risk personal project.
His standing preference, confirmed Sep 29, 2026, is to finish routine requested
work by committing and pushing directly to `origin/main`, not by leaving it on
a feature branch or requiring a pull request. Do not ask for another approval
just to deliver completed work this way. A request for a draft, review-only work,
a PR, or no deployment takes precedence for that task.

On a device with a local checkout, app-managed sessions may use isolated worktree branches. Work in the
session's own worktree; do not switch or edit the shared main checkout. Devices without a checkout deliver
differently; see the next section.

On a device with a git checkout:

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
git merge --no-commit origin/main
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
