import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui Input (new-york), restyled onto Campout's tokens: a 1px rule, no
 * shadow, a `min-h-touch` target, and an `aria-invalid` border in brick.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'min-h-touch w-full rounded-control border border-rule bg-surface px-3 text-body text-ink outline-none placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40 aria-invalid:border-brick',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
