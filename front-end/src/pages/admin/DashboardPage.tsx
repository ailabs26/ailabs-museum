import { IconBuildingArch, IconArtboard, IconFlag, IconChecklist } from '@tabler/icons-react';
import { SimpleGrid } from '@mantine/core';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { StatCard } from '@/shared/components/data';
import { useAuth } from '@/core/auth/use-auth';

/**
 * Dashboard tổng quan (khung). Số liệu thật sẽ nối API thống kê ở PR #F/#D.
 */
export function DashboardPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Dashboard" description={`Xin chào, ${user?.displayName ?? 'Admin'}`} />
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        <StatCard label="Phòng trưng bày" value="—" icon={<IconBuildingArch size={24} />} color="aura" />
        <StatCard label="Hiện vật" value="—" icon={<IconArtboard size={24} />} color="teal" />
        <StatCard label="Chờ duyệt" value="—" icon={<IconChecklist size={24} />} color="yellow" />
        <StatCard label="Báo cáo mở" value="—" icon={<IconFlag size={24} />} color="red" />
      </SimpleGrid>
    </>
  );
}
