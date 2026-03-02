import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Must match the values in auth.ts
const EDITOR_TOKEN = 'bw-editor-v1';
const EDITOR_EMAIL = 'admin@bochiweb.com';

/**
 * Validates the Authorization header.
 * Accepts the hardcoded editor token or a Supabase JWT.
 * Returns the authenticated user, or sends a 401 and returns null.
 */
export async function validateAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Missing or invalid authorization header' });
    return null;
  }

  const token = authHeader.slice(7);

  // Accept the hardcoded editor token
  if (token === EDITOR_TOKEN) {
    return { id: 'editor', email: EDITOR_EMAIL };
  }

  // Fall back to Supabase token validation
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    res.status(500).json({ success: false, message: 'Server configuration error' });
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ success: false, message: 'Invalid or expired session' });
    return null;
  }

  return { id: data.user.id, email: data.user.email || '' };
}
