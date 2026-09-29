# AGENTS.md

Non-obvious learnings for future sessions in this repo. Terse by design.

## Session process
- An approved plan does NOT mean the work exists: in one session, the post-approval implementation turn silently produced zero file changes. Always verify worktree state (`ls`, build artifacts) before building on prior turns.
- Don't trust click success in the live preview: verify each click's effect with a fresh snapshot; uids go stale after any re-render and one click landed on the wrong tab because layout shifted.
- Session restarts kill the dev server; `Start-Process cmd '/c npm run dev > vite-dev.log 2>&1'` + `Test-NetConnection localhost -Port 5173` is the reliable restart pattern (nohup is not available on this Windows host).
- Model-generated `write_file`/`str_replace` calls can emit corrupted tokens (broken JSX, invented imports). After any glitchy edit, re-read the file before building; a clean full-file rewrite of the affected file is the fastest recovery.
- Supabase SQL editor inserts via preview automation: Monaco ignores programmatic value-set; copy to real clipboard (`execCommand('copy')` on a hidden textarea + hash check), focus the `.monaco-editor textarea` with a REAL click (document must be focused), then Ctrl+A/Ctrl+V via preview keys, click Run → "Potential issue detected" dialog → "Run query". `monaco…applyEdits` updates content but not a11y/React state (Run stays dead); fetching `http://localhost/*.sql` from the HTTPS dashboard is blocked by PNA/CORS even with OPTIONS headers — clipboard route only.

## Environment (Windows host, German locale)
- `run_terminal_command` supports `process_type: BACKGROUND`; for a preview-registered server prefer the detached PowerShell recipe in the run doc `.freebuff/.freebuff/run.md` (Start-Process `npm.cmd` … `-PassThru`, it yields the PID `register_preview` needs). Plain `nohup npm run dev > vite-dev.log 2>&1 &` still works for ad-hoc servers.
- A dev server from an earlier session may still hold port 5173 (nohup'd, log in `vite-dev.log`). Probe `curl http://localhost:5173/` before starting another one.
- Vite binds IPv6-only (`[::1]:5173`) and netstat prints German state names (`ABHÖREN`): find the PID with plain `netstat -ano | grep 5173`, not by grepping `LISTENING`.
- `register_preview` wants the PID of the node process that owns the port (from netstat), not the npm/nohup wrapper PID.
- Project root path contains spaces and umlauts (`Downloads\Online-Apps zum Geldverdienen entwickeln - Claude_files`) — always quote absolute paths in shell commands.
- Incognito preview tabs discard localStorage (no `sb-*` keys ever persist; the auth session can vanish WITHOUT a reload — onAuthStateChange fires null). Cross-tab sync tests need a second non-incognito tab: those share the persisted session and storage.
- After a Freebuff restart the dev server is gone; re-run the detached-start recipe from the run doc and re-register the preview (the run doc's "Aktueller Stand" section records the last verified PID/URL).

## Testing the live preview
- `preview_navigate` with `to: "reload"` usually reports "no load event observed within 15s" even on success — misleading; just snapshot afterwards.
- Setting `el.value` + dispatching `input` does not update React controlled inputs (silently fails validation). Use the native setter: `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)` then dispatch the event.
- Do not assert on `document.body.innerText` for styled text: Tailwind `uppercase` changes rendered text (`GRUNDUMSATZ`), so `includes('Grundumsatz')` is false. Match case-insensitively or use snapshots/aria.
- `preview_evaluate` has a ~10 s limit and runs in an ISOLATED JS world: its `import('/src/…')` resolves a module URL without the `?t=` HMR param, i.e. a *second* module instance (a second Supabase client reports `getChannels() === []` while the app's channels are live). Read app state from the DOM instead (e.g. `documentElement.dataset` markers written by an injected main-world script).
- Titlebar buttons (`XpTitleButton`) render `—`/`✕` as visible content; the real label is an aria-label that appears only in snapshot accessible names — never match them via `innerText`.

## Architecture couplings & constraints
- Cloud backend is LIVE: Supabase project `nekbtgufqysaodahknmv` (keys in git-ignored `.env.local`; `.env.example` must stay placeholder-only). Test account `buffy.test@web.de`. `supabase/setup.sql` is idempotent and must be re-run from the dashboard if tables are missing (app then shows the profile-retry screen instead of data).
- Design is now dark teal "Liquid Chrome" (user's reference image): tokens in `index.css` `:root`, `.glass-*` classes; primitives keep XP names in `ui.tsx` (XpWindow, XpButton…) as compat aliases. The chrome rim needs BOTH `border: 1px solid transparent` and the `… padding-box, var(--chrome) border-box` double background — drop either and the rim vanishes. Old XP bevel colors (#ece9d8/#003399/#808080) are long gone.
- Meal photo flow: `DayView` time-check (`checkPhotoTime` via `file.lastModified`) → optional warning with "Trotzdem verwenden" → `completeMealWithPhoto` (upload first, then DB upsert). Meal checks REQUIRE a photo both client- and DB-side (`meal_requires_photo` constraint); workout checks are photo-less. Keep both in sync with `supabase/setup.sql`.
- Photo preview is deliberately small (h-24 w-32) with a lightbox zoom (`PhotoLightbox`: Escape/backdrop close, body scroll lock resets to '' not restored value).
- Pro entitlement is checked in exactly one place: `src/hooks/usePro.ts`. Future payment integration (RevenueCat/Stripe) must hook there. The upgrade button is a local demo; real payments need a backend/webhooks — deliberately out of scope (user decision).
- Hidden coupling: `ShoppingList`'s "only checked days" filter matches the exact check-id format `d${dayIndex}-workout-0` produced in `DayView`. Change one and the other silently breaks.
- Reroll was once a no-op because `rerolls` did not reach the deterministic builder; it is now fixed by passing a seed through `buildWeekPlan` into recipe/workout selection. Preserve that data flow when changing plan generation.
- `useWeekChecks` keys storage by week-start ISO date so checks reset every Monday — by design, don't "fix" it.
- Files in `reference/claude-assets/` are browser-saved claude.ai assets (third-party, proprietary). Never import or bundle them; visual reference only.
- Realtime sync invariant (`useWeights`/`useEquipment`, was a shipped bug): merge a remote row with the **new value LAST** — the dedupe maps are last-wins, so prepending it lets the stale local value silently win (payload arrives, `apply()` runs, UI unchanged). While a local write is in flight (dirty set), stash the remote overlay and flush it in `persist`'s `finally`, else remote writes are dropped until the next fetch. Realtime `numeric` payloads can arrive as strings — coerce with `Number()`.

## User preferences
- Feature specs arrive in German; all UI copy is German with de-DE formatting (`1.670 kcal`). Match the language of the user's current message.
- Product scope agreed: full planner + free/pro split now; accounts/payments deferred until a backend exists.

## Tooling quirks
- `write_file` rejects calls missing the `instructions` field; the validation error only shows truncated content, which is easy to misread as a size problem.
- `write_doc` is unavailable in this environment despite being listed as a tool; use `write_file` for new files. Shell redirection can also be refused while the client reports plan mode, even when `exit_plan` reports the opposite.
- In `run_terminal_command`, bash eats `$var` inside double-quoted powershell -Command strings; use single quotes around the whole -Command and double quotes inside, or avoid variables.
- Supabase dashboard storage list API: `object/list` returns folders as bare names (no items); recurse per prefix. Object `sign` + fetch works; HEAD on signed URLs returns 400 (use GET).

## Architecture couplings
- A user-selectable workout must stay aligned across `training.ts` (option pools and supplements), `weekPlan.ts` (override validation/application), `DayView.tsx` (selector), `App.tsx` (memo dependencies and callbacks), and a sport-scoped localStorage hook; changing only the UI does not change the generated plan.

## Git workflow (user requirement)
- The project lives at `https://github.com/valiport/fitplan.git`; the canonical branch is `main`. **After finishing every task, commit the changes and push them to `origin/main`** — the user explicitly asked that changes are always mirrored to GitHub.
- No `user.name`/`user.email` is configured locally. Commit with inline identity matching the repo history: `git -c user.name=Codebuff -c user.email=noreply@codebuff.com commit …` (do not alter git config).
- `gh` is authenticated as `valiport` (HTTPS); pushes work without extra setup. A stale `fitplan-mvp` branch exists on the remote (snapshot of the MVP commit) — leave it alone unless asked.
