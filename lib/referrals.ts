import { supabase } from './supabase';
import type { Database } from './supabase';

type InvitationCode = Database['public']['Tables']['invitation_codes']['Row'];
type InvitationCodeInsert = Database['public']['Tables']['invitation_codes']['Insert'];

/**
 * Constants for invitation code generation
 * Format: WEGOOD + 6 random characters (a-z, A-Z, 0-9)
 * As per README.md requirements
 */
const CODE_PREFIX = 'WEGOOD';
const CODE_SUFFIX_LENGTH = 6;
const MAX_RETRY_ATTEMPTS = 10;

/**
 * Character set for random code generation
 * Includes lowercase (a-z), uppercase (A-Z), and digits (0-9)
 */
const CODE_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generates a random invitation code
 * Format: WEGOOD + 6 random characters from charset (a-z, A-Z, 0-9)
 * 
 * @returns A unique invitation code string
 * 
 * @example
 * generateInvitationCode() // Returns something like "WEGOODa3B9Xz"
 */
export function generateInvitationCode(): string {
  let suffix = '';
  
  // Generate 6 random characters from the charset
  for (let i = 0; i < CODE_SUFFIX_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CODE_CHARSET.length);
    suffix += CODE_CHARSET[randomIndex];
  }
  
  return `${CODE_PREFIX}${suffix}`;
}

/**
 * Creates an invitation code for a user in the database
 * Handles uniqueness conflicts by retrying with a new code
 * 
 * @param userId - The UUID of the user to create the invitation code for
 * @param supabaseClient - Optional Supabase client (defaults to imported client)
 * @returns The created invitation code record
 * @throws Error if unable to create a unique code after MAX_RETRY_ATTEMPTS
 * 
 * @example
 * const code = await createInvitationCode('user-uuid-here');
 * console.log(code.code); // "WEGOODa3B9Xz"
 */
export async function createInvitationCode(
  userId: string,
  supabaseClient = supabase
): Promise<InvitationCode> {
  if (!userId) {
    throw new Error('User ID is required to create an invitation code');
  }

  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < MAX_RETRY_ATTEMPTS) {
    try {
      // Generate a new code
      const code = generateInvitationCode();

      // Attempt to insert into database
      const insertData: InvitationCodeInsert = {
        user_id: userId,
        code: code,
        usage_count: 0,
        is_active: true,
      };

      const { data, error } = await supabaseClient
        .from('invitation_codes')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        // Check if it's a unique constraint violation (code already exists)
        if (error.code === '23505') {
          // Code already exists, try again with a new code
          attempts++;
          lastError = new Error(
            `Failed to create unique invitation code after ${attempts} attempts. Last error: ${error.message}`
          );
          continue;
        }
        
        // Other database errors should be thrown immediately
        throw error;
      }

      if (!data) {
        throw new Error('Failed to create invitation code: No data returned');
      }

      // Success! Return the created code
      return data;
    } catch (error: any) {
      // If it's not a uniqueness error, throw immediately
      if (error.code !== '23505') {
        throw error;
      }
      
      attempts++;
      lastError = error;
    }
  }

  // If we've exhausted all retry attempts, throw an error
  throw new Error(
    `Unable to create a unique invitation code after ${MAX_RETRY_ATTEMPTS} attempts. Please try again later.`
  );
}

/**
 * Fetches the invitation code for a user from the database
 * Returns null if the user has no invitation code
 * 
 * @param userId - The UUID of the user to fetch the invitation code for
 * @param supabaseClient - Optional Supabase client (defaults to imported client)
 * @returns The invitation code record if found, or null if the user has no code
 * @throws Error for database errors other than "no rows found"
 * 
 * @example
 * const code = await fetchInvitationCode('user-uuid-here');
 * if (code) {
 *   console.log(code.code); // "WEGOODa3B9Xz"
 * } else {
 *   console.log('User has no invitation code');
 * }
 */
export async function fetchInvitationCode(
  userId: string,
  supabaseClient = supabase
): Promise<InvitationCode | null> {
  if (!userId) {
    throw new Error('User ID is required to fetch an invitation code');
  }

  try {
    const { data, error } = await supabaseClient
      .from('invitation_codes')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Handle "no rows found" error gracefully (PGRST116)
    if (error) {
      if (error.code === 'PGRST116') {
        // No invitation code found for this user - this is expected, return null
        return null;
      }
      // Other database errors should be thrown
      throw error;
    }

    // Return the code if found, or null if not found
    return data || null;
  } catch (error: any) {
    // Re-throw if it's not a "no rows found" error
    if (error.code !== 'PGRST116') {
      throw error;
    }
    // Return null for "no rows found" errors
    return null;
  }
}

