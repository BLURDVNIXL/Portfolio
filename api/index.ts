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
const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim();
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
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
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
// ASYNCHRONOUS I/O & PERSISTENCE (VERCEL /tmp + REALTIME GITHUB SYNC)
// ============================================
async function fetchFromGitHub(relativePath: string): Promise<any | null> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${relativePath}?ref=${GITHUB_BRANCH}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Daniel-Portfolio-CMS',
        Accept: 'application/vnd.github.v3.raw',
        'Cache-Control': 'no-cache'
      }
    });
    if (res.ok) {
      const text = await res.text();
      return JSON.parse(text);
    }
  } catch (err: any) {
    console.warn(`[Portfolio] Erreur fetch direct GitHub pour ${relativePath}:`, err?.message || err);
  }
  return null;
}

async function readJsonAsync<T>(filePath: string, fallback: T): Promise<T> {
  const baseName = path.basename(filePath);
  const tmpPath = path.join('/tmp', baseName);
  const isCreations = baseName.includes('creations');
  const isConfig = baseName.includes('config');

  // 1. In-memory cache for warm Lambdas
  if (isCreations && inMemoryCreations !== null) {
    return inMemoryCreations as unknown as T;
  }
  if (isConfig && inMemoryConfig !== null) {
    return inMemoryConfig as unknown as T;
  }

  // 2. /tmp cache
  try {
    if (fs.existsSync(tmpPath)) {
      const content = await fs.promises.readFile(tmpPath, 'utf-8');
      const data = JSON.parse(content);
      if (data !== undefined && data !== null) {
        if (isCreations) inMemoryCreations = data;
        if (isConfig) inMemoryConfig = data;
        return data;
      }
    }
  } catch (err) {
    console.warn(`[Portfolio] Erreur lecture /tmp/${baseName}:`, err);
  }

  // 3. Real-time GitHub read (guarantees cross-instance sync across all Vercel cold starts)
  const relativePath = isCreations ? 'data/creations.json' : 'data/config.json';
  const ghData = await fetchFromGitHub(relativePath);
  if (ghData !== null && ghData !== undefined) {
    if (isCreations) inMemoryCreations = ghData;
    if (isConfig) inMemoryConfig = ghData;
    try {
      await fs.promises.writeFile(tmpPath, JSON.stringify(ghData, null, 2), 'utf-8');
    } catch {}
    return ghData as T;
  }

  // 4. Bundled local data file (offline or local fallback)
  try {
    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (data !== undefined && data !== null) {
        if (isCreations) inMemoryCreations = data;
        if (isConfig) inMemoryConfig = data;
        return data;
      }
    }
    const backupPath = filePath.replace('.json', '.backup.json');
    if (fs.existsSync(backupPath)) {
      const backupContent = await fs.promises.readFile(backupPath, 'utf-8');
      const backupData = JSON.parse(backupContent);
      if (backupData) {
        if (isCreations) inMemoryCreations = backupData;
        if (isConfig) inMemoryConfig = backupData;
        return backupData;
      }
    }
  } catch (err) {
    console.error(`[Portfolio] Erreur lecture ${filePath}:`, err);
  }

  return fallback;
}

async function writeJsonAsync(filePath: string, data: any): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  const baseName = path.basename(filePath);
  const tmpPath = path.join('/tmp', baseName);
  const isCreations = baseName.includes('creations');
  const isConfig = baseName.includes('config');

  if (isCreations) inMemoryCreations = data;
  if (isConfig) inMemoryConfig = data;

  // 1. Write to /tmp (always writable in Vercel Lambda & local environments)
  try {
    await fs.promises.writeFile(tmpPath, content, 'utf-8');
  } catch (err) {
    console.warn(`[Portfolio] Erreur écriture /tmp pour ${tmpPath}:`, err);
  }

  // 2. Write to project data path if writable
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    const backupPath = filePath.replace('.json', '.backup.json');
    await fs.promises.writeFile(backupPath, content, 'utf-8');
  } catch (err) {
    // Expected on Vercel read-only filesystem
  }

  // 3. AWAIT GitHub API Sync
  if (GITHUB_TOKEN && GITHUB_REPO) {
    try {
      await syncToGitHub(filePath, content);
    } catch (err: any) {
      console.warn(`[Portfolio] Sync GitHub échouée pour ${filePath}:`, err?.message || err);
    }
  }
}

async function syncToGitHub(localFilePath: string, fileContent: string): Promise<void> {
  try {
    const relativePath = path.basename(localFilePath).includes('creations')
      ? 'data/creations.json'
      : 'data/config.json';
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${relativePath}`;
    
    let currentSha = '';
    const getRes = await fetch(`${url}?ref=${GITHUB_BRANCH}&t=${Date.now()}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Daniel-Portfolio-CMS',
        Accept: 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache'
      }
    });

    if (getRes.ok) {
      const body = (await getRes.json()) as { sha?: string };
      currentSha = body.sha || '';
    }

    const contentBase64 = Buffer.from(fileContent, 'utf-8').toString('base64');
    let putRes = await fetch(url, {
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

    // Conflict handling (409): re-fetch fresh SHA and retry
    if (putRes.status === 409) {
      console.warn(`[Portfolio] SHA en conflit pour ${relativePath}, nouvelle tentative...`);
      const retryGet = await fetch(`${url}?ref=${GITHUB_BRANCH}&t=${Date.now()}`, {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'User-Agent': 'Daniel-Portfolio-CMS',
          Accept: 'application/vnd.github.v3+json',
          'Cache-Control': 'no-cache'
        }
      });
      if (retryGet.ok) {
        const retryBody = (await retryGet.json()) as { sha?: string };
        putRes = await fetch(url, {
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
            sha: retryBody.sha || undefined
          })
        });
      }
    }

    if (putRes.ok) {
      console.log(`[Portfolio] Synchronisé avec succès sur GitHub : ${relativePath}`);
    } else {
      const errText = await putRes.text();
      console.warn(`[Portfolio] Erreur API GitHub (${putRes.status}): ${errText}`);
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

function recordLoginAttempt(ip: string, success: boolean): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, lastAttempt: now };

  if (success) {
    loginAttempts.delete(ip);
    return;
  }

  entry.count += 1;
  entry.lastAttempt = now;

  if (entry.count >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000; // 15-minute lockout
  }

  loginAttempts.set(ip, entry);
}

function generateToken(role: string = 'admin'): string {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
  const payload = `${role}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;

    const [role, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (Date.now() > expiresAt) return false;
    if (role !== 'admin') return false;

    const expectedPayload = `${role}:${expiresAt}`;
    const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(expectedPayload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Accès non autorisé : Token manquant.' });
  }

  const token = authHeader.substring(7);
  if (!verifyToken(token)) {
    return res.status(403).json({ error: 'Session expirée ou invalide. Veuillez vous reconnecter.' });
  }

  next();
}

// ============================================
// MEDIA EMBED AND PREVIEW RESOLVER
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

  const configuredPasscode = (process.env.ADMIN_PASSCODE || '').trim();

  // Fail-closed security: If ADMIN_PASSCODE is not defined in environment, deny all login attempts
  if (!configuredPasscode) {
    recordLoginAttempt(ip, false);
    console.warn(`[Security] Connexion refusée : la variable d'environnement ADMIN_PASSCODE n'est pas définie.`);
    return res.status(401).json({
      error: "Accès non configuré : la variable ADMIN_PASSCODE doit être définie dans l'environnement du serveur (Vercel)."
    });
  }

  const isValid = safeCompare(passcode.trim(), configuredPasscode);
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

// 3. Get Creations (Public - No-Cache)
apiRouter.get('/creations', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const creations = await readJsonAsync<any[]>(CREATIONS_FILE, inMemoryCreations || []);
  inMemoryCreations = creations;
  res.json(creations);
});

// 4. Add Creation (Admin only)
apiRouter.post('/creations', requireAdmin, async (req, res) => {
  let creations = await readJsonAsync<any[]>(CREATIONS_FILE, inMemoryCreations || []);
  const media = req.body.youtubeUrl ? resolveMediaInfo(req.body.youtubeUrl) : null;
  const newCreation = {
    ...req.body,
    youtubeId: req.body.youtubeId || (media?.type === 'youtube' ? media.id : undefined),
    posterUrl: req.body.posterUrl || (media?.directThumbnailUrl ? media.directThumbnailUrl : undefined),
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
  let creations = await readJsonAsync<any[]>(CREATIONS_FILE, inMemoryCreations || []);
  const index = creations.findIndex((c: any) => String(c.id) === String(id));
  if (index === -1) {
    return res.status(404).json({ error: 'Projet introuvable' });
  }
  const media = req.body.youtubeUrl ? resolveMediaInfo(req.body.youtubeUrl) : null;
  creations[index] = {
    ...creations[index],
    ...req.body,
    youtubeId: req.body.youtubeId || (media?.type === 'youtube' ? media.id : creations[index].youtubeId),
    posterUrl: req.body.posterUrl || (media?.directThumbnailUrl ? media.directThumbnailUrl : creations[index].posterUrl),
    updatedAt: new Date().toISOString()
  };
  inMemoryCreations = creations;
  await writeJsonAsync(CREATIONS_FILE, creations);
  res.json({ success: true, creation: creations[index] });
});

// 6. Delete Creation (Admin only)
apiRouter.delete('/creations/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  let creations = await readJsonAsync<any[]>(CREATIONS_FILE, inMemoryCreations || []);
  const initialLen = creations.length;
  creations = creations.filter((c: any) => String(c.id) !== String(id));
  inMemoryCreations = creations;
  await writeJsonAsync(CREATIONS_FILE, creations);
  res.json({ success: true, deleted: id, count: creations.length, changed: initialLen !== creations.length });
});

// 6b. Delete All / Clear Creations (Admin only)
apiRouter.delete('/creations', requireAdmin, async (_req, res) => {
  inMemoryCreations = [];
  await writeJsonAsync(CREATIONS_FILE, []);
  res.json({ success: true, count: 0, message: 'Toutes les créations ont été supprimées.' });
});

apiRouter.post('/creations/clear', requireAdmin, async (_req, res) => {
  inMemoryCreations = [];
  await writeJsonAsync(CREATIONS_FILE, []);
  res.json({ success: true, count: 0, message: 'Toutes les créations ont été supprimées.' });
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

// 8. Get Config (Public - No-Cache)
apiRouter.get('/config', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const config = await readJsonAsync<any>(CONFIG_FILE, inMemoryConfig || {});
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
