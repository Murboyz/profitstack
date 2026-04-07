import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  probeSupabaseWithServiceRole,
  getSupabaseEnv,
  getAuthUser,
  getUserByEmail,
  getOrganizationById,
  getWeekMetricsByOrg,
  getMetricOverridesByOrg,
  upsertMetricOverride,
  getCrmConnectionByOrg,
  upsertCrmConnection,
  getSyncRunsByOrg,
  insertSyncRun,
} from './supabase-client.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const statusPath = path.resolve(__dirname, '../../STATUS.md');
const appRoot = path.resolve(__dirname, '../../frontend/app');
const host = '0.0.0.0';
const port = Number(process.env.PORT || 8787);

async function loadStatusText() {
  return fs.readFile(statusPath, 'utf8');
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Email',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(text);
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url, 'http://127.0.0.1');
  const reqPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const targetPath = path.normalize(path.join(appRoot, reqPath));
  if (!targetPath.startsWith(appRoot)) {
    return sendText(res, 403, 'Forbidden');
  }

  try {
    const content = await fs.readFile(targetPath);
    const ext = path.extname(targetPath);
    const typeMap = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
    };
    return sendText(res, 200, content, typeMap[ext] || 'application/octet-stream');
  } catch {
    return sendText(res, 404, 'Not found');
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function resolveContext(req) {
  const authHeader = req.headers.authorization || '';
  let email = req.headers['x-user-email'];

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    const authUser = await getAuthUser(token);
    email = authUser?.email || email;
  }

  if (!email) {
    const error = new Error('Missing X-User-Email header');
    error.statusCode = 401;
    throw error;
  }
  const user = await getUserByEmail(email);
  if (!user) {
    const error = new Error(`No user found for ${email}`);
    error.statusCode = 401;
    throw error;
  }
  const organization = await getOrganizationById(user.organization_id);
  if (!organization) {
    const error = new Error(`No organization found for ${user.organization_id}`);
    error.statusCode = 404;
    throw error;
  }
  return { email, user, organization };
}

function formatRange(startDate, endDate) {
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const start = fmt.format(new Date(`${startDate}T00:00:00Z`));
  const end = fmt.format(new Date(`${endDate}T00:00:00Z`));
  const clean = (value) => value.replace(',', '');
  return `${clean(start)}–${clean(end)}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(date = new Date()) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(copy, diff);
}

function buildEmptyWeeks(anchorDate = new Date()) {
  const currentWeekStart = startOfUtcWeek(anchorDate);
  const offsets = {
    lastWeek: -7,
    currentWeek: 0,
    nextWeek: 7,
    weekPlus2: 14,
    weekPlus3: 21,
  };

  return Object.fromEntries(
    Object.entries(offsets).map(([key, offsetDays]) => {
      const weekStart = addDays(currentWeekStart, offsetDays);
      const weekEnd = addDays(weekStart, 6);
      return [
        key,
        {
          weekStartDate: toIsoDate(weekStart),
          range: formatRange(toIsoDate(weekStart), toIsoDate(weekEnd)),
          scheduledProduction: 0,
          approvedSales: 0,
        },
      ];
    })
  );
}

function buildWeeksFromMetrics(rows) {
  const fallbackWeeks = buildEmptyWeeks();
  if (!rows?.length) return fallbackWeeks;
  const byWeekStart = Object.fromEntries(
    rows.map((row) => [
      row.week_start_date,
      {
        weekStartDate: row.week_start_date,
        range: formatRange(row.week_start_date, row.week_end_date),
        scheduledProduction: Number(row.scheduled_production || 0),
        approvedSales: row.approved_sales == null ? undefined : Number(row.approved_sales),
      },
    ])
  );

  return Object.fromEntries(
    Object.entries(fallbackWeeks).map(([key, fallbackWeek]) => [
      key,
      byWeekStart[fallbackWeek.weekStartDate] || fallbackWeek,
    ])
  );
}

function applyOverridesToWeeks(weeks, overrides) {
  const byWeek = Object.fromEntries(
    (overrides || []).map((item) => [
      `${item.week_start_date}:${item.metric_key}`,
      Number(item.metric_value),
    ])
  );

  const weekKeyMap = {
    lastWeek: weeks.lastWeek?.weekStartDate,
    currentWeek: weeks.currentWeek?.weekStartDate,
    nextWeek: weeks.nextWeek?.weekStartDate,
    weekPlus2: weeks.weekPlus2?.weekStartDate,
    weekPlus3: weeks.weekPlus3?.weekStartDate,
  };

  const merged = {};
  for (const [key, week] of Object.entries(weeks)) {
    const weekStart = weekKeyMap[key];
    merged[key] = {
      ...week,
      scheduledProduction: byWeek[`${weekStart}:scheduledProduction`] ?? week.scheduledProduction,
      approvedSales: byWeek[`${weekStart}:approvedSales`] ?? week.approvedSales,
    };
  }
  return merged;
}

function summarizeOverridesByWeek(weeks, overrides) {
  const summary = {};
  const weekStartByKey = Object.fromEntries(
    Object.entries(weeks).map(([key, value]) => [value.weekStartDate, key])
  );

  for (const item of overrides || []) {
    const key = weekStartByKey[item.week_start_date];
    if (!key) continue;
    summary[key] ||= {};
    summary[key][item.metric_key] = true;
  }

  return summary;
}

function formatDashboardCrmConnection(item) {
  if (!item) {
    return {
      provider: 'not_connected',
      status: 'missing',
      lastSyncAt: null,
      lastError: null,
    };
  }

  return {
    provider: item.provider,
    status: item.status,
    lastSyncAt: item.last_sync_at,
    lastError: item.last_error,
  };
}

function buildCredentialEnvelope(body, context) {
  const fields = typeof body.credentials === 'object' && body.credentials !== null ? body.credentials : {};
  const fieldKeys = Object.keys(fields).filter(Boolean);
  return {
    version: 1,
    provider: body.provider,
    authType: body.authType,
    accountLabel: body.accountLabel || null,
    savedAt: new Date().toISOString(),
    savedByUserId: context.user?.id || null,
    hasCredentials: fieldKeys.length > 0,
    fieldKeys,
    fields,
  };
}

function formatOverrides(items) {
  return (items || []).map((item) => ({
    id: item.id,
    weekStartDate: item.week_start_date,
    metricKey: item.metric_key,
    metricValue: Number(item.metric_value),
    reason: item.reason,
  }));
}

function formatSyncRuns(items) {
  return (items || []).map((item) => ({
    id: item.id,
    startedAt: item.started_at,
    finishedAt: item.finished_at,
    status: item.status,
    recordsPulled: item.records_pulled,
    errorMessage: item.error_message,
  }));
}

function formatSession(context) {
  return {
    user: {
      id: context.user.id,
      email: context.user.email,
      fullName: context.user.full_name,
      role: context.user.role,
    },
    organization: {
      id: context.organization.id,
      name: context.organization.name,
      slug: context.organization.slug,
      timezone: context.organization.timezone,
      status: context.organization.status,
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  const requestUrl = new URL(req.url, 'http://127.0.0.1');
  const pathname = requestUrl.pathname;

  if (pathname.startsWith('/api/')) {
    try {
      if (req.method === 'GET' && pathname === '/api/status') {
        const text = await loadStatusText();
        return sendText(res, 200, text, 'text/plain; charset=utf-8');
      }

      if (req.method === 'GET' && pathname === '/api/health') {
        const status = await probeSupabaseWithServiceRole();
        return sendJson(res, status.ok ? 200 : 502, {
          ok: status.ok,
          supabase: status.ok,
          app: 'profitstack',
          authRequired: false,
        });
      }

      if (req.method === 'GET' && pathname === '/api/frontend-config') {
        const env = getSupabaseEnv();
        return sendJson(res, 200, {
          supabaseUrl: env.SUPABASE_URL,
          supabaseAnonKey: env.SUPABASE_ANON_KEY,
        });
      }

      const context = await resolveContext(req);

      if (req.method === 'GET' && pathname === '/api/session') {
        return sendJson(res, 200, formatSession(context));
      }
      if (req.method === 'GET' && pathname === '/api/dashboard') {
        const crmConnection = await getCrmConnectionByOrg(context.organization.id);
        const weekMetrics = await getWeekMetricsByOrg(context.organization.id);
        const overrides = await getMetricOverridesByOrg(context.organization.id);
        const liveWeeks = buildWeeksFromMetrics(weekMetrics);
        const mergedWeeks = applyOverridesToWeeks(liveWeeks, overrides);
        return sendJson(res, 200, {
          organization: formatSession(context).organization,
          crmConnection: formatDashboardCrmConnection(crmConnection),
          weeks: mergedWeeks,
          overridesApplied: summarizeOverridesByWeek(mergedWeeks, overrides),
        });
      }
      if (req.method === 'GET' && pathname === '/api/crm-connection') {
        const crmConnection = await getCrmConnectionByOrg(context.organization.id);
        return sendJson(res, 200, crmConnection || {});
      }
      if (req.method === 'POST' && pathname === '/api/crm-connection') {
        const body = await readJsonBody(req);
        const credentialEnvelope = buildCredentialEnvelope(body, context);
        const saved = await upsertCrmConnection({
          id: '50000000-0000-0000-0000-000000000001',
          organization_id: context.organization.id,
          provider: body.provider,
          status: credentialEnvelope.hasCredentials ? 'connected' : 'pending',
          auth_type: body.authType,
          encrypted_credentials: credentialEnvelope,
          last_sync_at: new Date().toISOString(),
          last_error: null,
        });
        return sendJson(res, 200, { ok: true, message: 'CRM connection saved to Supabase', item: saved?.[0] || null });
      }
      if (req.method === 'GET' && pathname === '/api/overrides') {
        const overrides = await getMetricOverridesByOrg(context.organization.id);
        return sendJson(res, 200, { items: formatOverrides(overrides) });
      }
      if (req.method === 'POST' && pathname === '/api/overrides') {
        const body = await readJsonBody(req);
        const saved = await upsertMetricOverride({
          id: crypto.randomUUID(),
          organization_id: context.organization.id,
          week_start_date: body.weekStartDate,
          metric_key: body.metricKey,
          metric_value: body.metricValue,
          reason: body.reason || 'saved from app stub',
          created_by_user_id: context.user?.id || null,
        });
        return sendJson(res, 200, { ok: true, message: 'Override saved to Supabase', item: saved?.[0] || null });
      }
      if (req.method === 'GET' && pathname === '/api/sync-runs') {
        const rows = await getSyncRunsByOrg(context.organization.id);
        return sendJson(res, 200, { items: formatSyncRuns(rows) });
      }
      if (req.method === 'POST' && pathname === '/api/sync-runs') {
        const body = await readJsonBody(req);
        const crmConnection = await getCrmConnectionByOrg(context.organization.id);
        const now = new Date().toISOString();
        const startedAt = body.startedAt || now;
        const finishedAt = body.finishedAt || now;
        const status = body.status || 'success';
        const recordsPulled = Number(body.recordsPulled ?? 0);
        const saved = await insertSyncRun({
          id: crypto.randomUUID(),
          organization_id: context.organization.id,
          crm_connection_id: crmConnection?.id || null,
          started_at: startedAt,
          finished_at: finishedAt,
          status,
          records_pulled: Number.isFinite(recordsPulled) ? recordsPulled : 0,
          error_message: body.errorMessage || null,
          raw_snapshot_path: body.rawSnapshotPath || null,
        });
        return sendJson(res, 200, { ok: true, message: 'Sync run saved to Supabase', item: formatSyncRuns(saved || [])[0] || null });
      }
      if (req.method === 'GET' && pathname === '/api/organizations/me') {
        return sendJson(res, 200, context.organization || {});
      }
      if (req.method === 'GET' && pathname === '/api/users/me') {
        return sendJson(res, 200, context.user || {});
      }
      if (req.method === 'GET' && pathname === '/api/supabase-status') {
        const status = await probeSupabaseWithServiceRole();
        return sendJson(res, status.ok ? 200 : 502, status);
      }
      if (req.method === 'GET' && pathname === '/api/health/session') {
        const [status, crm, syncRuns] = await Promise.all([
          probeSupabaseWithServiceRole(),
          getCrmConnectionByOrg(context.organization.id),
          getSyncRunsByOrg(context.organization.id),
        ]);
        return sendJson(res, 200, {
          supabase: status.ok,
          organization: context.organization.name,
          user: context.user.email,
          crmStatus: crm?.status || null,
          syncRuns: (syncRuns || []).length,
        });
      }

      return sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: error.message });
    }
  }

  return serveStatic(req, res);
});

server.listen(port, host, () => {
  console.log(`ProfitStack app listening on http://${host}:${port}`);
});
