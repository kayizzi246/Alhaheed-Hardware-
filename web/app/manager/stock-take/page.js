import { redirect } from 'next/navigation';

/** Counting moved under Stock. Old links land in the right place. */
export default function OldCount() {
  redirect('/manager/stock/count');
}
