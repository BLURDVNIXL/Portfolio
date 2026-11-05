/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Daniel Adjiri Portfolio - Local Dev & Standalone Server
 * Imports the unified API from api/index.ts and starts local development with Vite.
 */

import app from './api/index.js';
import path from 'path';
import express from 'express';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
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

// Only start the standalone listener if NOT running in Vercel Serverless
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('[Portfolio Server] Erreur démarrage serveur:', err);
    process.exit(1);
  });
}

export default app;
