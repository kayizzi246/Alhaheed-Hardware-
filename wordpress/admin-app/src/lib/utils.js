import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn's `cn`: merge class lists, last Tailwind class wins. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
