import { IconBuildingArch, IconArtboard, IconFlag, IconChecklist } from '@tabler/icons-react';
import { Badge, Group, Paper, SimpleGrid, Skeleton, Text, useComputedColorScheme } from '@mantine/core';
import { IconServer } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { StatCard } from '@/shared/components/data';
import { ChartCard, categorical, reportStatusColor } from '@/shared/components/charts';
import { useAuth } from '@/core/auth/use-auth';
import { statsService } from '@/services/stats.service';

const REPORT_STATUS_VI: Record<string, string> = {
  open: 'Đang mở',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
  dismissed: 'Đã đóng',
};

const REVISION_STATE_VI: Record<string, string> = {
  draft: 'Nháp',
  in_review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

/** Định dạng uptime (giây) sang "Xd Yh Zm". */
function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

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
  const exhibitsByRoom = c?.exhibitsByRoom ?? [];
  const revisionsByState = c?.revisionsByState ?? [];
  const activity = c?.activityLast14Days ?? [];
  const ramp = categorical(scheme);

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

      <Paper withBorder radius="md" p="md" mt="lg">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <IconServer size={20} />
            <Text fw={600}>Trạng thái hệ thống</Text>
          </Group>
          <Group gap="lg" wrap="wrap">
            <Badge color="green" variant="light">
              API: {o?.system.api ?? '—'}
            </Badge>
            <Badge color={o?.system.db === 'down' ? 'red' : 'green'} variant="light">
              Database: {o?.system.db ?? '—'}
            </Badge>
            <Text size="sm" c="dimmed">
              Uptime: {o ? formatUptime(o.system.uptimeSec) : '—'}
            </Text>
            <Text size="sm" c="dimmed">
              Giờ máy chủ:{' '}
              {o ? new Date(o.system.serverTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}
            </Text>
          </Group>
        </Group>
      </Paper>

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

        <ChartCard
          title="Hiện vật theo phòng"
          description="Số hiện vật đang có ở mỗi phòng trưng bày"
          type="bar"
          loading={chartsLoading}
          empty={exhibitsByRoom.length === 0}
          series={[{ name: 'Hiện vật', data: exhibitsByRoom.map((e) => e.count) }]}
          options={{
            colors: [ramp[0]],
            plotOptions: {
              bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: 'end', barHeight: '60%' },
            },
            dataLabels: { enabled: true },
            xaxis: { categories: exhibitsByRoom.map((e) => e.label) },
            legend: { show: false },
          }}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} mt="lg">
        <ChartCard
          title="Revision theo trạng thái"
          description="Phân bố phiên bản nội dung theo trạng thái duyệt"
          type="bar"
          loading={chartsLoading}
          empty={revisionsByState.length === 0}
          series={[{ name: 'Revision', data: revisionsByState.map((r) => r.count) }]}
          options={{
            colors: revisionsByState.map((_, i) => ramp[i % ramp.length]),
            plotOptions: {
              bar: { columnWidth: '50%', borderRadius: 4, borderRadiusApplication: 'end', distributed: true },
            },
            dataLabels: { enabled: true },
            xaxis: { categories: revisionsByState.map((r) => REVISION_STATE_VI[r.label] ?? r.label) },
            legend: { show: false },
          }}
        />

        <ChartCard
          title="Hoạt động 14 ngày"
          description="Revision tạo mới và báo cáo gửi về mỗi ngày"
          type="line"
          loading={chartsLoading}
          empty={activity.every((a) => a.revisions === 0 && a.reports === 0)}
          series={[
            { name: 'Revision', type: 'column', data: activity.map((a) => a.revisions) },
            { name: 'Báo cáo', type: 'line', data: activity.map((a) => a.reports) },
          ]}
          options={{
            colors: [ramp[0], ramp[1]],
            stroke: { width: [0, 3], curve: 'smooth', lineCap: 'round' },
            plotOptions: { bar: { columnWidth: '55%', borderRadius: 3, borderRadiusApplication: 'end' } },
            markers: { size: [0, 4] },
            xaxis: { categories: activity.map((a) => a.date.slice(5).replace('-', '/')) },
            yaxis: { labels: { formatter: (v: number) => `${Math.round(v)}` } },
            legend: { position: 'bottom' },
          }}
        />
      </SimpleGrid>
    </>
  );
}
