# Design & Accessibility

Last verified against the codebase: 2026-07-07.

## Design tokens

There is no separate `design-system.ts` file — tokens are CSS variables defined directly
in `src/app/globals.css` (`--color-primary-*`, `--color-neutral-*`, `--color-black-*`,
etc.), consumed through Tailwind's `var(--color-...)` utility syntax.

- Font: Rubik (Hebrew + Latin), loaded via `next/font/google`.
- Animation: Framer Motion, ~300ms default duration.
- Spacing/radius: standard Tailwind scale (4px base), 12px card radius, 8px button radius.

## RTL (Hebrew)

- `<html lang="he" dir="rtl">` set once at the root layout — no need to repeat `dir="rtl"`
  per component.
- Icons that imply direction (arrows, chevrons) are mirrored where relevant; icons with no
  inherent direction (checkmarks, hearts) are left as-is.

## Mobile / PWA specifics

- Touch targets: minimum 44x44px on interactive elements.
- iOS photo picker: uses a `<label>` wrapping a hidden file input styled with
  `opacity: 0` rather than `display: none` — iOS Safari does not reliably trigger file
  pickers from `display: none` inputs.
- Web Share Target API is registered in the PWA manifest.
- iOS HEIC photos are converted to JPEG client-side before being base64-encoded for the
  Claude API (see `src/lib/image-compression.ts`).

## Accessibility — not yet formally audited

No WCAG contrast/screen-reader audit has been run against this app. If accessibility
compliance becomes a requirement (e.g. IS 5568), treat this as a real gap to address
directly rather than assuming it inherited from any earlier "AAA target" plan — no such
audit currently exists.

## Design rules (from user feedback, kept consistent across the app)

- No emoji in UI titles.
- No podium/leaderboard visual gimmicks.
- Dark backgrounds only — no light-mode variant.
- Animate with Framer Motion, not raw CSS transitions, on interactive elements.
