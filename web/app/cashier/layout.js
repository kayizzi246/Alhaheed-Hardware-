import Shell from '@/components/Shell';

export default function CashierLayout({ children }) {
  return <Shell allow={['cashier', 'manager']}>{children}</Shell>;
}
