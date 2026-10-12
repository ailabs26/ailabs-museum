import { http } from '@/core/api/http-client';

export interface OverviewStats {
  rooms: { total: number; active: number; archived: number };
  exhibits: { total: number; visible: number; hidden: number };
  revisions: { inReview: number; draft: number };
  reports: { open: number; inProgress: number };
  system: {
    api: 'up';
    db: 'up' | 'down';
    uptimeSec: number;
    serverTime: string;
  };
}

export interface LabeledCount {
  label: string;
  count: number;
}

export interface ActivityPoint {
  date: string;
  revisions: number;
  reports: number;
}

export interface StatsCharts {
  reportsByStatus: LabeledCount[];
  exhibitsByRoom: LabeledCount[];
  revisionsByState: LabeledCount[];
  activityLast14Days: ActivityPoint[];
}

export const statsService = {
  overview(): Promise<OverviewStats> {
    return http.get<OverviewStats>('/admin/stats/overview');
  },
  charts(): Promise<StatsCharts> {
    return http.get<StatsCharts>('/admin/stats/charts');
  },
};
