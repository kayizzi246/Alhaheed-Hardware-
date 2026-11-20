import Shell from '@/components/Shell';

/** The manager's side of the web panel. */
export default function ManagerLayout({ children }) {
  return <Shell allow={['manager']}>{children}</Shell>;
}
