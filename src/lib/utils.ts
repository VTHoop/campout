import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * shadcn/ui's class joiner, taught Campout's type scale.
 *
 * tailwind-merge only knows Tailwind's own `text-sm`-style sizes. Left alone it
 * reads `text-ui` as a colour and drops it beside `text-ink`, so every button
 * would lose its type role. The list mirrors the `--text-*` tokens in
 * `globals.css`; add a role there, add it here.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'heading', 'title', 'body', 'ui', 'caption'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
