export function toMetricNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildNutReportSalesRollups(dashboard) {
  const currentWeek = dashboard?.weeks?.currentWeek || {};
  const settings = dashboard?.settings || {};

  const salesToday = toMetricNumber(settings.salesToday, 0);
  const salesWeek = toMetricNumber(currentWeek.approvedSales, 0);
  const salesMonth = settings.salesMonth == null
    ? salesWeek
    : toMetricNumber(settings.salesMonth, salesWeek);

  return {
    salesToday,
    salesWeek,
    salesMonth,
    currentWeekApprovedDisplay: salesWeek,
    realizedSales3Weeks: toMetricNumber(currentWeek.realizedSales3Weeks, 0),
    capturedSales6Weeks: toMetricNumber(currentWeek.capturedSales6Weeks, 0),
  };
}
