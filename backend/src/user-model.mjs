import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Returns an approved and paid user by email.
 * @param {string} email
 * @returns {Promise<object|null>} user or null if not found
 */
export async function getUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', normalizedEmail)
    .eq('is_approved', true)
    .eq('paid', true)
    .limit(1)
    .single();

  if (error) {
    console.error('Supabase getUserByEmail error:', error);
    return null;
  }
  return data || null;
}

/**
 * Inserts a new user record.
 * @param {object} user
 * @returns {Promise<object|null>} inserted user or null
 */
export async function insertUser(user) {
  const { data, error } = await supabase.from('users').insert(user).single();
  if (error) {
    console.error('Supabase insertUser error:', error);
    return null;
  }
  return data;
}

/**
 * Updates user approval flags.
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object|null>} updated user or null
 */
export async function updateUserApproval(id, updates) {
  const { data, error } = await supabase.from('users').update(updates).eq('id', id).single();
  if (error) {
    console.error('Supabase updateUserApproval error:', error);
    return null;
  }
  return data;
}

/**
 * Mark the user with this email as approved/paid.
 * @param {string} email
 * @returns {Promise<object|null>} the updated user or null if not found
 */
export async function approveUserPayment(email) {
  const user = await getUserByEmail(email);
  if (!user) return null;

  // Assuming there is a field named 'is_approved' or 'paid' to mark payment.
  const updated = await updateUserApproval(user.id, { is_approved: true, paid: true });
  return updated;
}

/**
 * Create a new user record marked approved.
 * @param {string} email
 * @returns {Promise<object>} the created user
 */
export async function createUserWithApproval(email) {
  const id = crypto.randomUUID();
  // You can customize other fields as needed
  const user = {
    id,
    email,
    full_name: email.split('@')[0],
    is_approved: true,
    paid: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const inserted = await insertUser(user);
  return inserted;
}
