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
