import type { CSSProperties, ReactNode } from 'react';
import { Group, Paper, Text, ThemeIcon } from '@mantine/core';
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import { Sparkline } from '@/shared/components/charts/Sparkline';
import classes from './StatCard.module.css';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  color?: string;
  /** % tăng trưởng so với kỳ trước (dương: xanh ngọc, âm: đỏ). */
  delta?: number;
  /** Dữ liệu sparkline mini. */
  spark?: number[];
  /** Màu nhấn dải trái + sparkline (mã màu). */
  accent?: string;
}

/** Thẻ số liệu Bento cho Dashboard: icon, giá trị, % tăng trưởng và sparkline. */
export function StatCard({ label, value, subtitle, icon, color = 'blue', delta, spark, accent }: StatCardProps) {
  const up = (delta ?? 0) >= 0;
  return (
    <Paper withBorder radius="md" p="md" className={classes.card} style={accent ? { '--stat-accent': accent } as CSSProperties : undefined}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{label}</Text>
          <Group gap={8} align="baseline" mt={4} wrap="nowrap">
            <Text fw={700} fz={28} lh={1.1}>{value}</Text>
            {delta !== undefined && (
              <span className={up ? classes.deltaUp : classes.deltaDown}>
                {up ? <IconTrendingUp size={13} /> : <IconTrendingDown size={13} />}
                {up ? '+' : ''}{delta}%
              </span>
            )}
          </Group>
          {subtitle && <Text size="xs" c="dimmed" mt={6}>{subtitle}</Text>}
        </div>
        {icon && <ThemeIcon color={color} variant="light" size={44} radius="md">{icon}</ThemeIcon>}
      </Group>
      {spark && accent && <div className={classes.spark}><Sparkline data={spark} color={accent} /></div>}
    </Paper>
  );
}
