import * as React from "react";
import { SOLAR, type SolarName } from "./solar-data";

/**
 * Solar "bold duotone" icons (Iconify, CC BY 4.0), rendered inline from a
 * generated subset. The secondary layer is drawn at reduced opacity with
 * currentColor, so icons follow the surrounding text color in both themes.
 */
export function Solar({ name, className, title, ...rest }: { name: SolarName; className?: string; title?: string } & Omit<React.SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: SOLAR[name] }}
      {...rest}
    />
  );
}

/** Adapter so Solar icons can go anywhere a lucide-style `icon` component is expected. */
type IconComponent = React.FC<{ className?: string; strokeWidth?: number }>;
const cache = new Map<SolarName, IconComponent>();

/** Stable per name, so calling it inline in JSX never remounts the icon. */
export function solarIcon(name: SolarName): IconComponent {
  let Icon = cache.get(name);
  if (!Icon) {
    Icon = function SolarIcon({ className }) {
      return <Solar name={name} className={className} />;
    };
    Icon.displayName = `Solar(${name})`;
    cache.set(name, Icon);
  }
  return Icon;
}

export type { SolarName };
