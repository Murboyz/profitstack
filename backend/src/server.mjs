import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  probeSupabaseWithServiceRole,
  getSupabaseEnv,
  getAuthUser,
  generateMagicLink,
  generateRecoveryLink,
  createAuthUserWithPassword,
  getUserByAuthUserId,
  getUserByEmail,
  linkUserAuthIdentity,
  getOrganizationById,
  listOrganizations,
  getOrganizationSettingsByOrg,
  listOrganizationSettings,
  getWeekMetricsByOrg,
  listWeekMetrics,
  upsertWeekMetrics,
  getMetricOverridesByOrg,
  upsertMetricOverride,
  upsertOrganizationSettings,
  getCrmConnectionByOrg,
  listCrmConnections,
  upsertCrmConnection,
  getSyncRunsByOrg,
  listSyncRuns,
  insertSyncRun,
  insertCrmSnapshot,
  getLatestCrmSnapshotByOrg,
  revokeSession,
  updateAuthUserPassword,
  listUsers,
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
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.end(text);
}

function getRequestOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!hostHeader) {
    const error = new Error('Missing Host header');
    error.statusCode = 400;
    throw error;
  }
  return `${proto}://${hostHeader}`;
}

function getSafeRedirectTo(req, requestedRedirectTo, fallbackPath) {
  const origin = getRequestOrigin(req);
  const fallback = new URL(fallbackPath, origin).toString();
  if (!requestedRedirectTo) return fallback;
  try {
    const parsed = new URL(String(requestedRedirectTo), origin);
    if (parsed.origin !== origin) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function getBillingEnv() {
  const env = getSupabaseEnv();
  return {
    secretKey: env.STRIPE_SECRET_KEY || '',
    publishableKey: env.STRIPE_PUBLISHABLE_KEY || '',
    priceId: env.STRIPE_PRICE_ID || '',
    priceDisplay: env.STRIPE_PRICE_DISPLAY || 'Monthly subscription',
    supportEmail: env.BILLING_SUPPORT_EMAIL || 'support@example.com',
    appUrl: env.APP_URL || '',
  };
}

function getBillingBaseUrl(req) {
  const billingEnv = getBillingEnv();
  return String(billingEnv.appUrl || getRequestOrigin(req)).replace(/\/$/, '');
}

function buildBillingSummary(req, context) {
  const billingEnv = getBillingEnv();
  const configured = Boolean(billingEnv.secretKey && billingEnv.priceId);
  return {
    configured,
    checkoutReady: configured,
    planName: 'The Nut Report',
    planInterval: 'month',
    priceDisplay: billingEnv.priceDisplay,
    supportEmail: billingEnv.supportEmail,
    publishableKeyConfigured: Boolean(billingEnv.publishableKey),
    checkoutPath: configured ? '/api/billing/checkout-session' : null,
    successUrl: `${getBillingBaseUrl(req)}/account.html?billing=success`,
    cancelUrl: `${getBillingBaseUrl(req)}/account.html?billing=cancelled`,
    customerEmail: context?.email || null,
  };
}

function requireAdmin(context) {
  if (String(context?.user?.role || '').toLowerCase() !== 'admin') {
    const error = new Error('Admin access required');
    error.statusCode = 403;
    throw error;
  }
}

async function getAdminViewOrganization(context, requestedOrgId) {
  if (!requestedOrgId) return null;
  if (String(context?.user?.role || '').toLowerCase() !== 'admin') return null;
  if (String(context?.organization?.slug || '') !== 'the-nut-report-admin') return null;
  if (requestedOrgId === context.organization.id) return context.organization;
  return getOrganizationById(requestedOrgId);
}

async function stripeRequest(pathname, params = {}) {
  const billingEnv = getBillingEnv();
  if (!billingEnv.secretKey) return null;
  const url = new URL(`https://api.stripe.com${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${billingEnv.secretKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Stripe request failed (${response.status}) for ${pathname}`);
  }
  return response.json();
}

async function getStripeBillingStatus({ email, organizationId }) {
  const billingEnv = getBillingEnv();
  if (!billingEnv.secretKey || !email) {
    return {
      configured: Boolean(billingEnv.secretKey),
      customerEmail: email || null,
      customerId: null,
      subscriptionStatus: 'unknown',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }

  const customerSearch = await stripeRequest('/v1/customers/search', {
    query: `email:'${String(email).replace(/'/g, "\\'")}'`,
    limit: 1,
  }).catch(() => ({ data: [] }));
  const customer = customerSearch?.data?.[0] || null;

  let subscription = null;
  if (customer?.id) {
    const subscriptions = await stripeRequest('/v1/subscriptions', {
      customer: customer.id,
      status: 'all',
      limit: 3,
    }).catch(() => ({ data: [] }));
    subscription = subscriptions?.data?.[0] || null;
  }

  if (!subscription && organizationId) {
    const checkoutSearch = await stripeRequest('/v1/checkout/sessions/search', {
      query: `metadata['organization_id']:'${organizationId}'`,
      limit: 1,
    }).catch(() => ({ data: [] }));
    const session = checkoutSearch?.data?.[0] || null;
    if (session?.subscription) {
      subscription = await stripeRequest(`/v1/subscriptions/${session.subscription}`).catch(() => null);
    }
  }

  return {
    configured: true,
    customerEmail: email || customer?.email || null,
    customerId: customer?.id || null,
    subscriptionId: subscription?.id || null,
    subscriptionStatus: subscription?.status || (customer ? 'customer_only' : 'not_found'),
    currentPeriodEnd: subscription?.current_period_end
      ? new Date(Number(subscription.current_period_end) * 1000).toISOString()
      : null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
  };
}

async function getAdminClientsOverview() {
  const [organizations, users, settings, crmConnections, syncRuns, weekMetrics] = await Promise.all([
    listOrganizations(),
    listUsers(),
    listOrganizationSettings(),
    listCrmConnections(),
    listSyncRuns(300),
    listWeekMetrics(),
  ]);

  const userMap = new Map();
  for (const user of users || []) {
    if (!userMap.has(user.organization_id)) userMap.set(user.organization_id, []);
    userMap.get(user.organization_id).push(user);
  }

  const settingsMap = new Map((settings || []).map((item) => [item.organization_id, item]));
  const crmMap = new Map();
  for (const item of crmConnections || []) {
    if (!crmMap.has(item.organization_id)) crmMap.set(item.organization_id, item);
  }
  const syncMap = new Map();
  for (const item of syncRuns || []) {
    if (!syncMap.has(item.organization_id)) syncMap.set(item.organization_id, item);
  }

  const latestWeekByOrg = new Map();
  const recentWeeksByOrg = new Map();
  for (const item of weekMetrics || []) {
    const current = latestWeekByOrg.get(item.organization_id);
    if (!current || String(item.week_start_date) > String(current.week_start_date)) {
      latestWeekByOrg.set(item.organization_id, item);
    }

    if (!recentWeeksByOrg.has(item.organization_id)) recentWeeksByOrg.set(item.organization_id, []);
    recentWeeksByOrg.get(item.organization_id).push(item);
  }

  const clients = [];
  for (const organization of organizations || []) {
    const orgUsers = userMap.get(organization.id) || [];
    const primaryUser = orgUsers.find((item) => String(item.role || '').toLowerCase() === 'admin') || orgUsers[0] || null;
    const billing = await getStripeBillingStatus({ email: primaryUser?.email, organizationId: organization.id });
    const setting = settingsMap.get(organization.id) || null;
    const crm = crmMap.get(organization.id) || null;
    const latestSync = syncMap.get(organization.id) || null;
    const latestWeek = latestWeekByOrg.get(organization.id) || null;
    const recentWeeks = (recentWeeksByOrg.get(organization.id) || [])
      .sort((a, b) => String(b.week_start_date).localeCompare(String(a.week_start_date)))
      .slice(0, 6)
      .map((item) => ({
        weekStartDate: item.week_start_date,
        weekEndDate: item.week_end_date,
        scheduledProduction: Number(item.scheduled_production || 0),
        approvedSales: Number(item.approved_sales || 0),
      }));

    clients.push({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        timezone: organization.timezone,
        createdAt: organization.created_at,
      },
      primaryUser: primaryUser ? {
        id: primaryUser.id,
        fullName: primaryUser.full_name,
        email: primaryUser.email,
        role: primaryUser.role,
        createdAt: primaryUser.created_at,
      } : null,
      metrics: {
        salesMonth: Number(setting?.sales_month || 0),
        monthProduction: Number(setting?.sales_year || 0),
        monthlyExpenseTarget: Number(setting?.monthly_expense_target || 0),
        profitGoalPercent: Number(setting?.profit_percentage || 0),
        latestWeekStart: latestWeek?.week_start_date || null,
        latestWeekScheduled: Number(latestWeek?.scheduled_production || 0),
        latestWeekApproved: Number(latestWeek?.approved_sales || 0),
        weeks: recentWeeks,
      },
      crm: crm ? {
        provider: crm.provider,
        status: crm.status,
        lastSyncAt: crm.last_sync_at,
        lastError: crm.last_error,
      } : null,
      sync: latestSync ? {
        status: latestSync.status,
        startedAt: latestSync.started_at,
        finishedAt: latestSync.finished_at,
        recordsPulled: latestSync.records_pulled,
        errorMessage: latestSync.error_message,
      } : null,
      billing,
    });
  }

  return clients;
}

async function createStripeCheckoutSession({ req, context }) {
  const billingEnv = getBillingEnv();
  if (!billingEnv.secretKey || !billingEnv.priceId) {
    const error = new Error('Stripe billing is not configured yet');
    error.statusCode = 503;
    throw error;
  }

  const successUrl = `${getBillingBaseUrl(req)}/account.html?billing=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${getBillingBaseUrl(req)}/account.html?billing=cancelled`;
  const payload = new URLSearchParams({
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    'line_items[0][price]': billingEnv.priceId,
    'line_items[0][quantity]': '1',
    customer_email: context.email,
    client_reference_id: context.organization.id,
    'metadata[organization_id]': context.organization.id,
    'metadata[organization_slug]': context.organization.slug || '',
    'metadata[user_id]': context.user.id,
    'metadata[user_email]': context.email,
    'metadata[app]': 'profitstack',
    billing_address_collection: 'auto',
    allow_promotion_codes: 'false',
  });

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${billingEnv.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.url) {
    const message = data?.error?.message || `Stripe checkout failed with ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status || 502;
    throw error;
  }

  return {
    id: data.id,
    url: data.url,
    successUrl,
    cancelUrl,
  };
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
  if (!authHeader.startsWith('Bearer ')) {
    const error = new Error('Authorization required');
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  let authUser;
  try {
    authUser = await getAuthUser(token);
  } catch {
    const error = new Error('Invalid or expired session');
    error.statusCode = 401;
    throw error;
  }

  const email = authUser?.email;
  const authUserId = authUser?.id;
  if (!email) {
    const error = new Error('Could not resolve identity from token');
    error.statusCode = 401;
    throw error;
  }

  let user = authUserId ? await getUserByAuthUserId(authUserId) : null;
  if (!user) {
    user = await getUserByEmail(email);
  }
  if (!user) {
    const error = new Error(`No user found for ${email}`);
    error.statusCode = 401;
    throw error;
  }
  if (authUserId && !user.auth_user_id) {
    const linked = await linkUserAuthIdentity(user.id, authUserId);
    user = linked?.[0] || { ...user, auth_user_id: authUserId };
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
          realizedSales3Weeks: 0,
          capturedSales6Weeks: 0,
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
        realizedSales3Weeks: 0,
        capturedSales6Weeks: 0,
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
      approvedSales: week.approvedSales,
      realizedSales3Weeks: byWeek[`${weekStart}:realizedSales3Weeks`] ?? week.realizedSales3Weeks,
      capturedSales6Weeks: byWeek[`${weekStart}:capturedSales6Weeks`] ?? week.capturedSales6Weeks,
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

function formatCrmConnectionDetail(item) {
  if (!item) {
    return {
      provider: 'not_connected',
      status: 'not_connected',
      authType: null,
      accountLabel: null,
      savedFields: [],
      savedAt: null,
      hasCredentials: false,
      lastSyncAt: null,
      lastError: null,
    };
  }

  const credentialEnvelope = item.encrypted_credentials || {};
  return {
    id: item.id,
    provider: item.provider,
    status: item.status,
    authType: item.auth_type || credentialEnvelope.authType || null,
    accountLabel: credentialEnvelope.accountLabel || null,
    savedFields: credentialEnvelope.fieldKeys || [],
    savedAt: credentialEnvelope.savedAt || null,
    hasCredentials: Boolean(credentialEnvelope.hasCredentials),
    lastSyncAt: item.last_sync_at || null,
    lastError: item.last_error || null,
  };
}

function normalizeHousecallSessionCookie(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (/^cookie:/i.test(input)) return input.replace(/^cookie:\s*/i, '').trim();
  return input;
}

function buildCredentialEnvelope(body, context) {
  const rawFields = typeof body.credentials === 'object' && body.credentials !== null ? body.credentials : {};
  const fields = { ...rawFields };
  if (body.provider === 'housecall_pro' && fields.sessionCookie) {
    fields.sessionCookie = normalizeHousecallSessionCookie(fields.sessionCookie);
  }
  const fieldKeys = Object.keys(fields).filter((key) => Boolean(key) && fields[key] !== undefined && fields[key] !== null && fields[key] !== '');
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

function normalizeWeekMetricInput(item) {
  if (!item || !item.weekStartDate || !item.weekEndDate) {
    throw new Error('Each week metric needs weekStartDate and weekEndDate');
  }
  return {
    week_start_date: item.weekStartDate,
    week_end_date: item.weekEndDate,
    scheduled_production: toNumberOrNull(item.scheduledProduction),
    approved_sales: toNumberOrNull(item.approvedSales),
    completed_production: toNumberOrNull(item.completedProduction),
    opportunities: toIntegerOrNull(item.opportunities),
    source_confidence: item.sourceConfidence || 'imported_snapshot',
    source_version: item.sourceVersion || 'manual-sync-v1',
  };
}

function normalizeSnapshotPayload(snapshot) {
  if (Array.isArray(snapshot)) {
    return snapshot.map(normalizeWeekMetricInput);
  }
  if (Array.isArray(snapshot?.weeks)) {
    return snapshot.weeks.map(normalizeWeekMetricInput);
  }
  throw new Error('Snapshot payload must be an array or { weeks: [...] }');
}

function formatDateOnly(date) {
  return toIsoDate(date);
}

function formatDateInTimeZone(dateValue, timeZone = 'UTC') {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function endOfUtcWeek(start) {
  return addDays(start, 6);
}

function buildWeekBuckets(anchorDate = new Date(), count = 5, leadingWeeks = 1) {
  const firstWeek = startOfUtcWeek(anchorDate);
  firstWeek.setUTCDate(firstWeek.getUTCDate() - (leadingWeeks * 7));
  return Array.from({ length: count }, (_, index) => {
    const weekStart = new Date(firstWeek);
    weekStart.setUTCDate(weekStart.getUTCDate() + (index * 7));
    const weekEnd = endOfUtcWeek(weekStart);
    return {
      key: formatDateOnly(weekStart),
      weekStartDate: formatDateOnly(weekStart),
      weekEndDate: formatDateOnly(weekEnd),
      scheduledProduction: 0,
      approvedSales: 0,
      completedProduction: 0,
      opportunities: 0,
      sourceConfidence: 'session_live_pull',
      sourceVersion: 'housecall-pro-v1',
    };
  });
}

function toCurrencyNumber(rawValue) {
  if (rawValue == null) return 0;
  return Number(rawValue) / 100;
}

function getBaseInvoiceNumber(invoiceNumber) {
  return String(invoiceNumber || '').replace(/-\d+$/, '');
}

function incrementWeekMetric(weekMap, dateValue, updater) {
  if (!dateValue) return;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return;
  const weekKey = formatDateOnly(startOfUtcWeek(date));
  const bucket = weekMap.get(weekKey);
  if (!bucket) return;
  updater(bucket);
}

function getSpanAllocationByWeek(weekMap, startValue, endValue, totalAmount) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !(totalAmount > 0) || end <= start) return [];

  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs));
  const allocations = [];

  for (const bucket of weekMap.values()) {
    const weekStart = new Date(`${bucket.weekStartDate}T00:00:00.000Z`);
    const weekEndExclusive = new Date(`${bucket.weekEndDate}T23:59:59.999Z`);
    weekEndExclusive.setUTCMilliseconds(weekEndExclusive.getUTCMilliseconds() + 1);
    const overlapStart = Math.max(start.getTime(), weekStart.getTime());
    const overlapEnd = Math.min(end.getTime(), weekEndExclusive.getTime());
    if (overlapEnd <= overlapStart) continue;
    const overlapDays = Math.max(1, Math.ceil((overlapEnd - overlapStart) / dayMs));
    allocations.push({ weekKey: bucket.key, amount: totalAmount * (overlapDays / totalDays) });
  }

  return allocations;
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

function getWeekAllocatedAmountForMonth(monthKey, weekStartDate, weekEndDate, totalAmount) {
  if (!(totalAmount > 0) || !weekStartDate || !weekEndDate) return 0;

  const [year, month] = monthKey.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const monthEndExclusive = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const weekStart = new Date(`${weekStartDate}T00:00:00.000Z`);
  const weekEndExclusive = new Date(`${weekEndDate}T23:59:59.999Z`);
  weekEndExclusive.setUTCMilliseconds(weekEndExclusive.getUTCMilliseconds() + 1);

  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.ceil((weekEndExclusive.getTime() - weekStart.getTime()) / dayMs));
  const overlapStart = Math.max(weekStart.getTime(), monthStart.getTime());
  const overlapEnd = Math.min(weekEndExclusive.getTime(), monthEndExclusive.getTime());
  if (overlapEnd <= overlapStart) return 0;
  const overlapDays = Math.max(1, Math.ceil((overlapEnd - overlapStart) / dayMs));
  return totalAmount * (overlapDays / totalDays);
}

function getVisibleMonthScheduledProduction(monthKey, weekMap) {
  const [year, month] = monthKey.split('-').map(Number);
  const monthStartDate = `${monthKey}-01`;
  const nextMonthStartDate = formatDateOnly(new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)));

  let total = 0;
  for (const bucket of weekMap.values()) {
    const scheduledProduction = Number(bucket.scheduledProduction || 0);
    if (!(scheduledProduction > 0)) continue;

    if (bucket.weekStartDate < monthStartDate && bucket.weekEndDate >= monthStartDate) {
      total += getWeekAllocatedAmountForMonth(monthKey, bucket.weekStartDate, bucket.weekEndDate, scheduledProduction);
      continue;
    }

    if (bucket.weekStartDate >= monthStartDate && bucket.weekStartDate < nextMonthStartDate) {
      total += scheduledProduction;
    }
  }

  return total;
}

async function fetchJsonWithCookie(url, sessionCookie) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      headers: {
        Cookie: sessionCookie,
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://pro.housecallpro.com/app/reporting',
        Origin: 'https://pro.housecallpro.com',
        'User-Agent': 'ProfitStack/0.1',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HCP fetch failed (${response.status}) for ${url}`);
    }
    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`HCP fetch timed out for ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getBrowserCdpPages() {
  const response = await fetch('http://127.0.0.1:18800/json/list');
  if (!response.ok) throw new Error(`CDP list failed with ${response.status}`);
  return response.json();
}

async function evaluateInBrowserPage(pageWsUrl, expression) {
  const ws = new WebSocket(pageWsUrl);
  let id = 0;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
    if (message.id && pending.has(message.id)) {
      const current = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) current.reject(new Error(message.error.message || JSON.stringify(message.error)));
      else current.resolve(message.result);
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', (event) => reject(event.error || new Error('CDP websocket failed')), { once: true });
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  try {
    await send('Runtime.enable');
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'CDP evaluate failed');
    }
    return result.result.value;
  } finally {
    ws.close();
  }
}

async function fetchHousecallProViaBrowser(rangeStartIso, rangeEndIso) {
  const pages = await getBrowserCdpPages();
  const page = pages.find((item) => item.type === 'page' && item.url.includes('pro.housecallpro.com/app')) || pages[0];
  if (!page?.webSocketDebuggerUrl) {
    throw new Error('No active browser page found for Housecall Pro');
  }

  const expression = `(async () => {
    const rangeStart = ${JSON.stringify(rangeStartIso)};
    const rangeEnd = ${JSON.stringify(rangeEndIso)};
    const fetchJson = async (url) => {
      const res = await fetch(url, { credentials: 'include' });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { ok: res.ok, status: res.status, json, text: text.slice(0, 500) };
    };

    const calendarUrl = '/api/scheduling/calendar_items/web/organization_calendar_items?start_date=' + encodeURIComponent(rangeStart) + '&end_date=' + encodeURIComponent(rangeEnd);
    const calendar = await fetchJson(calendarUrl);
    if (!calendar.ok) throw new Error('calendar_items ' + calendar.status + ' ' + calendar.text);

    const estimates = [];
    let page = 1;
    let keepGoing = true;
    while (keepGoing && page <= 12) {
      const res = await fetchJson('/beta/estimates?page=' + page + '&page_size=200');
      if (!res.ok) throw new Error('estimates ' + res.status + ' ' + res.text);
      const items = (res.json && res.json.data) || [];
      if (!items.length) break;
      estimates.push(...items);
      keepGoing = items.some((item) => item.created_at && item.created_at >= rangeStart);
      page += 1;
    }

    return {
      calendarItems: (calendar.json && calendar.json.calendar_items) || [],
      estimates,
    };
  })()`;

  return evaluateInBrowserPage(page.webSocketDebuggerUrl, expression);
}

async function fetchHousecallProSnapshot(crmConnection, timeZone = 'UTC') {
  const fields = crmConnection?.encrypted_credentials?.fields || {};
  const sessionCookie = fields.sessionCookie;
  if (!sessionCookie) return null;

  const now = new Date();
  const weeks = buildWeekBuckets(now, 8, 2);
  const weekMap = new Map(weeks.map((week) => [week.key, week]));
  const currentMonthKey = formatDateInTimeZone(now, 'UTC').slice(0, 7);
  const todayDate = formatDateInTimeZone(now, timeZone);
  const jobDetailsById = new Map();
  const rangeStart = new Date(`${weeks[0].weekStartDate}T00:00:00.000Z`);
  const rangeEnd = new Date(`${weeks[weeks.length - 1].weekEndDate}T23:59:59.999Z`);

  let payload;
  try {
    payload = await fetchHousecallProViaBrowser(rangeStart.toISOString(), rangeEnd.toISOString());
  } catch {
    const calendarUrl = new URL('https://pro.housecallpro.com/api/scheduling/calendar_items/web/organization_calendar_items');
    calendarUrl.searchParams.set('start_date', rangeStart.toISOString());
    calendarUrl.searchParams.set('end_date', rangeEnd.toISOString());

    const estimates = [];
    let page = 1;
    let keepGoing = true;
    while (keepGoing && page <= 12) {
      const estimatesUrl = new URL('https://pro.housecallpro.com/beta/estimates');
      estimatesUrl.searchParams.set('page', String(page));
      estimatesUrl.searchParams.set('page_size', '200');
      const res = await fetchJsonWithCookie(estimatesUrl.toString(), sessionCookie);
      const items = res.data || [];
      if (!items.length) break;
      estimates.push(...items);
      keepGoing = items.some((item) => item.created_at && item.created_at >= rangeStart.toISOString());
      page += 1;
    }

    const calendarItems = (await fetchJsonWithCookie(calendarUrl.toString(), sessionCookie)).calendar_items || [];

    const jobs = [];
    for (let page = 1; page <= 8; page += 1) {
      const jobsUrl = new URL('https://pro.housecallpro.com/alpha/jobs/jobs_list');
      jobsUrl.searchParams.set('page', String(page));
      jobsUrl.searchParams.set('page_size', '200');
      const res = await fetchJsonWithCookie(jobsUrl.toString(), sessionCookie);
      const items = res?.data?.data || [];
      if (!items.length) break;
      jobs.push(...items);
    }

    const calendarJobIds = new Set(
      calendarItems
        .filter((item) => String(item.type || '').toLowerCase() === 'job')
        .flatMap((item) => [item.appointable_id, item.job_id])
        .filter(Boolean)
    );
    const recentJobIds = new Set(jobs.slice(0, 200).map((job) => job.id).filter(Boolean));
    const jobIds = [...new Set([...calendarJobIds, ...recentJobIds])];

    const jobDetails = [];
    const recentJobDetails = [];
    for (const jobId of jobIds) {
      const detail = await fetchJsonWithCookie(`https://pro.housecallpro.com/alpha/jobs/${jobId}`, sessionCookie);
      jobDetails.push(detail);
      if (recentJobIds.has(jobId)) {
        recentJobDetails.push(detail);
      }
    }

    payload = {
      calendarItems,
      estimates,
      jobDetails,
      rollupJobDetails: recentJobDetails,
    };
  }

  for (const job of payload.jobDetails || []) {
    jobDetailsById.set(job.id, job);
  }

  for (const item of payload.calendarItems || []) {
    if (String(item.type || '').toLowerCase() !== 'job') continue;
    const job = jobDetailsById.get(item.appointable_id || item.job_id);
    const scheduledAmount = toCurrencyNumber(item.attributes?.amount || item.amount || job?.total_amount || 0);
    incrementWeekMetric(weekMap, item.start || item.start_date, (bucket) => {
      bucket.scheduledProduction += scheduledAmount;
    });
  }

  const jobFamilies = new Map();
  for (const job of payload.jobDetails || []) {
    const baseInvoice = getBaseInvoiceNumber(job.invoice_number);
    if (!baseInvoice) continue;
    const family = jobFamilies.get(baseInvoice) || [];
    family.push(job);
    jobFamilies.set(baseInvoice, family);
  }

  for (const family of jobFamilies.values()) {
    if (family.length < 2) continue;
    const positiveSegments = family.filter((job) => toCurrencyNumber(job.total_amount || 0) > 0);
    if (positiveSegments.length !== 1) continue;

    const totalAmount = toCurrencyNumber(positiveSegments[0].total_amount || 0);
    if (!totalAmount) continue;

    const share = totalAmount / family.length;
    incrementWeekMetric(weekMap, positiveSegments[0].scheduled_date, (bucket) => {
      bucket.scheduledProduction -= totalAmount;
    });
    for (const segment of family) {
      incrementWeekMetric(weekMap, segment.scheduled_date, (bucket) => {
        bucket.scheduledProduction += share;
      });
    }
  }

  for (const job of payload.jobDetails || []) {
    const totalAmount = toCurrencyNumber(job.total_amount || 0);
    const scheduleStart = job.schedule?.data?.start_time;
    const scheduleEnd = job.schedule?.data?.end_time;
    const allocations = getSpanAllocationByWeek(weekMap, scheduleStart, scheduleEnd, totalAmount);
    if (allocations.length <= 1) continue;

    incrementWeekMetric(weekMap, job.scheduled_date, (bucket) => {
      bucket.scheduledProduction -= totalAmount;
    });
    for (const allocation of allocations) {
      const bucket = weekMap.get(allocation.weekKey);
      if (!bucket) continue;
      bucket.scheduledProduction += allocation.amount;
    }
  }

  for (const estimate of payload.estimates || []) {
    const createdAt = estimate.created_at;
    incrementWeekMetric(weekMap, createdAt, (bucket) => {
      bucket.opportunities += 1;
    });

    const value = toCurrencyNumber(estimate.value || estimate.options?.[0]?.total_amount || 0);
    const approvedLike = String(estimate.outcome || '').toLowerCase() === 'won'
      || (estimate.options || []).some((option) => ['approved', 'scheduled'].includes(String(option.status || '').toLowerCase())
        || ['approved', 'scheduled'].includes(String(option.customer_estimate_status || '').toLowerCase()));

    if (approvedLike) {
      incrementWeekMetric(weekMap, estimate.completed_at || estimate.scheduled_date || createdAt, (bucket) => {
        bucket.approvedSales += value;
      });
    }
  }

  let salesToday = 0;
  let salesMonth = 0;
  let monthScheduledProduction = 0;
  const jobCreatedApprovedSales = new Map();
  const rollupJobDetails = payload.rollupJobDetails || payload.jobDetails || [];
  for (const job of rollupJobDetails) {
    jobDetailsById.set(job.id, job);
    const totalAmount = toCurrencyNumber(job.total_amount || 0);
    if (!totalAmount) continue;
    incrementWeekMetric(weekMap, job.created_at, (bucket) => {
      jobCreatedApprovedSales.set(bucket.key, (jobCreatedApprovedSales.get(bucket.key) || 0) + totalAmount);
    });
    const createdDate = formatDateInTimeZone(job.created_at, timeZone);
    if (createdDate === todayDate) {
      salesToday += totalAmount;
    }
    if (createdDate.slice(0, 7) === todayDate.slice(0, 7)) {
      salesMonth += totalAmount;
    }
  }

  for (const item of payload.calendarItems || []) {
    if (String(item.type || '').toLowerCase() !== 'job') continue;
    const productionDate = formatDateInTimeZone(item.start || item.start_date, timeZone);
    const job = jobDetailsById.get(item.appointable_id || item.job_id);
    const productionAmount = toCurrencyNumber(item.attributes?.amount || item.amount || job?.total_amount || 0);
    if (!productionAmount) continue;
    if (!job?.created_at) continue;
    const ageDays = Math.floor((new Date(item.start || item.start_date) - new Date(job.created_at)) / (24 * 60 * 60 * 1000));
    if (!Number.isFinite(ageDays) || ageDays < 0) continue;
    if (ageDays <= 21) {
      incrementWeekMetric(weekMap, item.start || item.start_date, (bucket) => {
        bucket.realizedSales3Weeks = (bucket.realizedSales3Weeks || 0) + productionAmount;
      });
    }
    if (ageDays <= 42) {
      incrementWeekMetric(weekMap, item.start || item.start_date, (bucket) => {
        bucket.capturedSales6Weeks = (bucket.capturedSales6Weeks || 0) + productionAmount;
      });
    }
  }

  for (const bucket of weekMap.values()) {
    bucket.approvedSales = jobCreatedApprovedSales.get(bucket.key) || 0;
  }

  monthScheduledProduction = getVisibleMonthScheduledProduction(currentMonthKey, weekMap);

  return {
    provider: 'housecall_pro',
    sourceLabel: 'housecall_pro_session_pull',
    fetchedAt: new Date().toISOString(),
    rollups: {
      salesToday,
      salesMonth,
      monthScheduledProduction,
    },
    weeks,
  };
}

async function fetchSnapshotFromCrmConnection(crmConnection, timeZone = 'UTC') {
  const fields = crmConnection?.encrypted_credentials?.fields || {};
  if (crmConnection?.provider === 'housecall_pro' && fields.sessionCookie) {
    return fetchHousecallProSnapshot(crmConnection, timeZone);
  }
  const snapshotUrl = fields.snapshotUrl || fields.exportUrl || fields.reportUrl || null;
  if (!snapshotUrl) return null;

  const method = String(fields.method || 'GET').toUpperCase();
  const headers = typeof fields.headers === 'object' && fields.headers !== null ? fields.headers : {};
  const body = fields.body && method !== 'GET' ? JSON.stringify(fields.body) : undefined;

  const response = await fetch(snapshotUrl, {
    method,
    headers,
    body,
  });

  if (!response.ok) {
    throw new Error(`Snapshot fetch failed with ${response.status}`);
  }

  return response.json();
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

function toNumberOrNull(value) {
  if (value === '' || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toIntegerOrNull(value) {
  if (value === '' || value == null) return null;
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : null;
}

function formatOrganizationSettings(item, organizationId, rollups = null) {
  return {
    organizationId,
    monthlyExpenseTarget: item?.monthly_expense_target == null ? null : Number(item.monthly_expense_target),
    profitPercentGoal: item?.profit_percent_goal == null ? null : Number(item.profit_percent_goal),
    opportunityCount: item?.opportunity_count == null ? null : Number(item.opportunity_count),
    salesToday: item?.sales_today == null ? Number(rollups?.salesToday ?? 0) : Number(item.sales_today),
    salesMonth: item?.sales_month == null ? Number(rollups?.salesMonth ?? 0) : Number(item.sales_month),
    salesYear: item?.sales_year == null ? Number(rollups?.monthScheduledProduction ?? 0) : Number(item.sales_year),
    updatedAt: item?.updated_at || null,
  };
}

function formatWeekHistory(rows = [], overrides = []) {
  const overrideMap = new Map(
    (overrides || []).map((item) => [`${item.week_start_date}:${item.metric_key}`, Number(item.metric_value)])
  );

  return rows.map((row) => ({
    weekStartDate: row.week_start_date,
    weekEndDate: row.week_end_date,
    range: formatRange(row.week_start_date, row.week_end_date),
    scheduledProduction: Number(row.scheduled_production || 0),
    approvedSales: Number(row.approved_sales || 0),
    realizedSales3Weeks: overrideMap.get(`${row.week_start_date}:realizedSales3Weeks`) ?? 0,
    capturedSales6Weeks: overrideMap.get(`${row.week_start_date}:capturedSales6Weeks`) ?? 0,
    scheduledProductionSnapshot: overrideMap.get(`${row.week_start_date}:scheduledProductionSnapshot`) ?? null,
    approvedSalesSnapshot: overrideMap.get(`${row.week_start_date}:approvedSalesSnapshot`) ?? null,
    weeklyBreakEvenSnapshot: overrideMap.get(`${row.week_start_date}:weeklyBreakEvenSnapshot`) ?? null,
  }));
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

      if (req.method === 'POST' && pathname === '/api/auth/magic-link') {
        const body = await readJsonBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        if (!email) {
          return sendJson(res, 400, { error: 'Email is required' });
        }

        const approvedUser = await getUserByEmail(email);
        if (!approvedUser) {
          return sendJson(res, 404, { error: 'No approved user found for that email' });
        }

        const redirectTo = `${getRequestOrigin(req)}/dashboard.html`;
        const link = await generateMagicLink(email, redirectTo);
        return sendJson(res, 200, {
          ok: true,
          actionLink: link.action_link,
          redirectTo,
        });
      }

      if (req.method === 'POST' && pathname === '/api/auth/recovery-link') {
        const body = await readJsonBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        if (!email) {
          return sendJson(res, 400, { error: 'Email is required' });
        }

        const approvedUser = await getUserByEmail(email);
        if (!approvedUser) {
          return sendJson(res, 404, { error: 'No approved user found for that email' });
        }

        const redirectTo = getSafeRedirectTo(req, body.redirectTo, '/reset-password.html');
        const link = await generateRecoveryLink(email, redirectTo);
        return sendJson(res, 200, {
          ok: true,
          actionLink: link.action_link,
          redirectTo,
        });
      }

      if (req.method === 'POST' && pathname === '/api/auth/set-password') {
        const body = await readJsonBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!email) {
          return sendJson(res, 400, { error: 'Email is required' });
        }
        if (password.length < 8) {
          return sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
        }

        const approvedUser = await getUserByEmail(email);
        if (!approvedUser) {
          return sendJson(res, 404, { error: 'No approved user found for that email' });
        }

        let authUserId = approvedUser.auth_user_id || null;
        if (authUserId) {
          await updateAuthUserPassword(authUserId, password);
        } else {
          const created = await createAuthUserWithPassword(email, password);
          authUserId = created?.user?.id || null;
          if (!authUserId) {
            return sendJson(res, 500, { error: 'Failed to create sign-in for that email.' });
          }
          await linkUserAuthIdentity(approvedUser.id, authUserId);
        }

        return sendJson(res, 200, {
          ok: true,
          message: 'Password saved. You can sign in now.',
        });
      }

      if (req.method === 'POST' && pathname === '/api/auth/logout') {
        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
          const token = authHeader.slice('Bearer '.length).trim();
          try {
            await revokeSession(token);
          } catch {
            // best-effort; return success so the client clears state regardless
          }
        }
        return sendJson(res, 200, { ok: true });
      }

      const context = await resolveContext(req);
      const adminViewOrganization = await getAdminViewOrganization(context, requestUrl.searchParams.get('org'));
      const viewContext = adminViewOrganization ? { ...context, organization: adminViewOrganization } : context;

      if (req.method === 'GET' && pathname === '/api/session') {
        return sendJson(res, 200, formatSession(viewContext));
      }
      if (req.method === 'GET' && pathname === '/api/dashboard') {
        const [crmConnection, weekMetrics, overrides, organizationSettings, latestSnapshot] = await Promise.all([
          getCrmConnectionByOrg(viewContext.organization.id),
          getWeekMetricsByOrg(viewContext.organization.id),
          getMetricOverridesByOrg(viewContext.organization.id),
          getOrganizationSettingsByOrg(viewContext.organization.id),
          getLatestCrmSnapshotByOrg(viewContext.organization.id),
        ]);
        const liveWeeks = buildWeeksFromMetrics(weekMetrics);
        const mergedWeeks = applyOverridesToWeeks(liveWeeks, overrides);
        const rollups = latestSnapshot?.payload?.rollups || null;
        return sendJson(res, 200, {
          organization: formatSession(viewContext).organization,
          settings: formatOrganizationSettings(organizationSettings, viewContext.organization.id, rollups),
          crmConnection: formatDashboardCrmConnection(crmConnection),
          weeks: mergedWeeks,
          weekHistory: formatWeekHistory(weekMetrics, overrides),
          overridesApplied: summarizeOverridesByWeek(mergedWeeks, overrides),
        });
      }
      if (req.method === 'GET' && pathname === '/api/account') {
        const settings = await getOrganizationSettingsByOrg(viewContext.organization.id);
        return sendJson(res, 200, {
          organization: formatSession(viewContext).organization,
          user: formatSession(viewContext).user,
          settings: formatOrganizationSettings(settings, viewContext.organization.id),
          billing: buildBillingSummary(req, context),
        });
      }
      if (req.method === 'POST' && pathname === '/api/billing/checkout-session') {
        const session = await createStripeCheckoutSession({ req, context });
        return sendJson(res, 200, { ok: true, ...session });
      }
      if (req.method === 'POST' && pathname === '/api/account') {
        const body = await readJsonBody(req);
        const existingSettings = await getOrganizationSettingsByOrg(context.organization.id);
        const saved = await upsertOrganizationSettings({
          organization_id: context.organization.id,
          monthly_expense_target: body.monthlyExpenseTarget === undefined
            ? existingSettings?.monthly_expense_target ?? null
            : toNumberOrNull(body.monthlyExpenseTarget),
          profit_percent_goal: body.profitPercentGoal === undefined
            ? existingSettings?.profit_percent_goal ?? null
            : toNumberOrNull(body.profitPercentGoal),
          opportunity_count: body.opportunityCount === undefined
            ? existingSettings?.opportunity_count ?? null
            : toIntegerOrNull(body.opportunityCount),
          sales_today: body.salesToday === undefined
            ? existingSettings?.sales_today ?? null
            : toNumberOrNull(body.salesToday),
          sales_month: body.salesMonth === undefined
            ? existingSettings?.sales_month ?? null
            : toNumberOrNull(body.salesMonth),
          sales_year: body.salesYear === undefined
            ? existingSettings?.sales_year ?? null
            : toNumberOrNull(body.salesYear),
          updated_by_user_id: context.user?.id || null,
          updated_at: new Date().toISOString(),
        });
        return sendJson(res, 200, {
          ok: true,
          message: 'Organization settings saved',
          settings: formatOrganizationSettings(saved?.[0] || null, context.organization.id),
        });
      }
      if (req.method === 'GET' && pathname === '/api/crm-connection') {
        const crmConnection = await getCrmConnectionByOrg(viewContext.organization.id);
        return sendJson(res, 200, formatCrmConnectionDetail(crmConnection));
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
        return sendJson(res, 200, {
          ok: true,
          message: credentialEnvelope.hasCredentials ? 'Housecall Pro connection saved. Go to the dashboard and click Refresh Data.' : 'CRM connection saved.',
          item: formatCrmConnectionDetail(saved?.[0] || null),
        });
      }
      if (req.method === 'POST' && pathname === '/api/crm-connection/hcp-helper') {
        const body = await readJsonBody(req);
        const cookies = Array.isArray(body.cookies) ? body.cookies : [];
        const cookieHeader = String(body.cookieHeader || '').trim();
        const sessionCookie = cookieHeader || cookies
          .filter((item) => item?.name && item?.value)
          .map((item) => `${item.name}=${item.value}`)
          .join('; ');

        if (!sessionCookie) {
          return sendJson(res, 400, { error: 'No Housecall Pro cookies were provided by the browser helper' });
        }

        const credentialEnvelope = buildCredentialEnvelope({
          provider: 'housecall_pro',
          authType: 'session_or_oauth',
          accountLabel: body.accountLabel || 'Primary Housecall Pro account',
          credentials: {
            sessionCookie,
            locationId: body.locationId || undefined,
            helperSource: 'hcp_chrome_extension',
            helperVersion: body.helperVersion || 1,
            helperCapturedAt: body.capturedAt || new Date().toISOString(),
            helperCookieNames: cookies.map((item) => item?.name).filter(Boolean),
          },
        }, context);

        const existing = await getCrmConnectionByOrg(context.organization.id);
        const saved = await upsertCrmConnection({
          id: existing?.id || '50000000-0000-0000-0000-000000000001',
          organization_id: context.organization.id,
          provider: 'housecall_pro',
          status: credentialEnvelope.hasCredentials ? 'connected' : 'pending',
          auth_type: 'session_or_oauth',
          encrypted_credentials: credentialEnvelope,
          last_sync_at: existing?.last_sync_at || new Date().toISOString(),
          last_error: null,
        });

        return sendJson(res, 200, {
          ok: true,
          message: 'Housecall Pro connection saved from Chrome helper. Go to the dashboard and click Refresh Data.',
          item: formatCrmConnectionDetail(saved?.[0] || null),
        });
      }
      if (req.method === 'POST' && pathname === '/api/crm-connection/disconnect') {
        const existing = await getCrmConnectionByOrg(context.organization.id);
        const saved = await upsertCrmConnection({
          id: existing?.id || '50000000-0000-0000-0000-000000000001',
          organization_id: context.organization.id,
          provider: existing?.provider || 'housecall_pro',
          status: 'disconnected',
          auth_type: existing?.auth_type || 'session_or_oauth',
          encrypted_credentials: {
            version: 1,
            provider: existing?.provider || 'housecall_pro',
            authType: existing?.auth_type || 'session_or_oauth',
            accountLabel: existing?.encrypted_credentials?.accountLabel || null,
            savedAt: new Date().toISOString(),
            savedByUserId: context.user?.id || null,
            hasCredentials: false,
            fieldKeys: [],
            fields: {},
          },
          last_sync_at: existing?.last_sync_at || null,
          last_error: existing?.last_error || null,
        });
        return sendJson(res, 200, {
          ok: true,
          message: 'Housecall Pro disconnected. Your last synced numbers were kept.',
          item: formatCrmConnectionDetail(saved?.[0] || null),
        });
      }
      if (req.method === 'GET' && pathname === '/api/overrides') {
        const overrides = await getMetricOverridesByOrg(viewContext.organization.id);
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
        const rows = await getSyncRunsByOrg(viewContext.organization.id);
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
      if (req.method === 'POST' && pathname === '/api/sync-runs/execute') {
        const body = await readJsonBody(req);
        const crmConnection = await getCrmConnectionByOrg(context.organization.id);
        const startedAt = body.startedAt || new Date().toISOString();
        const organizationSettings = await getOrganizationSettingsByOrg(context.organization.id);
        const existingOverrides = await getMetricOverridesByOrg(context.organization.id);

        try {
          const fetchedSnapshot = body.snapshot ? null : await fetchSnapshotFromCrmConnection(crmConnection, context.organization.timezone || 'UTC');
          const snapshotInput = body.snapshot
            || fetchedSnapshot
            || crmConnection?.encrypted_credentials?.fields?.manualSnapshot
            || crmConnection?.encrypted_credentials?.fields?.snapshot
            || null;

          if (!snapshotInput) {
            throw new Error('No snapshot payload found to sync');
          }

          const normalizedWeeks = normalizeSnapshotPayload(snapshotInput);
          const snapshotRow = await insertCrmSnapshot({
            id: crypto.randomUUID(),
            organization_id: context.organization.id,
            crm_connection_id: crmConnection?.id || null,
            provider: crmConnection?.provider || body.provider || 'manual_import',
            source_label: body.sourceLabel || 'manual sync snapshot',
            payload: snapshotInput,
            captured_by_user_id: context.user?.id || null,
          });

          const persistedMetrics = await upsertWeekMetrics(
            normalizedWeeks.map((item) => ({
              id: crypto.randomUUID(),
              organization_id: context.organization.id,
              week_start_date: item.week_start_date,
              week_end_date: item.week_end_date,
              scheduled_production: item.scheduled_production,
              approved_sales: item.approved_sales,
              completed_production: item.completed_production,
              opportunities: item.opportunities,
              source_confidence: item.source_confidence,
              source_version: item.source_version,
              updated_at: new Date().toISOString(),
            }))
          );

          const currentWeekStartDate = formatDateOnly(startOfUtcWeek(new Date()));
          const weeklyBreakEvenSnapshot = organizationSettings?.monthly_expense_target == null
            ? null
            : Number(organizationSettings.monthly_expense_target) / 4;
          const existingSnapshotKeys = new Set(
            (existingOverrides || [])
              .filter((item) => ['scheduledProductionSnapshot', 'approvedSalesSnapshot', 'weeklyBreakEvenSnapshot', 'realizedSales3Weeks', 'capturedSales6Weeks'].includes(item.metric_key))
              .map((item) => `${item.week_start_date}:${item.metric_key}`)
          );
          const rawWeeks = Array.isArray(snapshotInput?.weeks) ? snapshotInput.weeks : [];
          const rawWeekMap = new Map(rawWeeks.map((item) => [item.weekStartDate, item]));
          for (const item of normalizedWeeks) {
            const rawWeek = rawWeekMap.get(item.week_start_date) || {};
            const snapshotOverrides = [
              ['realizedSales3Weeks', Number(rawWeek.realizedSales3Weeks || 0), 'Computed realized sales within 3 weeks'],
              ['capturedSales6Weeks', Number(rawWeek.capturedSales6Weeks || 0), 'Computed captured sales within 6 weeks'],
            ];
            if (item.week_start_date < currentWeekStartDate) {
              snapshotOverrides.push(
                ['scheduledProductionSnapshot', Number(item.scheduled_production || 0), 'Locked past-week scheduled production snapshot'],
                ['approvedSalesSnapshot', Number(item.approved_sales || 0), 'Locked past-week approved sales snapshot'],
                ['weeklyBreakEvenSnapshot', weeklyBreakEvenSnapshot, 'Locked past-week break-even snapshot'],
              );
            }

            const filteredOverrides = snapshotOverrides.filter(([, value]) => value != null);

            for (const [metricKey, metricValue, reason] of filteredOverrides) {
              const snapshotKey = `${item.week_start_date}:${metricKey}`;
              if (existingSnapshotKeys.has(snapshotKey)) continue;
              await upsertMetricOverride({
                id: crypto.randomUUID(),
                organization_id: context.organization.id,
                week_start_date: item.week_start_date,
                metric_key: metricKey,
                metric_value: metricValue,
                reason,
                created_by_user_id: context.user?.id || null,
                updated_at: new Date().toISOString(),
              });
            }
          }

          const finishedAt = new Date().toISOString();
          const syncRun = await insertSyncRun({
            id: crypto.randomUUID(),
            organization_id: context.organization.id,
            crm_connection_id: crmConnection?.id || null,
            started_at: startedAt,
            finished_at: finishedAt,
            status: 'success',
            records_pulled: normalizedWeeks.length,
            error_message: null,
            raw_snapshot_path: `crm_snapshots:${snapshotRow?.[0]?.id || 'unknown'}`,
          });

          if (organizationSettings?.id || snapshotInput?.rollups?.salesToday != null || snapshotInput?.rollups?.salesMonth != null) {
            await upsertOrganizationSettings({
              organization_id: context.organization.id,
              monthly_expense_target: organizationSettings?.monthly_expense_target ?? null,
              profit_percent_goal: organizationSettings?.profit_percent_goal ?? null,
              opportunity_count: organizationSettings?.opportunity_count ?? null,
              sales_today: snapshotInput?.rollups?.salesToday ?? null,
              sales_month: snapshotInput?.rollups?.salesMonth ?? null,
              sales_year: snapshotInput?.rollups?.monthScheduledProduction ?? organizationSettings?.sales_year ?? null,
              updated_by_user_id: context.user?.id || null,
              updated_at: finishedAt,
            });
          }

          if (crmConnection?.id) {
            await upsertCrmConnection({
              id: crmConnection.id,
              organization_id: context.organization.id,
              provider: crmConnection.provider,
              status: 'connected',
              auth_type: crmConnection.auth_type,
              encrypted_credentials: crmConnection.encrypted_credentials,
              last_sync_at: finishedAt,
              last_error: null,
            });
          }

          return sendJson(res, 200, {
            ok: true,
            message: `Synced ${normalizedWeeks.length} week records`,
            syncRun: formatSyncRuns(syncRun || [])[0] || null,
            snapshotId: snapshotRow?.[0]?.id || null,
            metricsWritten: persistedMetrics?.length || 0,
          });
        } catch (error) {
          const finishedAt = new Date().toISOString();
          await insertSyncRun({
            id: crypto.randomUUID(),
            organization_id: context.organization.id,
            crm_connection_id: crmConnection?.id || null,
            started_at: startedAt,
            finished_at: finishedAt,
            status: 'failed',
            records_pulled: 0,
            error_message: error.message,
            raw_snapshot_path: null,
          });

          if (crmConnection?.id) {
            await upsertCrmConnection({
              id: crmConnection.id,
              organization_id: context.organization.id,
              provider: crmConnection.provider,
              status: crmConnection.status || 'connected',
              auth_type: crmConnection.auth_type,
              encrypted_credentials: crmConnection.encrypted_credentials,
              last_sync_at: crmConnection.last_sync_at,
              last_error: error.message,
            });
          }

          return sendJson(res, 500, { error: error.message });
        }
      }
      if (req.method === 'GET' && pathname === '/api/organizations/me') {
        return sendJson(res, 200, context.organization || {});
      }
      if (req.method === 'GET' && pathname === '/api/users/me') {
        return sendJson(res, 200, context.user || {});
      }
      if (req.method === 'GET' && pathname === '/api/admin/clients') {
        requireAdmin(context);
        const clients = await getAdminClientsOverview();
        return sendJson(res, 200, {
          ok: true,
          generatedAt: new Date().toISOString(),
          clients,
        });
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
