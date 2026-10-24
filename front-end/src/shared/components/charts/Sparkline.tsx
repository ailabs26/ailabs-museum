import { lazy, Suspense } from 'react';
import type { ApexOptions } from 'apexcharts';

const ReactApexChart = lazy(() => import('react-apexcharts'));

/** Biểu đồ sparkline tí hon cho thẻ số liệu (không trục, không lưới). */
export function Sparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  if (!data.length || data.every((v) => v === 0)) return null;
  const options: ApexOptions = {
    chart: { type: 'area', sparkline: { enabled: true }, animations: { enabled: false } },
    stroke: { width: 2, curve: 'smooth', lineCap: 'round' },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0, shadeIntensity: 1 } },
    colors: [color],
    tooltip: { enabled: false },
  };
  return (
    <Suspense fallback={<div style={{ height }} />}>
      <ReactApexChart type="area" height={height} series={[{ data }]} options={options} />
    </Suspense>
  );
}
