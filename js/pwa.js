// PWA Service Worker Registration & Offline support
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        // SW registration successful
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Une mise à jour est disponible.');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[PWA] Échec enregistrement Service Worker:', err);
      });
  });
}

// Online/Offline detection indicator
window.addEventListener('offline', () => {
  const toast = document.createElement('div');
  toast.id = 'offline-toast';
  toast.setAttribute('role', 'status');
  toast.textContent = 'Mode hors ligne actif — contenu mis en cache disponible';
  toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1f221e;color:#f5efe2;padding:10px 18px;border-radius:99px;font-size:12px;z-index:99999;box-shadow:0 10px 30px rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.15);transition:opacity 0.4s;';
  document.body.appendChild(toast);
});

window.addEventListener('online', () => {
  const toast = document.getElementById('offline-toast');
  if (toast) {
    toast.textContent = 'Connexion rétablie';
    toast.style.background = '#1b3823';
    setTimeout(() => toast.remove(), 2500);
  }
});
