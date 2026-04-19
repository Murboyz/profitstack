import { getUserByEmail, insertUser, updateUserApproval } from './user-model.mjs';
import crypto from 'crypto';

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
