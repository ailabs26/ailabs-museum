import { IconBuildingArch, IconArtboard, IconFlag, IconChecklist } from '@tabler/icons-react';
import { SimpleGrid, Skeleton } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { StatCard } from '@/shared/components/data';
import { useAuth } from '@/core/auth/use-auth';
import { statsService } from '@/services/stats.service';

/** Dashboard tổng quan Admin CMS: số liệu thật + trạng thái hệ thống + biểu đồ. */
export function DashboardPage() {
  const { user } = useAuth();

  const overview = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => statsService.overview(),
  });

  const o = overview.data;
  const loading = overview.isLoading;

  return (
    <>
      <PageHeader title="Dashboard" description={`Xin chào, ${user?.displayName ?? 'Admin'}`} />

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={92} radius="md" />)
        ) : (
          <>
            <StatCard
              label="Phòng trưng bày"
              value={o?.rooms.total ?? 0}
              icon={<IconBuildingArch size={24} />}
              color="aura"
            />
            <StatCard
              label="Hiện vật"
              value={o?.exhibits.total ?? 0}
              icon={<IconArtboard size={24} />}
              color="teal"
            />
            <StatCard
              label="Chờ duyệt"
              value={o?.revisions.inReview ?? 0}
              icon={<IconChecklist size={24} />}
              color="yellow"
            />
            <StatCard
              label="Báo cáo mở"
              value={o?.reports.open ?? 0}
              icon={<IconFlag size={24} />}
              color="red"
            />
          </>
        )}
      </SimpleGrid>
    </>
  );
}
