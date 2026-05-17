---
type: command
trigger: "/lhci"
---

# /lhci

## Purpose

Run Lighthouse against a local production build to score PWA installability,
performance, and accessibility.

## Usage

```
/lhci
```

## Behavior

1. `pnpm build`
2. `pnpm preview --port 4173`
3. `npx lighthouse http://localhost:4173 --view --preset=desktop`

Then summarize the PWA / Performance / Accessibility / Best Practices /
SEO scores and flag anything below 90.

If Lighthouse isn't installed, hint the user to `npm i -g lighthouse` or use
the Chrome DevTools "Lighthouse" panel as an alternative.

## See also

- `@pwa-shipper` — full pre-deploy checklist
- `/ship` — pre-flight
