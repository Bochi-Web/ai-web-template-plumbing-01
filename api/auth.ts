import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ── Simple editor credentials ──
const EDITOR_EMAIL = 'admin@bochiweb.com';
const EDITOR_PASSWORD = 'BW-edit-2026';
const EDITOR_TOKEN = 'bw-editor-v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── GET: Validate an existing token ──
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing authorization header' });
    }

    const token = authHeader.slice(7);

    // Accept the hardcoded editor token
    if (token === EDITOR_TOKEN) {
      return res.status(200).json({ success: true, user: { email: EDITOR_EMAIL } });
    }

    // Fall back to Supabase token validation (for BWCC auto-login)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data.user) {
          return res.status(200).json({ success: true, user: { email: data.user.email } });
        }
      } catch {
        // Supabase validation failed — fall through
      }
    }

    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  // ── POST: Email/password sign-in ──
  if (req.method === 'POST') {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Check hardcoded editor credentials
    if (email === EDITOR_EMAIL && password === EDITOR_PASSWORD) {
      return res.status(200).json({
        success: true,
        token: EDITOR_TOKEN,
        user: { email: EDITOR_EMAIL },
      });
    }

    // Fall back to Supabase auth
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data.session) {
          return res.status(200).json({
            success: true,
            token: data.session.access_token,
            user: { email: data.user.email },
          });
        }
      } catch {
        // Supabase auth failed — fall through
      }
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
