export type DashboardWeek = {
  range: string;
  scheduledProduction: number;
  approvedSales?: number;
};

export type DashboardPayload = {
  organization: {
    id: string;
    name: string;
  };
  crmConnection: {
    provider: string;
    status: string;
    lastSyncAt: string | null;
    lastError: string | null;
  };
  weeks: {
    lastWeek: DashboardWeek;
    currentWeek: DashboardWeek;
    nextWeek: DashboardWeek;
    weekPlus2: DashboardWeek;
    weekPlus3: DashboardWeek;
  };
  overridesApplied: Partial<Record<keyof DashboardPayload['weeks'], {
    scheduledProduction?: boolean;
    approvedSales?: boolean;
  }>>;
};
