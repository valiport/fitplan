# AGENTS.md

Non-obvious learnings for future sessions in this repo. Terse by design.

## Session process
- An approved plan does NOT mean the work exists: in one session, the post-approval implementation turn silently produced zero file changes. Always verify worktree state (`ls`, build artifacts) before building on prior turns.
- Don't trust click success in the live preview: verify each click's effect with a fresh snapshot; uids go stale after any re-render and one click landed on the wrong tab because layout shifted.

## Environment (Windows host, German locale)
- `run_terminal_command` has no `process_type: BACKGROUND`. Run dev servers detached: `nohup npm run dev > vite-dev.log 2>&1 &`, then `sleep` + `curl` to verify.
- A dev server from an earlier session may still hold port 5173 (nohup'd, log in `vite-dev.log`). Probe `curl http://localhost:5173/` before starting another one.
- Vite binds IPv6-only (`[::1]:5173`) and netstat prints German state names (`ABHÖREN`): find the PID with plain `netstat -ano | grep 5173`, not by grepping `LISTENING`.
- `register_preview` wants the PID of the node process that owns the port (from netstat), not the npm/nohup wrapper PID.
- Project root path contains spaces and umlauts (`Downloads\Online-Apps zum Geldverdienen entwickeln - Claude_files`) — always quote absolute paths in shell commands.

## Testing the live preview
- `preview_navigate` with `to: "reload"` usually reports "no load event observed within 15s" even on success — misleading; just snapshot afterwards.
- Setting `el.value` + dispatching `input` does not update React controlled inputs (silently fails validation). Use the native setter: `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)` then dispatch the event.
- Do not assert on `document.body.innerText` for styled text: Tailwind `uppercase` changes rendered text (`GRUNDUMSATZ`), so `includes('Grundumsatz')` is false. Match case-insensitively or use snapshots/aria.

## Architecture couplings & constraints
- Pro entitlement is checked in exactly one place: `src/hooks/usePro.ts`. Future payment integration (RevenueCat/Stripe) must hook there. The upgrade button is a local demo; real payments need a backend/webhooks — deliberately out of scope (user decision).
- Hidden coupling: `ShoppingList`'s "only checked days" filter matches the exact check-id format `d${dayIndex}-workout-0` produced in `DayView`. Change one and the other silently breaks.
- Reroll was once a no-op because `rerolls` did not reach the deterministic builder; it is now fixed by passing a seed through `buildWeekPlan` into recipe/workout selection. Preserve that data flow when changing plan generation.
- `useWeekChecks` keys storage by week-start ISO date so checks reset every Monday — by design, don't "fix" it.
- Files in `reference/claude-assets/` are browser-saved claude.ai assets (third-party, proprietary). Never import or bundle them; visual reference only.

## User preferences
- Feature specs arrive in German; all UI copy is German with de-DE formatting (`1.670 kcal`). Match the language of the user's current message.
- Product scope agreed: full planner + free/pro split now; accounts/payments deferred until a backend exists.

## Tooling quirks
- `write_file` rejects calls missing the `instructions` field; the validation error only shows truncated content, which is easy to misread as a size problem.
- `write_doc` is unavailable in this environment despite being listed as a tool; use `write_file` for new files. Shell redirection can also be refused while the client reports plan mode, even when `exit_plan` reports the opposite.

## Architecture couplings
- A user-selectable workout must stay aligned across `training.ts` (option pools and supplements), `weekPlan.ts` (override validation/application), `DayView.tsx` (selector), `App.tsx` (memo dependencies and callbacks), and a sport-scoped localStorage hook; changing only the UI does not change the generated plan.
