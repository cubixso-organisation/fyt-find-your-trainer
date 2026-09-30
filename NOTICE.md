# Third-party notices

The FYT operator console (`apps/admin`) uses the third-party assets below.
The same list is shown in the console at `/credits` ("Credits & licences").
Keep the two in step.

## Icons

| Asset | Author | Licence | Source | Where it is used |
| --- | --- | --- | --- | --- |
| Solar, bold duotone | 480 Design | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [Solar Icons Set](https://www.figma.com/community/file/1166831539721848736), packaged by Iconify as `@iconify-json/solar` | Navigation, page and section icons, KPI labels, drawer headers, command palette, empty states |
| Icons8 interface marks | Icons8 | [Icons8 free licence](https://icons8.com/license), link required | [Icons by Icons8](https://icons8.com) | Search fields, export buttons, the audit-log link, the approved seal, the credits menu entry |
| Lucide | Lucide contributors; parts derived from Feather by Cole Bennett | [ISC](https://github.com/lucide-icons/lucide/blob/main/LICENSE) (Feather-derived icons: MIT) | [lucide.dev](https://lucide.dev) | Small controls and the icon inside each status pill |
| Google Meet mark | Glyph data from Simple Icons | [CC0 1.0](https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md) (glyph data) | [simpleicons.org](https://simpleicons.org) | Online sessions and Meet links |

Changes made:

- **Solar**: only the icons in use are inlined (`apps/admin/scripts/gen-icons.mjs`
  writes `src/components/icons/solar-data.ts`). The second tone is drawn at
  reduced opacity in the surrounding text colour.
- **Icons8**: the marks were traced from the supplied images to single vector
  paths and recoloured. Sources are in `apps/admin/scripts/ui-icons/`;
  `scripts/gen-ui-icons.mjs` writes `src/components/icons/ui-icon-data.ts`.
  Marks in use: `search`, `export`, `audit`, `verified`, `certificate`.
  Icons by Icons8: https://icons8.com
- **Google Meet mark**: drawn in one colour. Google Meet is a trademark of
  Google LLC. The mark is used only to identify links that open in Google
  Meet; FYT is not affiliated with or endorsed by Google.

## Typefaces

| Typeface | Author | Licence | Source | Where it is used |
| --- | --- | --- | --- | --- |
| Satoshi | Deni Anggara, Indian Type Foundry | [ITF Free Font License](https://www.fontshare.com/licenses/itf-ffl) | [Fontshare](https://www.fontshare.com/fonts/satoshi) | Body and interface text (self-hosted variable file) |
| Outfit | The Outfit Project Authors | [SIL Open Font License 1.1](https://openfontlicense.org) | [Google Fonts](https://fonts.google.com/specimen/Outfit) | Headings and panel titles |
| Geist Mono | Vercel, with Basement Studio | [SIL Open Font License 1.1](https://openfontlicense.org) | [Google Fonts](https://fonts.google.com/specimen/Geist+Mono) | Figures, references, keyboard hints |

The Satoshi licence text ships beside the font at
`apps/admin/src/app/fonts/LICENSE-Satoshi.txt`.

## Design references (21st.dev)

These community components informed a layout or an interaction. Each was
rebuilt in the console's own tokens; the file headers record what was and was
not taken from the source.

| Component | Author | Source | Used for | File |
| --- | --- | --- | --- | --- |
| Event Manager | vaib215 | https://21st.dev/@vaib215/components/event-manager | Day, Week and Month booking calendar layout. Reference only, no source code included | `src/app/(console)/bookings/booking-calendar.tsx` |
| Segmented Control | ddoemonn | https://21st.dev/@ddoemonn/components/segmented-control | Segmented view switch. Reference only, no source code included | `src/components/ui/choice.tsx` |
| Auth Page | efferd | https://21st.dev/@efferd/components/auth-page | Split sign-in screen and its background paths | `src/app/(auth)/login/` |
| OTPVerification | 21st.dev community | https://21st.dev | Sign-in code field | `src/components/ui/otp-input.tsx` |
| GlassCalendar | 21st.dev community | https://21st.dev | Sign-in timetable | `src/components/ui/timetable-calendar.tsx` |

## Software packages

Runtime dependencies and their licences are listed in
`apps/admin/package.json` and in each package under `node_modules`.
