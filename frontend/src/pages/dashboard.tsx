import { mockDashboardPayload } from '../lib/mock-dashboard';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export default function DashboardPage() {
  const payload = mockDashboardPayload;

  return (
    <main>
      <h1>{payload.organization.name} · ProfitStack Dashboard</h1>
      <p>
        CRM: {payload.crmConnection.provider} · Status: {payload.crmConnection.status} · Last sync: {payload.crmConnection.lastSyncAt}
      </p>

      <section>
        <h2>Current Week</h2>
        <p>{payload.weeks.currentWeek.range}</p>
        <ul>
          <li>Scheduled Production: {money.format(payload.weeks.currentWeek.scheduledProduction)}</li>
          <li>Approved Sales: {money.format(payload.weeks.currentWeek.approvedSales)}</li>
        </ul>
      </section>

      <section>
        <h2>Last Week</h2>
        <p>{payload.weeks.lastWeek.range}</p>
        <ul>
          <li>Scheduled Production: {money.format(payload.weeks.lastWeek.scheduledProduction)}</li>
          <li>Approved Sales: {money.format(payload.weeks.lastWeek.approvedSales)}</li>
        </ul>
      </section>

      <section>
        <h2>Next 3 Weeks</h2>
        <ul>
          <li>{payload.weeks.nextWeek.range}: {money.format(payload.weeks.nextWeek.scheduledProduction)}</li>
          <li>{payload.weeks.weekPlus2.range}: {money.format(payload.weeks.weekPlus2.scheduledProduction)}</li>
          <li>{payload.weeks.weekPlus3.range}: {money.format(payload.weeks.weekPlus3.scheduledProduction)}</li>
        </ul>
      </section>

      <section>
        <h2>Overrides Applied</h2>
        <pre>{JSON.stringify(payload.overridesApplied, null, 2)}</pre>
      </section>
    </main>
  );
}
