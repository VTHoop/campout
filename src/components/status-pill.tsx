import { cn } from '@/lib/utils';

/** Fill, glyph and word, never colour alone (DESIGN.md → State signals). */
export function StatusPill({ isDraft, label }: { isDraft: boolean; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-caption font-semibold text-ink',
        isDraft ? 'border-marigold bg-marigold-wash' : 'border-category-outdoors bg-surface',
      )}
    >
      <span aria-hidden="true">{isDraft ? '–' : '✓'}</span>
      {label ?? (isDraft ? 'Draft' : 'Verified')}
    </span>
  );
}
