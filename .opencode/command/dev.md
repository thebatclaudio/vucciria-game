---
type: command
trigger: "/dev"
---

# /dev

## Purpose

Start the Vite dev server with helpful URLs printed.

## Usage

```
/dev
```

## Behavior

Runs `pnpm dev` in the repo root, then prints:
- The local URL (http://localhost:5173)
- The LAN URL (so you can test on your phone)
- A reminder that opening two browser windows lets you test multiplayer locally

## Example

**Input:** `/dev`

**Output:**
```
▶ pnpm dev started.
Local:   http://localhost:5173
Network: http://192.168.x.x:5173

Tip: open this URL on your phone (same Wi-Fi) to test the PWA
install flow and touch interactions.
```

## See also

- `/test`, `/e2e`, `/ship`
