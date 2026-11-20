import Shell from '@/components/Shell';

export default function AccountsLayout({ children }) {
  return <Shell allow={['accounts', 'manager']}>{children}</Shell>;
}
