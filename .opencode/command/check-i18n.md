---
type: command
trigger: "/check-i18n"
---

# /check-i18n

## Purpose

Validate that `en.json` and `it.json` have the same keys and the same
interpolation variables.

## Usage

```
/check-i18n
```

## Behavior

Runs the `i18n_diff` skill against `src/i18n/en.json` and `src/i18n/it.json`.
Reports:
- Keys present in EN but missing in IT.
- Keys present in IT but missing in EN.
- Keys where `{{var}}` placeholders don't match.

If anything is missing, automatically hands off to `@i18n-keeper` for
suggested translations.

## See also

- `@i18n-keeper`
- `/new-card`
