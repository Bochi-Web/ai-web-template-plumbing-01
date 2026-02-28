import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateAuth } from './_auth.js';

/**
 * /api/revisions
 *
 * GET  — List commit history from GitHub (optionally filtered by file path)
 * POST — Restore file(s) from a specific commit SHA
 */

// ── Environment variables ──

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

// ── GitHub API helper ──

async function ghApi(path: string, options: RequestInit = {}): Promise<any> {
  const token = getEnv('GITHUB_TOKEN');
  const owner = getEnv('GITHUB_OWNER');
  const repo = getEnv('GITHUB_REPO');

  const url = `https://api.github.com/repos/${owner}/${repo}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error (${response.status}) on ${path}: ${errorText}`);
  }

  return response.json();
}

async function fetchFileAtSha(filePath: string, sha: string): Promise<string> {
  const token = getEnv('GITHUB_TOKEN');
  const owner = getEnv('GITHUB_OWNER');
  const repo = getEnv('GITHUB_REPO');

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${sha}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3.raw',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} fetching ${filePath} at ${sha}`);
  }

  return response.text();
}

// ── CORS ──

const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'https://bwcc.bochiweb.com',
  'https://bw-command-center.vercel.app',
  'https://command.bochi-web.com',
];

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Handler ──

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── GET: List commit history ──
  if (req.method === 'GET') {
    const user = await validateAuth(req, res);
    if (!user) return;

    try {
      const file = req.query.file as string | undefined;
      const perPage = parseInt(req.query.per_page as string) || 50;

      let path = `/commits?per_page=${perPage}`;
      if (file) {
        path += `&path=${encodeURIComponent(file)}`;
      }

      const commits = await ghApi(path);

      const revisions = commits.map((c: any) => ({
        sha: c.sha,
        message: c.commit.message,
        date: c.commit.author.date,
        author: c.commit.author.name,
      }));

      return res.status(200).json({ success: true, revisions });
    } catch (error: any) {
      console.error('Revisions GET error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch revisions',
      });
    }
  }

  // ── POST: Restore files from a specific commit ──
  if (req.method === 'POST') {
    const user = await validateAuth(req, res);
    if (!user) return;

    try {
      const { sha } = req.body || {};

      if (!sha) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: sha',
        });
      }

      // 1. Get the commit details to find changed files
      const commitDetail = await ghApi(`/commits/${sha}`);
      const changedFiles = (commitDetail.files || [])
        .filter((f: any) => f.status !== 'removed')
        .map((f: any) => f.filename);

      if (changedFiles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files found in this commit to restore',
        });
      }

      // 2. Fetch file contents at that SHA
      const fileContents: { path: string; content: string }[] = [];
      for (const filePath of changedFiles) {
        const content = await fetchFileAtSha(filePath, sha);
        fileContents.push({ path: filePath, content });
      }

      // 3. Create a new commit using Git Trees API (same as publish.ts)
      const refData = await ghApi('/git/ref/heads/main');
      const currentCommitSha = refData.object.sha;

      const currentCommit = await ghApi(`/git/commits/${currentCommitSha}`);
      const currentTreeSha = currentCommit.tree.sha;

      const tree = fileContents.map((f) => ({
        path: f.path,
        mode: '100644' as const,
        type: 'blob' as const,
        content: f.content,
      }));

      const newTree = await ghApi('/git/trees', {
        method: 'POST',
        body: JSON.stringify({
          base_tree: currentTreeSha,
          tree,
        }),
      });

      const commitMessage = `Restore: ${changedFiles.length} file${changedFiles.length !== 1 ? 's' : ''} to revision ${sha.slice(0, 7)} [via Bochi Web Editor]`;

      const newCommit = await ghApi('/git/commits', {
        method: 'POST',
        body: JSON.stringify({
          message: commitMessage,
          tree: newTree.sha,
          parents: [currentCommitSha],
        }),
      });

      await ghApi('/git/refs/heads/main', {
        method: 'PATCH',
        body: JSON.stringify({
          sha: newCommit.sha,
        }),
      });

      return res.status(200).json({
        success: true,
        commitSha: newCommit.sha,
        commitUrl: newCommit.html_url,
        message: `Restored ${changedFiles.length} file${changedFiles.length !== 1 ? 's' : ''} to revision ${sha.slice(0, 7)}`,
      });
    } catch (error: any) {
      console.error('Revisions POST error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to restore revision',
      });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
