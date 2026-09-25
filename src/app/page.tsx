import { redirect } from 'next/navigation';

/**
 * The root route has no page of its own yet. Home will claim it later, which is
 * why this is `redirect` (307) and not `permanentRedirect` (308): browsers cache
 * a permanent redirect and would keep skipping Home once it exists.
 */
export default function RootPage() {
  redirect('/summer');
}
