---
type: command
trigger: "/ship"
---

# /ship

## Purpose

Pre-flight check before pushing to `main` (which triggers GitHub Pages deploy).

## Usage

```
/ship
```

## Behavior

Runs in order:

1. `pnpm typecheck` — TypeScript across `src/` and `tests/`.
2. `pnpm lint` — ESLint.
3. `/check-i18n` — EN/IT catalog symmetry.
4. `pnpm test:run` — unit tests.
5. `pnpm build` — production bundle, surfacing any build errors.
6. Brief sanity check that `dist/` was created and that `index.html`
   references the expected base path.

If any step fails, stop and report which step + the relevant output. Do
not push.

If everything passes, print a short recap and **suggest** the user run
`git push` — never push on their behalf.

## Example

**Input:** `/ship`

**Output:**
```
✅ typecheck
✅ lint
✅ i18n catalogs symmetric
✅ 12 unit tests passed
✅ build (dist/ 287 KB gzipped)

Ready to ship. Run `git push` to trigger the GH Pages deploy.
```

## See also

- `@pwa-shipper`
- `/lhci`
