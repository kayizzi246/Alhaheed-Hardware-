import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Join class names, letting a later one beat an earlier one.
 *
 * Plain `clsx` would leave "p-4 p-2" in the markup and let the
 * stylesheet's order decide, which is a coin toss. `twMerge` resolves
 * it the way a reader expects: the last one wins.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
