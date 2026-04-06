import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env.local');

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

export function getSupabaseEnv() {
  return parseEnvFile(envPath);
}

async function supabaseRequest(pathname, { method = 'GET', body, headers = {} } = {}) {
  const env = getSupabaseEnv();
  const res = await fetch(`${env.SUPABASE_URL}${pathname}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Supabase request failed: ${res.status} ${res.statusText}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function probeSupabaseWithServiceRole() {
  const env = getSupabaseEnv();
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
  };
}

export async function getUserByEmail(email) {
  const rows = await supabaseRequest(`/rest/v1/users?select=*&email=eq.${encodeURIComponent(email)}&limit=1`);
  return rows[0] || null;
}

export async function getOrganizationById(id) {
  const rows = await supabaseRequest(`/rest/v1/organizations?select=*&id=eq.${id}&limit=1`);
  return rows[0] || null;
}

export async function getWeekMetricsByOrg(organizationId) {
  return supabaseRequest(`/rest/v1/week_metrics?select=*&organization_id=eq.${organizationId}&order=week_start_date.asc`);
}

export async function getMetricOverridesByOrg(organizationId) {
  return supabaseRequest(`/rest/v1/metric_overrides?select=*&organization_id=eq.${organizationId}&order=week_start_date.asc`);
}

export async function upsertMetricOverride(payload) {
  return supabaseRequest('/rest/v1/metric_overrides?on_conflict=organization_id,week_start_date,metric_key', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: payload,
  });
}

export async function getCrmConnectionByOrg(organizationId) {
  const rows = await supabaseRequest(`/rest/v1/crm_connections?select=*&organization_id=eq.${organizationId}&order=created_at.asc&limit=1`);
  return rows[0] || null;
}

export async function upsertCrmConnection(payload) {
  return supabaseRequest('/rest/v1/crm_connections?on_conflict=id', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: payload,
  });
}

export async function getSyncRunsByOrg(organizationId) {
  return supabaseRequest(`/rest/v1/sync_runs?select=*&organization_id=eq.${organizationId}&order=started_at.desc`);
}

export async function insertSyncRun(payload) {
  return supabaseRequest('/rest/v1/sync_runs', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: payload,
  });
}
