# Design System: Operator Console

## Scene
An operations admin at an Ameerpet training institute's front desk, mid-afternoon under bright tube lights, working a booking queue on a 15-inch laptop between phone calls. The owner reviews the same numbers on that laptop in the evening. That scene sets **light as the default**, with a warm dark theme for evening use.

## Color strategy: Restrained
Tinted warm neutrals (paper and ink) plus one accent, **Marigold**, kept to 10% of the surface or less. Primary buttons use ink, not the accent. Marigold marks the current selection, the focus ring, the active nav item, the primary chart series and the one thing on screen that needs attention. No purple anywhere.

| Token | Light (OKLCH) | Dark (OKLCH) | Use |
|---|---|---|---|
| `--paper` | 0.985 0.006 85 | 0.18 0.008 70 | page background |
| `--surface` | 0.995 0.004 85 | 0.215 0.009 70 | panels, tables |
| `--sunken` | 0.96 0.008 85 | 0.155 0.007 70 | sidebar, inputs, table header |
| `--line` | 0.9 0.01 85 | 0.3 0.01 70 | hairlines |
| `--ink` | 0.22 0.015 70 | 0.94 0.01 85 | text, primary buttons |
| `--ink-2` | 0.45 0.015 70 | 0.72 0.012 85 | secondary text (≥4.5:1) |
| `--ink-3` | 0.58 0.012 70 | 0.58 0.012 85 | tertiary, placeholders |
| `--accent` | 0.78 0.155 70 | 0.8 0.15 72 | marigold |
| `--accent-ink` | 0.3 0.06 60 | 0.25 0.05 60 | text on marigold |
| `--ok` | 0.58 0.12 155 | 0.72 0.13 155 | confirmed, healthy |
| `--warn` | 0.64 0.17 40 | 0.72 0.15 45 | needs attention |
| `--bad` | 0.56 0.19 25 | 0.68 0.17 25 | failed, destructive |
| `--info` | 0.55 0.1 240 | 0.72 0.09 240 | neutral info only |

A status is never shown by color alone. Every status pill pairs its color with an icon and a label.

## Typography
- **Geist Sans** for all UI and **Geist Mono** for numbers, IDs, times and codes (`tabular-nums`).
- Fixed rem scale, ratio of about 1.2: 12 / 13 / 14 (body) / 16 / 20 / 24 / 30.
- Page titles are 24px/600 with `tracking-tight`. There are no display sizes in the console.

## Shape, depth, motion
- Radii: 6px for controls, 10px for panels, 14px for overlays. No pill-shaped panels.
- Depth comes from surface tone and a 1px line. The only shadow is on overlays (menus, drawer, command palette), tinted toward the ink hue.
- Motion runs 150–220ms with ease-out-quart and animates transform and opacity only. It is used for state changes only: the drawer slides in, rows animate on insert or remove, and the count-up runs on first paint. Everything respects `prefers-reduced-motion`.

## Layout
- A 248px sidebar on `--sunken`, collapsible to 64px, becoming a sheet below `lg`. The top bar shows breadcrumbs, the ⌘K command palette, theme and account.
- Content is capped at `max-w-[1400px]`. Overview is asymmetric (2fr / 1fr): the action queue on the left, and today's timeline and activity on the right.
- Tables are the primary data affordance, with a sticky header, row hover, a bulk-select bar and skeleton rows. Cards are used only for the KPI strip, and that strip is a single bordered band divided by hairlines rather than separate cards.
- Editing happens in a right-side drawer, not a centered modal. Destructive confirmations use a small anchored dialog.

## Components
Button (primary = ink, secondary = surface + line, ghost, danger, each with a loading state), Input/Select/Textarea (label above, helper, error below), StatusPill, RoleBadge, DataTable, Drawer, ConfirmDialog, CommandPalette, EmptyState (teaches the next action), Skeleton, Toast (sonner), PermissionLock (explains which role unlocks a module).
