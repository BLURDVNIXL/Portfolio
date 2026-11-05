/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Daniel Adjiri Portfolio - Vercel Serverless Express API
 * Handles all /api/* routes seamlessly on Vercel and local development.
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

const app = express();

// dynamic secret or configured secret for HMAC-SHA256 signing
const SERVER_SECRET = process.env.ADMIN_SECRET || crypto.randomBytes(32).toString('hex');

// Resilient helper to locate data files across Vercel and local environments
function findDataFile(filename: string): string {
  const candidates = [
    path.join(process.cwd(), 'data', filename),
    path.join(process.cwd(), 'api', 'data', filename),
    path.resolve('data', filename),
    path.join('/var/task/data', filename),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return path.join(process.cwd(), 'data', filename);
}

const CREATIONS_FILE = findDataFile('creations.json');
const CONFIG_FILE = findDataFile('config.json');

// Upload directory (/tmp is writable in Vercel Serverless)
const UPLOADS_DIR = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(process.cwd(), 'public', 'uploads');

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch {}

// GitHub configuration for Vercel persistence
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'BLURDVNIXL/Portfolio';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// In-memory caches to prevent data loss within lambda warm instances
let inMemoryCreations: any[] | null = null;
let inMemoryConfig: any = null;

// ============================================
// SECURITY HEADERS & BODY PARSING
// ============================================
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Serve uploads if directory exists
try {
  app.use('/uploads', express.static(UPLOADS_DIR));
} catch {}

// ============================================
// STRICT MULTER UPLOAD WHITELIST
// ============================================
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'video/mp4',
  'video/webm',
  'application/pdf'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.mp3',
  '.wav',
  '.mp4',
  '.webm',
  '.pdf'
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '.bin';
    const cleanName = path
      .basename(file.originalname, rawExt)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e5);
    cb(null, `${cleanName}-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Format non autorisé (${file.mimetype}). Formats acceptés : JPG, PNG, WEBP, MP3, MP4, PDF.`));
    }
  }
});

// ============================================
// ASYNCHRONOUS I/O & PERSISTENCE
// ============================================
async function readJsonAsync<T>(filePath: string, fallback: T): Promise<T> {
  try {
    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
        return data;
      }
    }
    const backupPath = filePath.replace('.json', '.backup.json');
    if (fs.existsSync(backupPath)) {
      const backupContent = await fs.promises.readFile(backupPath, 'utf-8');
      const backupData = JSON.parse(backupContent);
      if (backupData) return backupData;
    }
  } catch (err) {
    console.error(`[Portfolio] Erreur lecture ${filePath}:`, err);
  }
  return fallback;
}

async function writeJsonAsync(filePath: string, data: any): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    const backupPath = filePath.replace('.json', '.backup.json');
    await fs.promises.writeFile(backupPath, content, 'utf-8');
  } catch (err) {
    console.warn(`[Portfolio] Écriture disque lecture-seule ou différée pour ${filePath}`);
  }

  // GitHub API Sync
  if (GITHUB_TOKEN && GITHUB_REPO) {
    syncToGitHub(filePath, content).catch((err) => {
      console.warn(`[Portfolio] Sync GitHub échouée pour ${filePath}:`, err?.message || err);
    });
  }
}

async function syncToGitHub(localFilePath: string, fileContent: string): Promise<void> {
  try {
    const relativePath = path.basename(localFilePath).includes('creations')
      ? 'data/creations.json'
      : 'data/config.json';
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${relativePath}`;

    let currentSha = '';
    const getRes = await fetch(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Daniel-Portfolio-CMS',
        Accept: 'application/vnd.github.v3+json'
      }
    });
    if (getRes.ok) {
      const body = (await getRes.json()) as { sha?: string };
      currentSha = body.sha || '';
    }

    const contentBase64 = Buffer.from(fileContent, 'utf-8').toString('base64');
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Daniel-Portfolio-CMS',
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `cms: update ${relativePath} [skip ci]`,
        content: contentBase64,
        branch: GITHUB_BRANCH,
        sha: currentSha || undefined
      })
    });
    if (putRes.ok) {
      console.log(`[Portfolio] Synchronisé avec succès sur GitHub : ${relativePath}`);
    }
  } catch (err: any) {
    console.warn('[Portfolio] Erreur synchronisation GitHub:', err.message);
  }
}

// ============================================
// CRYPTOGRAPHIC HMAC TOKENS & ANTI-BRUTE-FORCE
// ============================================
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

const loginAttempts = new Map<string, LoginAttempt>();

function checkRateLimit(ip: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { allowed: true };

  if (entry.lockedUntil && now < entry.lockedUntil) {
    const waitSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  if (now - entry.lastAttempt > 15 * 60 * 1000) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordLoginAttempt(ip: string, success: boolean) {
  const now = Date.now();
  if (success) {
    loginAttempts.delete(ip);
    return;
  }
  const entry = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
  entry.count += 1;
  entry.lastAttempt = now;
  if (entry.count >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000;
  }
  loginAttempts.set(ip, entry);
}

function generateToken(role = 'admin'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      role,
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [header, payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!data.exp || Date.now() > data.exp) {
      return false;
    }
    return data.role === 'admin';
  } catch {
    return false;
  }
}

function safeCompare(input: string, target: string): boolean {
  if (!input || !target) return false;
  const inputBuf = Buffer.from(input);
  const targetBuf = Buffer.from(target);
  if (inputBuf.length !== targetBuf.length) return false;
  return crypto.timingSafeEqual(inputBuf, targetBuf);
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (verifyToken(token)) {
    return next();
  }
  res.status(401).json({
    error: 'Session expirée ou non autorisée. Veuillez vous reconnecter au panel administrateur.'
  });
}

// ============================================
// MEDIA PREVIEW RESOLVER
// ============================================
export function resolveMediaInfo(url: string) {
  if (!url || typeof url !== 'string') {
    return { type: 'unknown', url: '' };
  }
  const trimmed = url.trim();

  // 1. Google Drive Link
  const driveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    return {
      type: 'drive',
      id: fileId,
      originalUrl: trimmed,
      directThumbnailUrl: `https://lh3.googleusercontent.com/d/${fileId}=w1200`,
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      streamUrl: `https://drive.google.com/uc?export=view&id=${fileId}`
    };
  }

  // 2. YouTube Link
  const ytMatch = trimmed.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  if (ytMatch && ytMatch[2] && ytMatch[2].length === 11) {
    const ytId = ytMatch[2];
    return {
      type: 'youtube',
      id: ytId,
      originalUrl: trimmed,
      directThumbnailUrl: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`
    };
  }

  // 3. Vimeo Link
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/);
  if (vimeoMatch && vimeoMatch[3]) {
    const vimeoId = vimeoMatch[3];
    return {
      type: 'vimeo',
      id: vimeoId,
      originalUrl: trimmed,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`
    };
  }

  // 4. Direct Image / Video File
  const lower = trimmed.toLowerCase();
  if (lower.match(/\.(jpg|jpeg|png|webp|gif|svg)$/)) {
    return {
      type: 'image',
      originalUrl: trimmed,
      directThumbnailUrl: trimmed
    };
  }
  if (lower.match(/\.(mp4|webm|mov)$/)) {
    return {
      type: 'video',
      originalUrl: trimmed,
      embedUrl: trimmed
    };
  }

  return {
    type: 'generic',
    originalUrl: trimmed
  };
}

// ============================================
// API ROUTER (MOUNTED ON BOTH /api AND /)
// ============================================
const apiRouter = express.Router();

// Health check
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'Daniel Adjiri Portfolio API', timestamp: new Date().toISOString() });
});

// 1. Admin Login
apiRouter.post('/admin/login', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: `Trop de tentatives infructueuses. Veuillez patienter ${rateLimit.waitSeconds} secondes avant de réessayer.`
    });
  }

  const { passcode } = req.body;
  if (!passcode || typeof passcode !== 'string') {
    recordLoginAttempt(ip, false);
    return res.status(400).json({ error: 'Code d’accès requis.' });
  }

  const config = inMemoryConfig || (await readJsonAsync(CONFIG_FILE, { adminPasscode: 'daniel2026' }));
  const configuredPasscode = process.env.ADMIN_PASSCODE || config.adminPasscode || 'daniel2026';

  const isValid = safeCompare(passcode.trim(), configuredPasscode.trim());
  if (isValid) {
    recordLoginAttempt(ip, true);
    const token = generateToken('admin');
    return res.json({ success: true, token });
  }

  recordLoginAttempt(ip, false);
  return res.status(401).json({ error: 'Code d’accès incorrect.' });
});

// 2. Media Preview
apiRouter.post('/media/preview', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL requise' });
  }
  const preview = resolveMediaInfo(url);
  res.json({ success: true, preview });
});

// 3. Get Creations (Public)
apiRouter.get('/creations', async (_req, res) => {
  if (inMemoryCreations) {
    return res.json(inMemoryCreations);
  }
  const creations = await readJsonAsync<any[]>(CREATIONS_FILE, []);
  inMemoryCreations = creations;
  res.json(creations);
});

// 4. Add Creation (Admin only)
apiRouter.post('/creations', requireAdmin, async (req, res) => {
  const creations = inMemoryCreations || (await readJsonAsync<any[]>(CREATIONS_FILE, []));
  const newCreation = {
    ...req.body,
    id: req.body.id || 'project-' + Date.now(),
    createdAt: new Date().toISOString()
  };
  creations.unshift(newCreation);
  inMemoryCreations = creations;
  await writeJsonAsync(CREATIONS_FILE, creations);
  res.json({ success: true, creation: newCreation });
});

// 5. Update Creation (Admin only)
apiRouter.put('/creations/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const creations = inMemoryCreations || (await readJsonAsync<any[]>(CREATIONS_FILE, []));
  const index = creations.findIndex((c: any) => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Projet introuvable' });
  }
  creations[index] = { ...creations[index], ...req.body, updatedAt: new Date().toISOString() };
  inMemoryCreations = creations;
  await writeJsonAsync(CREATIONS_FILE, creations);
  res.json({ success: true, creation: creations[index] });
});

// 6. Delete Creation (Admin only)
apiRouter.delete('/creations/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  let creations = inMemoryCreations || (await readJsonAsync<any[]>(CREATIONS_FILE, []));
  creations = creations.filter((c: any) => c.id !== id);
  inMemoryCreations = creations;
  await writeJsonAsync(CREATIONS_FILE, creations);
  res.json({ success: true });
});

// 7. Bulk Import Creations (Admin only)
apiRouter.post('/creations/import', requireAdmin, async (req, res) => {
  const { creations } = req.body;
  if (!Array.isArray(creations)) {
    return res.status(400).json({ error: 'Format JSON invalide. Un tableau de projets est requis.' });
  }
  inMemoryCreations = creations;
  await writeJsonAsync(CREATIONS_FILE, creations);
  res.json({ success: true, count: creations.length });
});

// 8. Get Config (Public)
apiRouter.get('/config', async (_req, res) => {
  const config = inMemoryConfig || (await readJsonAsync<any>(CONFIG_FILE, {}));
  inMemoryConfig = config;
  const { adminPasscode, ...safeConfig } = config;
  res.json(safeConfig);
});

// 9. Update Config (Admin only)
apiRouter.put('/config', requireAdmin, async (req, res) => {
  const currentConfig = inMemoryConfig || (await readJsonAsync<any>(CONFIG_FILE, {}));
  const updatedConfig: any = {
    ...currentConfig,
    ...req.body,
    profile: req.body.profile ? { ...(currentConfig.profile || {}), ...req.body.profile } : currentConfig.profile,
    audio: req.body.audio ? { ...(currentConfig.audio || {}), ...req.body.audio } : currentConfig.audio,
    cv: req.body.cv ? { ...(currentConfig.cv || {}), ...req.body.cv } : currentConfig.cv
  };
  if (req.body.newPasscode && typeof req.body.newPasscode === 'string') {
    updatedConfig.adminPasscode = req.body.newPasscode.trim();
  }
  delete updatedConfig.newPasscode;
  inMemoryConfig = updatedConfig;
  await writeJsonAsync(CONFIG_FILE, updatedConfig);
  res.json({ success: true, config: updatedConfig });
});

// 10. Upload Media (Admin only)
apiRouter.post('/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu ou format refusé.' });
  }
  const publicUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    url: publicUrl,
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype
  });
});

// Error handling
apiRouter.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Portfolio] Erreur serveur:', err.message);
  res.status(400).json({ error: err.message || 'Une erreur est survenue lors du traitement.' });
});

// MOUNT ROUTER:
// Mount on '/api' AND on '/' so requests match whether or not Vercel rewrites the prefix
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Export Express app as default handler for Vercel Serverless
export default app;
