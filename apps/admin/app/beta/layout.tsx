import { AdminShell } from '../../components/AdminShell';
import { AdminAuthProvider } from '../../providers/AdminAuthProvider';

export default function BetaSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
