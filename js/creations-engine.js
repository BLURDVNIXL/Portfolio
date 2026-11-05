/**
 * Creations Engine & Universal Lightbox
 * ADJIRI N’DA ÉLIE DANIEL (@BLURDVNIXL)
 * - Synchronisation dynamique des créations en temps réel depuis l'API et le LocalStorage
 * - Gestion du lecteur lightbox YouTube flottant
 * - Zoom plein écran des affiches
 * - Modal détaillée des applications et projets
 */

export function extractYouTubeId(url) {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : url;
}

export function extractGoogleDriveId(url) {
  if (!url || typeof url !== 'string') return '';
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match && match[1] ? match[1] : '';
}

export function resolveMediaPreview(url, fallbackThumb = '') {
  if (!url) return { type: 'none', thumb: fallbackThumb, embed: '' };
  
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return {
      type: 'drive',
      id: driveId,
      thumb: `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`,
      embed: `https://drive.google.com/file/d/${driveId}/preview`,
      isDrive: true
    };
  }

  const ytId = extractYouTubeId(url);
  if (ytId && ytId.length === 11) {
    return {
      type: 'youtube',
      id: ytId,
      thumb: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
      embed: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`,
      isYouTube: true
    };
  }

  return {
    type: 'direct',
    thumb: url,
    embed: url
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderVideoCard(item) {
  const rawVideo = item.videoUrl || item.youtubeUrl || item.youtubeId || '';
  const videoRes = resolveMediaPreview(rawVideo);
  const thumb = item.posterUrl || videoRes.thumb || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80';
  const ytId = videoRes.isYouTube ? videoRes.id : '';
  const driveId = videoRes.isDrive ? videoRes.id : '';
  const tools = (item.tools || item.stack || []).map(t => `<span>${escapeHtml(t)}</span>`).join('');

  return `
    <article class="project-card-unique" data-id="${item.id}">
      <div class="card-media-box" data-action="play" data-yt="${ytId}" data-drive="${driveId}" data-id="${item.id}" title="Visionner '${escapeHtml(item.title)}'">
        <img src="${thumb}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='/icons/icon.svg'" />
        <div class="media-play-overlay">
          <div class="play-circle-btn" aria-label="Lire la vidéo">
            <svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          </div>
        </div>
        <span class="media-chip-category" style="color:#ff2a5f;">Vidéo</span>
        ${item.duration ? `<span class="media-chip-duration">${escapeHtml(item.duration)}</span>` : ''}
      </div>
      <div class="card-content">
        <div class="card-meta-row">
          <span class="card-client">${escapeHtml(item.client || 'Projet')}</span>
          <span class="card-year">${escapeHtml(item.year || '2026')}</span>
        </div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-desc">${escapeHtml(item.description || '')}</p>
        <div class="card-tools-row">
          ${tools}
        </div>
        <div class="card-actions-row">
          <button type="button" class="btn-card-action btn-primary btn-play-trigger" data-yt="${ytId}" data-drive="${driveId}" data-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
            <span>Visionner</span>
          </button>
          ${item.youtubeUrl ? `
            <a href="${item.youtubeUrl}" target="_blank" rel="noopener" class="btn-card-action btn-secondary">
              <span>${videoRes.isDrive ? 'Google Drive ↗' : 'YouTube ↗'}</span>
            </a>
          ` : ''}
        </div>
      </div>
    </article>
  `;
}

function renderPosterCard(item) {
  const posterRes = resolveMediaPreview(item.imageUrl || item.posterUrl || '');
  const img = posterRes.thumb || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80';
  const tools = (item.tools || item.stack || []).map(t => `<span>${escapeHtml(t)}</span>`).join('');

  return `
    <article class="project-card-unique" data-id="${item.id}">
      <div class="card-media-box" data-action="zoom" data-img="${img}" data-id="${item.id}" title="Zoomer '${escapeHtml(item.title)}'">
        <img src="${img}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='/icons/icon.svg'" />
        <div class="media-zoom-overlay">
          <div class="zoom-circle-btn" aria-label="Agrandir l'affiche">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </div>
        </div>
        <span class="media-chip-category" style="color:#8e38ff;">Affiche</span>
        ${item.format ? `<span class="media-chip-duration">${escapeHtml(item.format)}</span>` : ''}
      </div>
      <div class="card-content">
        <div class="card-meta-row">
          <span class="card-client">${escapeHtml(item.client || 'Projet')}</span>
          <span class="card-year">${escapeHtml(item.year || '2026')}</span>
        </div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-desc">${escapeHtml(item.description || '')}</p>
        <div class="card-tools-row">
          ${tools}
        </div>
        <div class="card-actions-row">
          <button type="button" class="btn-card-action btn-primary btn-zoom-trigger" data-img="${img}" data-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            <span>Zoomer HD</span>
          </button>
          <a href="${img}" target="_blank" rel="noopener" class="btn-card-action btn-secondary">
            <span>Fichier HD ↗</span>
          </a>
        </div>
      </div>
    </article>
  `;
}

function renderDemoCard(item) {
  const demoRes = resolveMediaPreview(item.demoPhotoUrl || item.imageUrl || item.posterUrl || '');
  const photo = demoRes.thumb || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80';
  const tools = (item.tools || item.stack || []).map(t => `<span>${escapeHtml(t)}</span>`).join('');

  return `
    <article class="project-card-unique" data-id="${item.id}">
      <div class="card-media-box" data-action="app" data-id="${item.id}" title="Découvrir '${escapeHtml(item.title)}'">
        <img src="${photo}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='/icons/icon.svg'" />
        <div class="media-zoom-overlay">
          <div class="zoom-circle-btn" aria-label="Voir les détails">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </div>
        </div>
        <span class="media-chip-category" style="color:#286aff;">Application</span>
      </div>
      <div class="card-content">
        <div class="card-meta-row">
          <span class="card-client">${escapeHtml(item.client || 'Projet')}</span>
          <span class="card-year">${escapeHtml(item.year || '2026')}</span>
        </div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-desc">${escapeHtml(item.description || '')}</p>
        <div class="card-tools-row">
          ${tools}
        </div>
        <div class="card-actions-row">
          <button type="button" class="btn-card-action btn-primary btn-app-trigger" data-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            <span>Détails &amp; Démo</span>
          </button>
          ${item.githubUrl ? `
            <a href="${item.githubUrl}" target="_blank" rel="noopener" class="btn-card-action btn-secondary">
              <span>GitHub ↗</span>
            </a>
          ` : ''}
        </div>
      </div>
    </article>
  `;
}

function renderAutresCard(item) {
  const photo = item.demoPhotoUrl || item.imageUrl || item.posterUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80';
  const tools = (item.tools || item.stack || []).map(t => `<span>${escapeHtml(t)}</span>`).join('');

  return `
    <article class="project-card-unique" data-id="${item.id}">
      <div class="card-media-box" data-action="app" data-id="${item.id}" title="Découvrir '${escapeHtml(item.title)}'">
        <img src="${photo}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='/icons/icon.svg'" />
        <div class="media-zoom-overlay">
          <div class="zoom-circle-btn" aria-label="Voir les détails">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </div>
        </div>
        <span class="media-chip-category" style="color:#f5f2eb;">Système</span>
      </div>
      <div class="card-content">
        <div class="card-meta-row">
          <span class="card-client">${escapeHtml(item.client || 'Projet')}</span>
          <span class="card-year">${escapeHtml(item.year || '2026')}</span>
        </div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-desc">${escapeHtml(item.description || '')}</p>
        <div class="card-tools-row">
          ${tools}
        </div>
        <div class="card-actions-row">
          <button type="button" class="btn-card-action btn-primary btn-app-trigger" data-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span>Détails &amp; Démo</span>
          </button>
          ${item.githubUrl ? `
            <a href="${item.githubUrl}" target="_blank" rel="noopener" class="btn-card-action btn-secondary">
              <span>GitHub ↗</span>
            </a>
          ` : ''}
        </div>
      </div>
    </article>
  `;
}

export function initCreationsEngine() {
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxMedia = document.getElementById('lightbox-media');
  const lightboxDetails = document.getElementById('lightbox-details');
  const lightboxClose = document.getElementById('lightbox-close');

  let creationsList = [];

  function renderAllRubriques(items) {
    if (!Array.isArray(items)) return;

    const videos = items.filter(c => c.category === 'video');
    const images = items.filter(c => c.category === 'images' || c.category === 'poster');
    const demo = items.filter(c => c.category === 'demo' || c.category === 'application');
    const autres = items.filter(c => c.category === 'autres');

    // 1. Vidéos
    const vidGrid = document.querySelector('#rubrique-videos .projects-grid-rubrique');
    if (vidGrid) {
      vidGrid.innerHTML = videos.length > 0
        ? videos.map(renderVideoCard).join('')
        : '<p style="color:var(--muted); font-size:13px; grid-column:1/-1; padding:24px 0;">Aucune réalisation vidéo disponible pour le moment.</p>';
    }
    const vidHeaderCount = document.querySelector('#rubrique-videos .rubrique-actions-right');
    if (vidHeaderCount) vidHeaderCount.innerHTML = `<span style="font-family:var(--mono); font-size:12px; color:var(--muted);">${videos.length} réalisation${videos.length > 1 ? 's' : ''}</span>`;
    const vidTabCount = document.querySelector('#tab-btn-videos .rubrique-tab-count');
    if (vidTabCount) vidTabCount.textContent = String(videos.length);

    // 2. Images & Affiches
    const imgGrid = document.querySelector('#rubrique-images .projects-grid-rubrique');
    if (imgGrid) {
      imgGrid.innerHTML = images.length > 0
        ? images.map(renderPosterCard).join('')
        : '<p style="color:var(--muted); font-size:13px; grid-column:1/-1; padding:24px 0;">Aucune affiche disponible pour le moment.</p>';
    }
    const imgHeaderCount = document.querySelector('#rubrique-images .rubrique-actions-right');
    if (imgHeaderCount) imgHeaderCount.innerHTML = `<span style="font-family:var(--mono); font-size:12px; color:var(--muted);">${images.length} sélection${images.length > 1 ? 's' : ''}</span>`;
    const imgTabCount = document.querySelector('#tab-btn-images .rubrique-tab-count');
    if (imgTabCount) imgTabCount.textContent = String(images.length);

    // 3. Démo & Applications
    const demoGrid = document.querySelector('#rubrique-demo .projects-grid-rubrique');
    if (demoGrid) {
      demoGrid.innerHTML = demo.length > 0
        ? demo.map(renderDemoCard).join('')
        : '<p style="color:var(--muted); font-size:13px; grid-column:1/-1; padding:24px 0;">Aucune application disponible pour le moment.</p>';
    }
    const demoHeaderCount = document.querySelector('#rubrique-demo .rubrique-actions-right');
    if (demoHeaderCount) demoHeaderCount.innerHTML = `<span style="font-family:var(--mono); font-size:12px; color:var(--muted);">${demo.length} projet${demo.length > 1 ? 's' : ''}</span>`;
    const demoTabCount = document.querySelector('#tab-btn-demo .rubrique-tab-count');
    if (demoTabCount) demoTabCount.textContent = String(demo.length);

    // 4. Autres & Systèmes
    const autresGrid = document.querySelector('#rubrique-autres .projects-grid-rubrique');
    if (autresGrid) {
      autresGrid.innerHTML = autres.length > 0
        ? autres.map(renderAutresCard).join('')
        : '<p style="color:var(--muted); font-size:13px; grid-column:1/-1; padding:24px 0;">Aucun système disponible pour le moment.</p>';
    }
    const autresHeaderCount = document.querySelector('#rubrique-autres .rubrique-actions-right');
    if (autresHeaderCount) autresHeaderCount.innerHTML = `<span style="font-family:var(--mono); font-size:12px; color:var(--muted);">${autres.length} système${autres.length > 1 ? 's' : ''}</span>`;
    const autresTabCount = document.querySelector('#tab-btn-autres .rubrique-tab-count');
    if (autresTabCount) autresTabCount.textContent = String(autres.length);
  }

  // A. Immediately apply cached creations to guarantee zero delay and preserve user edits
  try {
    const cached = localStorage.getItem('portfolio_creations');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        creationsList = parsed;
        renderAllRubriques(creationsList);
      }
    }
  } catch (e) {
    // ignore json cache error
  }

  // B. Fetch fresh creations from backend API (Cache-Busting)
  fetch('/api/creations?t=' + Date.now(), { cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(data => {
      if (Array.isArray(data)) {
        creationsList = data;
        renderAllRubriques(creationsList);
        try {
          localStorage.setItem('portfolio_creations', JSON.stringify(data));
        } catch (e) {}
      }
    })
    .catch(err => {
      console.warn('[Creations Engine] API fetch error:', err);
    });

  // Cross-tab synchronization with Admin CMS (StorageEvent + BroadcastChannel)
  try {
    const channel = new BroadcastChannel('portfolio_sync');
    channel.onmessage = (msg) => {
      if (msg.data && msg.data.type === 'creations_updated' && Array.isArray(msg.data.items)) {
        creationsList = msg.data.items;
        renderAllRubriques(creationsList);
      }
    };
  } catch (e) {}

  window.addEventListener('storage', (e) => {
    if (!e.key || e.key === 'portfolio_creations') {
      try {
        const cached = localStorage.getItem('portfolio_creations');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            creationsList = parsed;
            renderAllRubriques(creationsList);
          }
        }
      } catch (err) {}
    }
  });

  // Open Lightbox for a project
  function openLightboxForProject(item) {
    if (!item || !lightboxModal || !lightboxMedia || !lightboxDetails) return;

    const isVideo = item.category === 'video';
    const isPoster = item.category === 'images' || item.category === 'poster';
    const isApp = item.category === 'demo' || item.category === 'application';
    const isOther = item.category === 'autres';

    // 1. Build Media
    let mediaHtml = '';
    if (isVideo) {
      const rawVideo = item.videoUrl || item.youtubeUrl || item.youtubeId || item.ytId || '';
      const previewRes = resolveMediaPreview(rawVideo);
      
      if (previewRes.isDrive) {
        mediaHtml = `
          <div class="lightbox-video-container">
            <iframe 
              src="https://drive.google.com/file/d/${previewRes.id}/preview" 
              title="${escapeHtml(item.title)}" 
              allow="autoplay; fullscreen" 
              allowfullscreen>
            </iframe>
          </div>
        `;
      } else if (previewRes.isYouTube) {
        mediaHtml = `
          <div class="lightbox-video-container">
            <iframe 
              src="https://www.youtube-nocookie.com/embed/${previewRes.id}?autoplay=1&rel=0&modestbranding=1" 
              title="${escapeHtml(item.title)}" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen>
            </iframe>
          </div>
        `;
      } else if (rawVideo.match(/\.(mp4|webm|mov)$/i)) {
        mediaHtml = `
          <div class="lightbox-video-container">
            <video src="${escapeHtml(rawVideo)}" controls autoplay playsinline style="width:100%; height:100%; object-fit:contain;"></video>
          </div>
        `;
      } else {
        mediaHtml = `
          <div class="lightbox-video-container">
            <iframe 
              src="${escapeHtml(rawVideo)}" 
              title="${escapeHtml(item.title)}" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen>
            </iframe>
          </div>
        `;
      }
    } else if (isPoster) {
      const rawPoster = item.imageUrl || item.posterUrl || '';
      const imgRes = resolveMediaPreview(rawPoster);
      const img = imgRes.thumb || rawPoster;
      
      if (imgRes.isDrive) {
        mediaHtml = `
          <div class="lightbox-poster-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%;">
            <img src="${img}" alt="${escapeHtml(item.title)}" onerror="this.style.display='none'; document.getElementById('drive-poster-iframe').style.display='block';" style="max-height:80vh; max-width:100%; object-fit:contain;" />
            <iframe id="drive-poster-iframe" src="${imgRes.embed}" style="display:none; width:100%; height:80vh; border:none; border-radius:12px;" allow="autoplay" allowfullscreen></iframe>
          </div>
        `;
      } else {
        mediaHtml = `
          <div class="lightbox-poster-container">
            <img src="${img}" alt="${escapeHtml(item.title)}" />
          </div>
        `;
      }
    } else {
      const imgRes = resolveMediaPreview(item.demoPhotoUrl || item.imageUrl || item.posterUrl || '');
      const img = imgRes.thumb || item.demoPhotoUrl || item.imageUrl || item.posterUrl;
      mediaHtml = `
        <div style="aspect-ratio: 16/9; background:#000; overflow:hidden;">
          <img src="${img}" alt="${escapeHtml(item.title)}" style="width:100%; height:100%; object-fit:cover;" />
        </div>
      `;
    }
    lightboxMedia.innerHTML = mediaHtml;

    // 2. Build Details
    const categoryName = isVideo ? 'Montage Vidéo YouTube' : (isPoster ? 'Affiche &amp; Direction Artistique' : (isApp ? 'Démo &amp; Application' : 'Système &amp; Logiciel'));
    const toolsHtml = (item.tools || item.stack || []).map(t => `<span class="lightbox-tools-item">${escapeHtml(t)}</span>`).join('');

    let actionButtons = '';
    if (isVideo && item.youtubeUrl) {
      actionButtons += `<a href="${item.youtubeUrl}" target="_blank" rel="noopener" class="btn-lightbox-action btn-lightbox-primary">Ouvrir sur YouTube ↗</a>`;
    } else if (isPoster && (item.imageUrl || item.posterUrl)) {
      actionButtons += `<a href="${item.imageUrl || item.posterUrl}" target="_blank" rel="noopener" class="btn-lightbox-action btn-lightbox-primary">Plein Format HD ↗</a>`;
    } else if (isApp || isOther) {
      if (item.liveUrl && item.liveUrl !== '#') {
        actionButtons += `<a href="${item.liveUrl}" class="btn-lightbox-action btn-lightbox-primary">Tester l’application ↗</a>`;
      }
      if (item.githubUrl) {
        actionButtons += `<a href="${item.githubUrl}" target="_blank" rel="noopener" class="btn-lightbox-action btn-lightbox-secondary">Dépôt GitHub</a>`;
      }
    }

    lightboxDetails.innerHTML = `
      <div class="lightbox-header-row">
        <h2 class="lightbox-title">${escapeHtml(item.title)}</h2>
        <span class="lightbox-category-tag">${categoryName}</span>
      </div>
      <div class="lightbox-meta">
        <strong>${escapeHtml(item.client || 'Projet Daniel Adjiri')}</strong> · Année ${escapeHtml(item.year || '2026')} ${item.format ? `· ${escapeHtml(item.format)}` : ''} ${item.duration ? `· Durée : ${escapeHtml(item.duration)}` : ''}
      </div>
      <p class="lightbox-desc">${escapeHtml(item.description || '')}</p>
      
      <div class="lightbox-tools-row">
        <span class="lightbox-tools-title">Outils &amp; Technologies :</span>
        ${toolsHtml}
      </div>

      ${actionButtons ? `<div class="lightbox-action-btns">${actionButtons}</div>` : ''}
    `;

    lightboxModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxModal) return;
    lightboxModal.classList.remove('active');
    if (lightboxMedia) lightboxMedia.innerHTML = '';
    document.body.style.overflow = '';
  }

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) {
        closeLightbox();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightboxModal && lightboxModal.classList.contains('active')) {
      closeLightbox();
    }
  });

  // Global helper to open a project by id
  window.openCreationById = function(id) {
    let item = creationsList.find(c => c.id === id);
    if (!item) {
      const card = document.querySelector(`.project-card-unique[data-id="${id}"]`);
      if (card) {
        const title = card.querySelector('.card-title')?.textContent || '';
        const desc = card.querySelector('.card-desc')?.textContent || '';
        const client = card.querySelector('.card-client')?.textContent || '';
        const year = card.querySelector('.card-year')?.textContent || '';
        const mediaBox = card.querySelector('.card-media-box');
        const ytId = mediaBox?.dataset.yt || '';
        const img = mediaBox?.querySelector('img')?.src || '';
        const action = mediaBox?.dataset.action || '';
        item = {
          id,
          title,
          description: desc,
          client,
          year,
          category: action === 'play' ? 'video' : (action === 'zoom' ? 'images' : 'demo'),
          youtubeId: ytId,
          imageUrl: img,
          posterUrl: img,
          tools: Array.from(card.querySelectorAll('.card-tools-row span')).map(s => s.textContent.trim())
        };
      }
    }
    if (item) {
      openLightboxForProject(item);
    }
  };

  // Delegate click listeners for all project cards on the document
  document.addEventListener('click', (e) => {
    const playBtn = e.target.closest('[data-action="play"], .btn-play-trigger');
    if (playBtn) {
      e.preventDefault();
      const id = playBtn.dataset.id || playBtn.closest('.project-card-unique')?.dataset.id;
      if (id) window.openCreationById(id);
      return;
    }

    const zoomBtn = e.target.closest('[data-action="zoom"], .btn-zoom-trigger');
    if (zoomBtn) {
      e.preventDefault();
      const id = zoomBtn.dataset.id || zoomBtn.closest('.project-card-unique')?.dataset.id;
      if (id) window.openCreationById(id);
      return;
    }

    const appBtn = e.target.closest('[data-action="app"], .btn-app-trigger');
    if (appBtn) {
      e.preventDefault();
      const id = appBtn.dataset.id || appBtn.closest('.project-card-unique')?.dataset.id;
      if (id) window.openCreationById(id);
      return;
    }
  });

  return { openLightboxForProject, closeLightbox, renderAllRubriques };
}
