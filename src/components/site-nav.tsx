'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The app's top navigation, drawn from the design prototype (CAM-29).
 *
 * One DOM for both layouts, so there is one landmark and one set of links for
 * assistive tech. Below `lg` the tabs stack under the wordmark as two
 * full-width buttons; from `lg` up they sit inline after it, underlined when
 * current. `lg` rather than `md` for now, so tablets get the phone layout.
 *
 * A client component only because it reads the current path to mark the
 * active tab.
 */
const TABS = [
  { href: '/summer', label: 'Summer' },
  { href: '/days-off', label: 'Days off' },
] as const;

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper';

const TAB_BASE = `flex min-h-touch items-center justify-center rounded-control border text-title lg:min-h-16 lg:rounded-none lg:border-0 lg:border-b-2 lg:px-1 lg:text-ui lg:font-semibold ${FOCUS_RING}`;

const TAB_CURRENT = 'border-paper bg-paper text-ink lg:bg-transparent lg:text-paper';

const TAB_OTHER = 'border-ink-muted text-rule hover:text-paper lg:border-transparent';

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="bg-ink text-paper">
      <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:gap-8 lg:px-6 lg:py-0">
        <Link
          href="/summer"
          aria-label="Campout home"
          className={`self-start rounded-control lg:self-center font-display text-heading ${FOCUS_RING}`}
        >
          Campout
        </Link>
        <ul className="grid grid-cols-2 gap-2 lg:flex lg:gap-6">
          {TABS.map(({ href, label }) => {
            const isCurrent = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`${TAB_BASE} ${isCurrent ? TAB_CURRENT : TAB_OTHER}`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
