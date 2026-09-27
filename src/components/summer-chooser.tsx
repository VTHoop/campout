import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * The summer chooser (CAM-31): one link per summer on offer, earliest first.
 *
 * Links rather than toggle buttons, because the choice lives in the URL
 * (`/summer?summer=2026`): it survives a reload, travels in a shared link, and
 * works before any JavaScript has loaded. The chosen summer is styled like a
 * selected week tile, and it is styled from `aria-current`, so the fill cannot
 * drift from the state a screen reader hears.
 *
 * It never says whether a summer is estimated; the page says that elsewhere.
 */
const OPTION =
  'min-w-16 tabular-nums aria-[current=true]:border-ink aria-[current=true]:bg-ink aria-[current=true]:text-paper aria-[current=true]:hover:bg-ink';

export function SummerChooser({ years, selected }: { years: readonly number[]; selected: number }) {
  return (
    <nav aria-label="Choose a summer">
      <ul className="flex gap-2">
        {years.map((year) => (
          <li key={year}>
            <Button asChild variant="outline" className={OPTION}>
              <Link
                href={`/summer?summer=${String(year)}`}
                aria-label={`Summer ${String(year)}`}
                aria-current={year === selected ? 'true' : undefined}
              >
                {year}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
