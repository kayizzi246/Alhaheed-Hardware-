import Shell from '@/components/Shell';
import { WEB_ROLES } from '@/lib/roles';

/** Queue alerts for every desk on the web panel. */
export default function NotificationsLayout({ children }) {
  return <Shell allow={WEB_ROLES}>{children}</Shell>;
}
