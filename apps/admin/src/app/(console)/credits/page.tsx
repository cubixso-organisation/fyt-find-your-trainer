import { requireViewer } from "@/lib/auth";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { solarIcon } from "@/components/icons/solar";
import { UiIcon } from "@/components/icons/ui-icon";
import { BrandIcon } from "@/components/icons/brand-icon";

export const metadata = { title: "Credits & licences" };

/**
 * Every third-party asset the console ships, with its licence and a link back.
 * Open to any signed-in operator: it has no entry in ROUTE_PERMISSIONS, so
 * permissionForPath("/credits") is null. Keep NOTICE.md at the repo root in
 * step with this list.
 */

interface Credit {
  name: string;
  by: string;
  use: React.ReactNode;
  licence: string;
  licenceHref: string;
  source: string;
  sourceHref: string;
  note?: React.ReactNode;
  sample?: React.ReactNode;
}

const link = "font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
      {children}
    </a>
  );
}

const SolarSample = solarIcon("calendar-mark-bold-duotone");

const ICONS: Credit[] = [
  {
    name: "Solar, bold duotone",
    by: "480 Design",
    use: "Navigation, page and section icons, KPI labels, drawer headers, the command palette and empty states.",
    licence: "CC BY 4.0",
    licenceHref: "https://creativecommons.org/licenses/by/4.0/",
    source: "Solar Icons Set on Figma Community",
    sourceHref: "https://www.figma.com/community/file/1166831539721848736",
    note: "Packaged by Iconify (@iconify-json/solar). Only the icons in use are inlined; the second tone is drawn at reduced opacity in the text colour.",
    sample: <SolarSample className="size-5" />,
  },
  {
    name: "Icons8 interface marks",
    by: "Icons8",
    use: "Search fields, export buttons, the audit-log link, the approved seal and this page's menu entry.",
    licence: "Icons8 free licence, link required",
    licenceHref: "https://icons8.com/license",
    source: "Icons by Icons8",
    sourceHref: "https://icons8.com",
    note: "Modified: traced from the supplied images to single vector paths and recoloured to the console's text colours.",
    sample: <UiIcon name="search" className="size-5" />,
  },
  {
    name: "Lucide",
    by: "Lucide contributors; parts derived from Feather by Cole Bennett",
    use: "Small controls: chevrons, close, arrows, the eye toggle, and the icon inside each status pill.",
    licence: "ISC (Feather-derived icons: MIT)",
    licenceHref: "https://github.com/lucide-icons/lucide/blob/main/LICENSE",
    source: "lucide.dev",
    sourceHref: "https://lucide.dev",
  },
  {
    name: "Google Meet mark",
    by: "Glyph data from Simple Icons; Google Meet is a trademark of Google LLC",
    use: "Marks online sessions and Meet links in bookings, the booking drawer and the Today list.",
    licence: "CC0 1.0 (glyph data)",
    licenceHref: "https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md",
    source: "simpleicons.org",
    sourceHref: "https://simpleicons.org",
    note: "Drawn in one colour and used only to identify links that open in Google Meet. FYT is not affiliated with or endorsed by Google.",
    sample: <BrandIcon name="google-meet" className="size-5" />,
  },
];

const FONTS: Credit[] = [
  {
    name: "Satoshi",
    by: "Deni Anggara, Indian Type Foundry",
    use: "Body and interface text. Self-hosted as one variable file, weights 300 to 900.",
    licence: "ITF Free Font License",
    licenceHref: "https://www.fontshare.com/licenses/itf-ffl",
    source: "Fontshare",
    sourceHref: "https://www.fontshare.com/fonts/satoshi",
    note: "Licence text ships with the font at src/app/fonts/LICENSE-Satoshi.txt.",
  },
  {
    name: "Outfit",
    by: "The Outfit Project Authors",
    use: "Headings and panel titles.",
    licence: "SIL Open Font License 1.1",
    licenceHref: "https://openfontlicense.org",
    source: "Google Fonts",
    sourceHref: "https://fonts.google.com/specimen/Outfit",
  },
  {
    name: "Geist Mono",
    by: "Vercel, with Basement Studio",
    use: "Figures, references, phone numbers and keyboard hints.",
    licence: "SIL Open Font License 1.1",
    licenceHref: "https://openfontlicense.org",
    source: "Google Fonts",
    sourceHref: "https://fonts.google.com/specimen/Geist+Mono",
  },
];

const PATTERNS: Credit[] = [
  {
    name: "Event Manager",
    by: "vaib215",
    use: "Layout reference for the Day, Week and Month booking calendar.",
    licence: "Reference only, no source code included",
    licenceHref: "https://21st.dev/@vaib215/components/event-manager",
    source: "21st.dev",
    sourceHref: "https://21st.dev/@vaib215/components/event-manager",
  },
  {
    name: "Segmented Control",
    by: "ddoemonn",
    use: "Structure reference for the segmented view switch.",
    licence: "Reference only, no source code included",
    licenceHref: "https://21st.dev/@ddoemonn/components/segmented-control",
    source: "21st.dev",
    sourceHref: "https://21st.dev/@ddoemonn/components/segmented-control",
  },
  {
    name: "Auth Page",
    by: "efferd",
    use: "Layout reference for the split sign-in screen and its background paths.",
    licence: "Reference, see the file headers",
    licenceHref: "https://21st.dev/@efferd/components/auth-page",
    source: "21st.dev",
    sourceHref: "https://21st.dev/@efferd/components/auth-page",
  },
  {
    name: "OTPVerification and GlassCalendar",
    by: "21st.dev community",
    use: "Interaction references for the sign-in code field and the sign-in timetable.",
    licence: "Reference, see the file headers",
    licenceHref: "https://21st.dev",
    source: "21st.dev",
    sourceHref: "https://21st.dev",
  },
];

function CreditList({ items }: { items: Credit[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((c) => (
        <li key={c.name} className="grid grid-cols-1 gap-x-8 gap-y-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              {c.sample ? <span className="shrink-0 text-ink-2">{c.sample}</span> : null}
              <span className="min-w-0">{c.name}</span>
            </p>
            <p className="mt-0.5 text-[12.5px] text-ink-3">{c.by}</p>
            <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-ink-2">{c.use}</p>
            {c.note ? <p className="mt-1 max-w-[62ch] text-[12.5px] leading-relaxed text-ink-3">{c.note}</p> : null}
          </div>
          <dl className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] content-start gap-x-3 gap-y-1.5 text-[13px]">
            <dt className="text-ink-3">Licence</dt>
            <dd className="min-w-0 break-words">
              <Ext href={c.licenceHref}>{c.licence}</Ext>
            </dd>
            <dt className="text-ink-3">Source</dt>
            <dd className="min-w-0 break-words">
              <Ext href={c.sourceHref}>{c.source}</Ext>
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export default async function CreditsPage() {
  await requireViewer();
  return (
    <>
      <PageHeader
        title="Credits & licences"
        description="The icons, typefaces and design references this console is built with, and the terms each one is used under."
      />

      <div className="flex flex-col gap-6">
        <Panel>
          <PanelHeader
            icon={solarIcon("gallery-wide-bold-duotone")}
            title="Icons"
            description={
              <>
                Interface marks are <Ext href="https://icons8.com">Icons by Icons8</Ext>. Feature icons are Solar by 480 Design.
              </>
            }
          />
          <CreditList items={ICONS} />
        </Panel>

        <Panel>
          <PanelHeader icon={solarIcon("text-bold-duotone")} title="Typefaces" description="Loaded through the console's font tokens." />
          <CreditList items={FONTS} />
        </Panel>

        <Panel>
          <PanelHeader
            icon={solarIcon("code-square-bold-duotone")}
            title="Design references"
            description="Community components on 21st.dev that informed a layout. Each was rebuilt in the console's own tokens."
          />
          <CreditList items={PATTERNS} />
        </Panel>

        <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-3">
          <UiIcon name="certificate" className="mt-0.5 size-4 shrink-0" />
          <span className="max-w-[80ch]">
            Product names and logos belong to their owners. The same list is kept in NOTICE.md at the root of the repository.
          </span>
        </p>
      </div>
    </>
  );
}
