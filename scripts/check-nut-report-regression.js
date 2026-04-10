import { getSupabaseEnv } from '../backend/src/supabase-client.mjs';

const base = process.env.NUT_REPORT_BASE_URL || 'https://profitstack.onrender.com';
const email = process.env.NUT_REPORT_EMAIL || 'outsidethebusinessbox@gmail.com';
const password = process.env.NUT_REPORT_PASSWORD || '1234CM';
const orgId = process.env.NUT_REPORT_ORG_ID || '2cece8f2-b17c-49fc-a4a1-91c45b68cae8';
const timeZone = process.env.NUT_REPORT_TIMEZONE || 'America/Chicago';

function toCurrencyNumber(rawValue) {
  if (rawValue == null) return 0;
  return Number(rawValue) / 100;
}

function formatDateInTimeZone(dateValue, zone) {
  const date = new Date(dateValue);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function startOfWeek(dateValue, zone) {
  const date = new Date(dateValue);
  const local = new Date(`${formatDateInTimeZone(date, zone)}T00:00:00Z`);
  const day = local.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  local.setUTCDate(local.getUTCDate() + diff);
  return local.toISOString().slice(0, 10);
}

async function fetchFrontendConfig() {
  const res = await fetch(`${base}/api/frontend-config`);
  if (!res.ok) throw new Error(`frontend-config ${res.status}`);
  return res.json();
}

async function getDashboardHeaders() {
  const cfg = await fetchFrontendConfig();
  const loginRes = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.supabaseAnonKey,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) throw new Error(`login ${loginRes.status}`);
  const login = await loginRes.json();
  return {
    'X-User-Email': email,
    Authorization: `Bearer ${login.access_token}`,
  };
}

async function fetchDashboard() {
  const headers = await getDashboardHeaders();
  const res = await fetch(`${base}/api/dashboard`, { headers });
  if (!res.ok) throw new Error(`dashboard ${res.status}`);
  return res.json();
}

async function fetchHcpCookie() {
  const env = getSupabaseEnv();
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/crm_connections?select=*&organization_id=eq.${orgId}&limit=1`, { headers });
  if (!res.ok) throw new Error(`crm_connections ${res.status}`);
  const rows = await res.json();
  const cookie = rows?.[0]?.encrypted_credentials?.fields?.sessionCookie;
  if (!cookie) throw new Error('missing HCP session cookie');
  return cookie;
}

async function fetchHcp(url, cookie) {
  const res = await fetch(url, {
    headers: {
      Cookie: cookie,
      Accept: 'application/json, text/plain, */*',
      Referer: 'https://pro.housecallpro.com/app/reporting',
      Origin: 'https://pro.housecallpro.com',
      'User-Agent': 'ProfitStack/0.1',
    },
  });
  if (!res.ok) throw new Error(`HCP ${res.status} ${url}`);
  return res.json();
}

async function fetchJobDetailsThisWeek(cookie) {
  const jobs = [];
  for (let page = 1; page <= 8; page += 1) {
    const url = `https://pro.housecallpro.com/alpha/jobs/jobs_list?page=${page}&page_size=200`;
    const res = await fetchHcp(url, cookie);
    const items = res?.data?.data || [];
    if (!items.length) break;
    jobs.push(...items);
  }

  const details = [];
  for (const job of jobs.slice(0, 200)) {
    const detail = await fetchHcp(`https://pro.housecallpro.com/alpha/jobs/${job.id}`, cookie);
    details.push(detail);
  }
  return details;
}

function getMonthAllocatedAmount(monthKey, startValue, endValue, totalAmount) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !(totalAmount > 0) || end <= start) return 0;

  const [year, month] = monthKey.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const monthEndExclusive = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs));
  const overlapStart = Math.max(start.getTime(), monthStart.getTime());
  const overlapEnd = Math.min(end.getTime(), monthEndExclusive.getTime());
  if (overlapEnd <= overlapStart) return 0;
  const overlapDays = Math.max(1, Math.ceil((overlapEnd - overlapStart) / dayMs));
  return totalAmount * (overlapDays / totalDays);
}

function computeExpectedSales(jobDetails) {
  const now = new Date();
  const today = formatDateInTimeZone(now, timeZone);
  const currentWeekStart = startOfWeek(now, timeZone);
  const currentMonth = today.slice(0, 7);

  let salesToday = 0;
  let salesWeek = 0;
  let salesMonth = 0;
  let monthScheduledProduction = 0;

  for (const job of jobDetails) {
    const total = toCurrencyNumber(job.total_amount || 0);
    if (!total || !job.created_at) continue;
    const createdDate = formatDateInTimeZone(job.created_at, timeZone);
    if (createdDate === today) salesToday += total;
    if (startOfWeek(job.created_at, timeZone) === currentWeekStart) salesWeek += total;
    if (createdDate.slice(0, 7) === currentMonth) salesMonth += total;

    const allocatedMonthAmount = getMonthAllocatedAmount(currentMonth, job.schedule?.data?.start_time, job.schedule?.data?.end_time, total);
    if (allocatedMonthAmount > 0) {
      monthScheduledProduction += allocatedMonthAmount;
      continue;
    }
    const scheduledDate = formatDateInTimeZone(job.scheduled_date || job.schedule?.data?.start_time, timeZone);
    if (scheduledDate.slice(0, 7) === currentMonth) {
      monthScheduledProduction += total;
    }
  }

  return { salesToday, salesWeek, salesMonth, monthScheduledProduction };
}

function normalizeMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

const cookie = await fetchHcpCookie();
const jobDetails = await fetchJobDetailsThisWeek(cookie);
const expected = computeExpectedSales(jobDetails);
const dashboard = await fetchDashboard();
const actual = {
  salesToday: normalizeMoney(dashboard?.settings?.salesToday || 0),
  salesWeek: normalizeMoney(dashboard?.weeks?.currentWeek?.approvedSales || 0),
  salesMonth: normalizeMoney(dashboard?.settings?.salesMonth || 0),
  monthScheduledProduction: normalizeMoney(dashboard?.settings?.salesYear || 0),
};

const expectedNormalized = {
  salesToday: normalizeMoney(expected.salesToday),
  salesWeek: normalizeMoney(expected.salesWeek),
  salesMonth: normalizeMoney(expected.salesMonth),
  monthScheduledProduction: normalizeMoney(expected.monthScheduledProduction),
};

const failures = Object.entries(expectedNormalized)
  .filter(([key, value]) => normalizeMoney(actual[key]) !== normalizeMoney(value))
  .map(([key, value]) => `${key}: expected ${value}, got ${actual[key]}`);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, expected: expectedNormalized, actual, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, expected: expectedNormalized, actual }, null, 2));
