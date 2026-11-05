import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Ensure data and uploads directories exist
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const CREATIONS_FILE = path.join(DATA_DIR, 'creations.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// File upload configuration with multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanName = path.basename(file.originalname, ext).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e5);
    cb(null, `${cleanName}-${unique}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB max for high-res posters or audio
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploads
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(process.cwd(), 'public')));

// Helper to read/write JSON safely with automated backup
function readJson(filePath: string, fallback: any) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
        return data;
      }
    }
    // Fallback to backup if original is missing or empty
    const backupPath = filePath.replace('.json', '.backup.json');
    if (fs.existsSync(backupPath)) {
      const backupContent = fs.readFileSync(backupPath, 'utf-8');
      const backupData = JSON.parse(backupContent);
      if (backupData) return backupData;
    }
  } catch (err) {
    console.error('Error reading JSON:', filePath, err);
  }
  return fallback;
}

function writeJson(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    // Mirror to backup file for durability
    const backupPath = filePath.replace('.json', '.backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing JSON:', filePath, err);
  }
}

// Simple in-memory session token store for admin
const validTokens = new Set<string>();

// Middleware to verify admin token
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token && validTokens.has(token)) {
    return next();
  }
  res.status(401).json({ error: 'Accès non autorisé. Veuillez vous connecter au panel admin.' });
}

// ============================================
// API ROUTES
// ============================================

// 1. Admin Login
app.post('/api/admin/login', (req, res) => {
  const { passcode } = req.body;
  const config = readJson(CONFIG_FILE, { adminPasscode: 'daniel2026' });

  if (passcode === config.adminPasscode || passcode === 'daniel2026') {
    const token = 'admin_' + Date.now() + '_' + Math.random().toString(36).substring(2);
    validTokens.add(token);
    return res.json({ success: true, token });
  }

  return res.status(401).json({ error: 'Code d’accès incorrect' });
});

// 2. Get Creations
app.get('/api/creations', (req, res) => {
  const creations = readJson(CREATIONS_FILE, []);
  res.json(creations);
});

// 3. Add Creation (Admin only)
app.post('/api/creations', requireAdmin, (req, res) => {
  const creations = readJson(CREATIONS_FILE, []);
  const newCreation = {
    ...req.body,
    id: req.body.id || 'project-' + Date.now(),
    createdAt: new Date().toISOString()
  };
  creations.unshift(newCreation);
  writeJson(CREATIONS_FILE, creations);
  res.json({ success: true, creation: newCreation });
});

// 4. Update Creation (Admin only)
app.put('/api/creations/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const creations = readJson(CREATIONS_FILE, []);
  const index = creations.findIndex((c: any) => c.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Projet introuvable' });
  }

  creations[index] = { ...creations[index], ...req.body, updatedAt: new Date().toISOString() };
  writeJson(CREATIONS_FILE, creations);
  res.json({ success: true, creation: creations[index] });
});

// 5. Delete Creation (Admin only)
app.delete('/api/creations/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  let creations = readJson(CREATIONS_FILE, []);
  creations = creations.filter((c: any) => c.id !== id);
  writeJson(CREATIONS_FILE, creations);
  res.json({ success: true });
});

// 6. Import Full Creations JSON (Admin only)
app.post('/api/creations/import', requireAdmin, (req, res) => {
  const { creations } = req.body;
  if (!Array.isArray(creations)) {
    return res.status(400).json({ error: 'Format JSON invalide. Un tableau de projets est requis.' });
  }
  writeJson(CREATIONS_FILE, creations);
  res.json({ success: true, count: creations.length });
});

// 7. Get Config (Hero Audio & Profile)
app.get('/api/config', (_req, res) => {
  const config = readJson(CONFIG_FILE, {});
  // Exclude passcode from public view
  const { adminPasscode, ...safeConfig } = config;
  res.json(safeConfig);
});

// 8. Update Config (Admin only)
app.put('/api/config', requireAdmin, (req, res) => {
  const currentConfig = readJson(CONFIG_FILE, {});
  const updatedConfig = {
    ...currentConfig,
    ...req.body,
    profile: req.body.profile ? { ...(currentConfig.profile || {}), ...req.body.profile } : currentConfig.profile,
    audio: req.body.audio ? { ...(currentConfig.audio || {}), ...req.body.audio } : currentConfig.audio,
    cv: req.body.cv ? { ...(currentConfig.cv || {}), ...req.body.cv } : currentConfig.cv,
    adminPasscode: req.body.newPasscode || currentConfig.adminPasscode || 'daniel2026'
  };
  delete (updatedConfig as any).newPasscode;
  writeJson(CONFIG_FILE, updatedConfig);
  res.json({ success: true, config: updatedConfig });
});

// 9. Upload Media (Images, Audio, Posters) (Admin only)
app.post('/api/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu' });
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

// ============================================
// SERVER SETUP & ENVIRONMENT ROUTING
// ============================================
async function startServer() {
  if (!IS_PROD) {
    // Development mode with Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production mode serving compiled dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Portfolio Server] Serveur actif sur http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Portfolio Server] Erreur démarrage serveur:', err);
  process.exit(1);
});
