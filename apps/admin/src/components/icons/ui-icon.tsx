import * as React from "react";
import { UI_ICONS, type UiIconName } from "./ui-icon-data";

/**
 * Interface marks from the Icons8 iOS set, ported from the NutriGreenz icon
 * system. These are chrome: the magnifier in a search field, the arrow on an
 * export button, the seal on an approved state. Solar two-tone carries
 * navigation and feature icons; lucide stays for the smallest controls.
 *
 * Each mark is one traced path, inlined and filled with currentColor, so it
 * follows the surrounding text colour in light and dark without a request.
 *
 * Icons by Icons8 (https://icons8.com). Credited on /credits and in NOTICE.md.
 */
export function UiIcon({
  name,
  className,
  title,
  ...rest
}: { name: UiIconName; className?: string; title?: string } & Omit<React.SVGProps<SVGSVGElement>, "name">) {
  const icon = UI_ICONS[name];
  return (
    <svg
      viewBox={icon.viewBox}
      width="1em"
      height="1em"
      fill="currentColor"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...rest}
    >
      <path fillRule="evenodd" d={icon.d} />
    </svg>
  );
}

/** Adapter so a mark can go anywhere a lucide-style `icon` component is expected. */
type IconComponent = React.FC<{ className?: string; strokeWidth?: number }>;
const cache = new Map<UiIconName, IconComponent>();

/** Stable per name, so calling it inline in JSX never remounts the icon. */
export function uiIcon(name: UiIconName): IconComponent {
  let Icon = cache.get(name);
  if (!Icon) {
    Icon = function UiIconAdapter({ className }) {
      return <UiIcon name={name} className={className} />;
    };
    Icon.displayName = `UiIcon(${name})`;
    cache.set(name, Icon);
  }
  return Icon;
}

export const UI_ICON_NAMES: ReadonlySet<string> = new Set(Object.keys(UI_ICONS));
export type { UiIconName };
