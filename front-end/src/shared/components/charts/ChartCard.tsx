import { lazy, Suspense } from 'react';
import type { ApexOptions } from 'apexcharts';
import { Paper, Skeleton, Stack, Text } from '@mantine/core';
import { useComputedColorScheme } from '@mantine/core';
import { baseChartOptions } from './chart-theme';
import { ErrorBoundary } from '@/shared/components/feedback/ErrorBoundary';

// Public routes import the dashboard module but never need its chart engine.
const ReactApexChart = lazy(() => import('react-apexcharts'));

export interface ChartCardProps {
  title: string;
  description?: string;
  type: NonNullable<ApexOptions['chart']>['type'];
  series: ApexOptions['series'] | number[];
  options?: ApexOptions;
  height?: number;
  loading?: boolean;
  /** Dữ liệu rỗng → hiện trạng thái trống thay vì vẽ biểu đồ trắng. */
  empty?: boolean;
}

/**
 * Khung thẻ biểu đồ dùng chung: tiêu đề + ApexCharts theo theme sáng/tối,
 * có skeleton khi loading và trạng thái trống. Mọi biểu đồ Dashboard dùng qua đây.
 */
export function ChartCard({
  title,
  description,
  type,
  series,
  options,
  height = 300,
  loading,
  empty,
}: ChartCardProps) {
  const scheme = useComputedColorScheme('light');
  const base = baseChartOptions(scheme);
  const merged: ApexOptions = {
    ...base,
    ...options,
    chart: { ...base.chart, ...options?.chart, type },
  };

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap={2} mb="sm">
        <Text fw={600}>{title}</Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>

      {loading ? (
        <Skeleton height={height} radius="md" />
      ) : empty ? (
        <Stack align="center" justify="center" h={height}>
          <Text c="dimmed" size="sm">
            Chưa có dữ liệu để hiển thị
          </Text>
        </Stack>
      ) : (
        <ErrorBoundary fallback={<Text role="alert">Không tải được biểu đồ. Hãy tải lại trang để thử lại.</Text>}>
        <Suspense fallback={<Skeleton height={height} radius="md" />}>
        <ReactApexChart
          key={scheme}
          type={type}
          series={series as ApexOptions['series']}
          options={merged}
          height={height}
        />
        </Suspense>
        </ErrorBoundary>
      )}
    </Paper>
  );
}
