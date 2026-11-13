import type { ApexOptions } from 'apexcharts';

/**
 * Tuỳ chọn ApexCharts nền dùng chung để mọi biểu đồ Dashboard đồng nhất:
 * font Inter, locale vi-VN, lưới/trục mờ (recessive), tooltip theo theme,
 * tắt toolbar rườm rà. Từng biểu đồ merge thêm phần riêng của nó.
 */
export function baseChartOptions(scheme: 'light' | 'dark'): ApexOptions {
  const ink = scheme === 'dark' ? '#c3c2b7' : '#52514e';
  const grid = scheme === 'dark' ? '#2e2e2c' : '#ececec';

  return {
    chart: {
      fontFamily: 'Inter, -apple-system, "Segoe UI", Roboto, sans-serif',
      foreColor: ink,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { speed: 400 },
      background: 'transparent',
    },
    theme: { mode: scheme },
    grid: {
      borderColor: grid,
      strokeDashArray: 4,
      padding: { left: 8, right: 8 },
    },
    dataLabels: { enabled: false },
    tooltip: { theme: scheme, shared: false },
    legend: {
      position: 'bottom',
      fontSize: '13px',
      markers: { strokeWidth: 0 },
      itemMargin: { horizontal: 10, vertical: 4 },
    },
    stroke: { width: 2, lineCap: 'round' },
    noData: {
      text: 'Chưa có dữ liệu',
      style: { color: ink, fontSize: '14px' },
    },
  };
}
