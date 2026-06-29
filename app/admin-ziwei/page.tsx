import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/server/admin-auth';
import AdminDashboard from './AdminDashboard';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '紫微运营后台',
};

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin-ziwei/login');
  return <AdminDashboard />;
}
