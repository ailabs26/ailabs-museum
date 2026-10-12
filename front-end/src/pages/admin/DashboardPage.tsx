import { IconBuildingArch, IconArtboard, IconFlag, IconChecklist } from '@tabler/icons-react';
import { SimpleGrid, Skeleton, useComputedColorScheme } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { StatCard } from '@/shared/components/data';
import { ChartCard, reportStatusColor } from '@/shared/components/charts';
import { useAuth } from '@/core/auth/use-auth';
import { statsService } from '@/services/stats.service';

const REPORT_STATUS_VI: Record<string, string> = {
  open: 'Đang mở',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
  dismissed: 'Đã đóng',
};

/** Dashboard tổng quan Admin CMS: số liệu thật + trạng thái hệ thống + biểu đồ. */
export function DashboardPage() {
  const { user } = useAuth();
  const scheme = useComputedColorScheme('light');

  const overview = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => statsService.overview(),
  });
  const charts = useQuery({
    queryKey: ['stats', 'charts'],
    queryFn: () => statsService.charts(),
  });

  const o = overview.data;
  const c = charts.data;
  const loading = overview.isLoading;
  const chartsLoading = charts.isLoading;

  const reportsByStatus = c?.reportsByStatus ?? [];

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

      <SimpleGrid cols={{ base: 1, md: 2 }} mt="lg">
        <ChartCard
          title="Báo cáo theo trạng thái"
          description="Phân bố báo cáo vi phạm hiện tại"
          type="donut"
          loading={chartsLoading}
          empty={reportsByStatus.length === 0}
          series={reportsByStatus.map((r) => r.count)}
          options={{
            labels: reportsByStatus.map((r) => REPORT_STATUS_VI[r.label] ?? r.label),
            colors: reportsByStatus.map((r) => reportStatusColor(r.label, scheme)),
            legend: { position: 'bottom' },
            plotOptions: { pie: { donut: { size: '62%' } } },
            dataLabels: { enabled: true, formatter: (v: number) => `${Math.round(v)}%` },
          }}
        />
      </SimpleGrid>
    </>
  );
}
