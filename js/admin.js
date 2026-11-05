/**
 * Daniel Adjiri — Admin Panel Engine
 * Handles authentication, uploads, CRUD operations, audio configuration, and backups.
 */

import { extractYouTubeId } from '/js/creations-engine.js';

let authToken = localStorage.getItem('daniel_admin_token') || '';
let creationsList = [];

const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('admin-dashboard');
const formLogin = document.getElementById('form-login');
const passcodeInput = document.getElementById('passcode-input');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

// Modal Elements
const modalCreation = document.getElementById('modal-creation');
const btnAddCreation = document.getElementById('btn-add-creation');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelCreation = document.getElementById('btn-cancel-creation');
const formCreation = document.getElementById('form-creation');
const creationCategory = document.getElementById('creation-category');
const fieldsVideo = document.getElementById('fields-video');
const fieldsPoster = document.getElementById('fields-poster');
const fieldsApp = document.getElementById('fields-application');

// File inputs for uploads
const posterFileInput = document.getElementById('poster-file-input');
const appPhotoInput = document.getElementById('app-photo-input');
const audioUploadInput = document.getElementById('audio-upload');

// Helper for authenticated fetch
async function authFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }
  const res = await fetch(url, options);
  if (res.status === 401) {
    logout();
    throw new Error('Session expirée');
  }
  return res;
}

// Check initial authentication
if (authToken) {
  showDashboard();
}

// Login Submit
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcodeInput.value })
      });
      const data = await res.json();

      if (data.success && data.token) {
        authToken = data.token;
        localStorage.setItem('daniel_admin_token', authToken);
        showDashboard();
      } else {
        loginError.textContent = data.error || 'Code secret invalide.';
        loginError.style.display = 'block';
      }
    } catch (err) {
      loginError.textContent = 'Erreur de connexion au serveur.';
      loginError.style.display = 'block';
    }
  });
}

function showDashboard() {
  loginScreen.style.display = 'none';
  dashboard.style.display = 'block';
  btnLogout.style.display = 'inline-flex';
  loadCreations();
  loadConfig();
}

function logout() {
  authToken = '';
  localStorage.removeItem('daniel_admin_token');
  loginScreen.style.display = 'block';
  dashboard.style.display = 'none';
  btnLogout.style.display = 'none';
  if (passcodeInput) passcodeInput.value = '';
}

if (btnLogout) {
  btnLogout.addEventListener('click', logout);
}

// Tabs Navigation
document.querySelectorAll('.admin-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const targetId = btn.dataset.tab;
    const targetSection = document.getElementById(targetId);
    if (targetSection) targetSection.classList.add('active');
  });
});

// Category Switcher in Form
if (creationCategory) {
  creationCategory.addEventListener('change', () => {
    const val = creationCategory.value;
    fieldsVideo.style.display = val === 'video' ? 'block' : 'none';
    fieldsPoster.style.display = (val === 'images' || val === 'poster') ? 'block' : 'none';
    fieldsApp.style.display = (val === 'demo' || val === 'autres' || val === 'application') ? 'block' : 'none';
  });
}

// Media Upload Handler
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Erreur upload');
  return data.url;
}

if (posterFileInput) {
  posterFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      document.getElementById('creation-image-url').value = url;
      alert('Affiche téléversée avec succès sur le serveur : ' + url);
    } catch (err) {
      alert('Échec téléversement : ' + err.message);
    }
  });
}

if (appPhotoInput) {
  appPhotoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      document.getElementById('creation-app-photo').value = url;
      alert('Photo d’application téléversée : ' + url);
    } catch (err) {
      alert('Échec téléversement : ' + err.message);
    }
  });
}

if (audioUploadInput) {
  audioUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      document.getElementById('audio-url-input').value = url;
      alert('Bande-son téléversée avec succès : ' + url);
    } catch (err) {
      alert('Échec téléversement audio : ' + err.message);
    }
  });
}

// Load and Render Creations in Table
async function loadCreations() {
  try {
    const res = await fetch('/api/creations?t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        creationsList = data;
        try {
          localStorage.setItem('portfolio_creations', JSON.stringify(creationsList));
        } catch (e) {}
        renderCreationsTable();
        return;
      }
    }
  } catch (err) {
    console.error('Erreur chargement créations:', err);
  }

  // Fallback to localStorage cache
  try {
    const cached = localStorage.getItem('portfolio_creations');
    if (cached) {
      creationsList = JSON.parse(cached);
      renderCreationsTable();
    }
  } catch (e) {}
}

function renderCreationsTable() {
  const tbody = document.getElementById('creations-table-body');
  if (!tbody) return;

  if (creationsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:30px;">Aucun projet dans votre portfolio. Cliquez sur "+ Nouvelle Création".</td></tr>`;
    return;
  }

  tbody.innerHTML = creationsList.map(item => {
    const isVideo = item.category === 'video';
    const isPoster = item.category === 'images' || item.category === 'poster';
    const thumb = isVideo
      ? (item.posterUrl || `https://img.youtube.com/vi/${extractYouTubeId(item.youtubeUrl || item.youtubeId)}/default.jpg`)
      : (isPoster ? (item.imageUrl || item.posterUrl) : item.demoPhotoUrl);

    return `
      <tr>
        <td style="width:60px;">
          <img src="${thumb}" style="width:48px; height:32px; object-fit:cover; border-radius:4px; display:block;" onerror="this.src='/icons/icon.svg'" />
        </td>
        <td style="font-weight:600; color:#fff;">${item.title}</td>
        <td><span class="category-badge badge-${item.category}">${item.category}</span></td>
        <td style="color:var(--muted);">${item.client || 'Personnel'}</td>
        <td style="font-family:var(--mono); font-size:12px; color:var(--muted);">${(item.tools || item.stack || []).slice(0, 3).join(', ')}</td>
        <td style="white-space:nowrap;">
          <button type="button" class="btn-admin btn-admin-secondary btn-edit-item" data-id="${item.id}" style="padding:5px 12px; font-size:12px;">Modifier</button>
          <button type="button" class="btn-admin btn-admin-danger btn-delete-item" data-id="${item.id}" style="padding:5px 12px; font-size:12px;">Supprimer</button>
        </td>
      </tr>
    `;
  }).join('');

  // Hook edit and delete buttons
  tbody.querySelectorAll('.btn-edit-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = creationsList.find(c => c.id === id);
      if (item) openCreationModal(item);
    });
  });

  tbody.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('Voulez-vous vraiment supprimer ce projet de votre portfolio ?')) {
        // Optimistic UI update immediately:
        btn.disabled = true;
        btn.textContent = 'Suppression...';
        creationsList = creationsList.filter(c => String(c.id) !== String(id));
        try {
          localStorage.setItem('portfolio_creations', JSON.stringify(creationsList));
        } catch (e) {}
        renderCreationsTable();

        try {
          const channel = new BroadcastChannel('portfolio_sync');
          channel.postMessage({ type: 'creations_updated', items: creationsList });
        } catch (e) {}

        try {
          const res = await authFetch(`/api/creations/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            alert('Avertissement : ' + (errData.error || 'Erreur lors de la suppression sur le serveur.'));
          }
          // Notify any other tabs
          window.dispatchEvent(new Event('storage'));
        } catch (err) {
          console.error('Erreur suppression:', err);
          alert('Erreur réseau lors de la suppression : ' + err.message);
        }
      }
    });
  });
}

// Open Creation Modal (Add / Edit)
function openCreationModal(item = null) {
  formCreation.reset();
  const modalTitle = document.getElementById('modal-creation-title');

  if (item) {
    modalTitle.textContent = 'Modifier : ' + item.title;
    document.getElementById('creation-id').value = item.id;
    document.getElementById('creation-category').value = item.category;
    document.getElementById('creation-title').value = item.title;
    document.getElementById('creation-client').value = item.client || '';
    document.getElementById('creation-year').value = item.year || '2026';
    document.getElementById('creation-tools').value = (item.tools || item.stack || []).join(', ');
    document.getElementById('creation-desc').value = item.description || '';

    if (item.category === 'video') {
      document.getElementById('creation-youtube').value = item.youtubeUrl || item.youtubeId || '';
      document.getElementById('creation-duration').value = item.duration || '';
    } else if (item.category === 'images' || item.category === 'poster') {
      document.getElementById('creation-image-url').value = item.imageUrl || item.posterUrl || '';
      document.getElementById('creation-format').value = item.format || '';
    } else if (item.category === 'demo' || item.category === 'autres' || item.category === 'application') {
      document.getElementById('creation-app-photo').value = item.demoPhotoUrl || '';
      document.getElementById('creation-live-url').value = item.liveUrl || '';
      document.getElementById('creation-github-url').value = item.githubUrl || '';
    }
  } else {
    modalTitle.textContent = 'Ajouter une nouvelle création';
    document.getElementById('creation-id').value = '';
    document.getElementById('creation-category').value = 'video';
  }

  creationCategory.dispatchEvent(new Event('change'));
  modalCreation.classList.add('active');
  setTimeout(updateFormMediaPreview, 50);
}

function updateFormMediaPreview() {
  const previewBox = document.getElementById('preview-box-container');
  const previewContent = document.getElementById('media-live-preview');
  const previewBadge = document.getElementById('preview-type-badge');
  if (!previewBox || !previewContent) return;

  const category = document.getElementById('creation-category')?.value;
  let url = '';
  if (category === 'video') {
    url = document.getElementById('creation-youtube')?.value?.trim() || '';
  } else if (category === 'images' || category === 'poster') {
    url = document.getElementById('creation-image-url')?.value?.trim() || '';
  } else {
    url = document.getElementById('creation-app-photo')?.value?.trim() || '';
  }

  if (!url) {
    previewBox.style.display = 'none';
    previewContent.innerHTML = '';
    return;
  }

  // Google Drive Link
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    previewBox.style.display = 'block';
    if (previewBadge) previewBadge.textContent = 'Google Drive';
    if (category === 'video') {
      previewContent.innerHTML = `<iframe src="https://drive.google.com/file/d/${fileId}/preview" style="width:100%; height:180px; border:0; border-radius:4px;" allow="autoplay"></iframe>`;
    } else {
      previewContent.innerHTML = `<img src="https://lh3.googleusercontent.com/d/${fileId}=w600" style="max-height:180px; object-fit:contain; border-radius:4px;" onerror="this.alt='Lien Drive privé ou non partagé publiquement'" />`;
    }
    return;
  }

  // YouTube Link
  const ytMatch = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  if (ytMatch && ytMatch[2] && ytMatch[2].length === 11) {
    const ytId = ytMatch[2];
    previewBox.style.display = 'block';
    if (previewBadge) previewBadge.textContent = 'YouTube';
    previewContent.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${ytId}" style="width:100%; height:180px; border:0; border-radius:4px;" allowfullscreen></iframe>`;
    return;
  }

  // Direct Image or Upload
  if (url.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i) || url.startsWith('/uploads/')) {
    previewBox.style.display = 'block';
    if (previewBadge) previewBadge.textContent = 'Image Directe';
    previewContent.innerHTML = `<img src="${url}" style="max-height:180px; object-fit:contain; border-radius:4px;" onerror="this.style.display='none'" />`;
    return;
  }

  previewBox.style.display = 'none';
  previewContent.innerHTML = '';
}

// Bind live preview listeners
['creation-youtube', 'creation-image-url', 'creation-app-photo', 'creation-category'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', updateFormMediaPreview);
    el.addEventListener('change', updateFormMediaPreview);
  }
});

function closeCreationModal() {
  modalCreation.classList.remove('active');
}

if (btnAddCreation) btnAddCreation.addEventListener('click', () => openCreationModal());
if (btnCloseModal) btnCloseModal.addEventListener('click', closeCreationModal);
if (btnCancelCreation) btnCancelCreation.addEventListener('click', closeCreationModal);

// Save Creation
if (formCreation) {
  formCreation.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('creation-id')?.value || '';
    const category = document.getElementById('creation-category')?.value || 'video';
    const title = (document.getElementById('creation-title')?.value || '').trim();
    const description = ((document.getElementById('creation-desc') || document.getElementById('creation-description'))?.value || '').trim();
    const client = (document.getElementById('creation-client')?.value || '').trim();
    const year = parseInt(document.getElementById('creation-year')?.value) || 2026;
    const tools = (document.getElementById('creation-tools')?.value || '').split(',').map(s => s.trim()).filter(Boolean);

    if (!title) {
      alert('Veuillez renseigner un titre pour votre création.');
      return;
    }

    const payload = {
      category,
      title,
      description,
      client,
      year,
      tools,
      tags: tools
    };

    if (category === 'video') {
      payload.youtubeUrl = ((document.getElementById('creation-youtube') || document.getElementById('creation-video-url'))?.value || '').trim();
      payload.duration = (document.getElementById('creation-duration')?.value || '').trim();
      payload.posterUrl = (document.getElementById('creation-video-poster')?.value || '').trim();
    } else if (category === 'images' || category === 'poster') {
      payload.imageUrl = (document.getElementById('creation-image-url')?.value || '').trim();
      payload.posterUrl = payload.imageUrl;
      payload.format = (document.getElementById('creation-format')?.value || '').trim();
    } else if (category === 'demo' || category === 'autres' || category === 'application') {
      payload.demoPhotoUrl = (document.getElementById('creation-app-photo')?.value || '').trim();
      payload.liveUrl = (document.getElementById('creation-live-url')?.value || '').trim();
      payload.githubUrl = (document.getElementById('creation-github-url')?.value || '').trim();
    }

    const submitBtn = formCreation.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : 'Sauvegarder la création';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enregistrement en cours...';
    }

    try {
      let savedCreation = null;
      if (id) {
        const res = await authFetch(`/api/creations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erreur serveur (${res.status})`);
        }
        const data = await res.json();
        savedCreation = data.creation || { ...payload, id };
        const idx = creationsList.findIndex(c => String(c.id) === String(id));
        if (idx !== -1) {
          creationsList[idx] = savedCreation;
        } else {
          creationsList.unshift(savedCreation);
        }
      } else {
        const res = await authFetch('/api/creations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erreur serveur (${res.status})`);
        }
        const data = await res.json();
        savedCreation = data.creation || { ...payload, id: 'project-' + Date.now() };
        creationsList.unshift(savedCreation);
      }

      try {
        localStorage.setItem('portfolio_creations', JSON.stringify(creationsList));
      } catch (e) {}

      try {
        const channel = new BroadcastChannel('portfolio_sync');
        channel.postMessage({ type: 'creations_updated', items: creationsList });
      } catch (e) {}

      renderCreationsTable();
      closeCreationModal();
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Erreur enregistrement:', err);
      alert('Erreur enregistrement : ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });
}

// Clear all creations handler
const btnClearAllCreations = document.getElementById('btn-clear-all-creations');
if (btnClearAllCreations) {
  btnClearAllCreations.addEventListener('click', async () => {
    if (confirm('Attention : Voulez-vous vraiment supprimer TOUTES les créations de votre portfolio ? Cette action videra complètement la liste.')) {
      creationsList = [];
      try {
        localStorage.setItem('portfolio_creations', JSON.stringify([]));
      } catch (e) {}
      renderCreationsTable();

      try {
        const channel = new BroadcastChannel('portfolio_sync');
        channel.postMessage({ type: 'creations_updated', items: [] });
      } catch (e) {}
      window.dispatchEvent(new Event('storage'));

      try {
        const res = await authFetch('/api/creations/clear', { method: 'POST' });
        if (res.ok) {
          alert('Toutes les créations ont été supprimées avec succès.');
        } else {
          const errData = await res.json().catch(() => ({}));
          alert('Avertissement serveur : ' + (errData.error || 'Erreur lors du vidage'));
        }
      } catch (err) {
        console.error('Erreur vidage créations:', err);
        alert('Erreur réseau : ' + err.message);
      }
    }
  });
}

function updateLocalConfig(partial) {
  try {
    let current = {};
    const cached = localStorage.getItem('portfolio_config');
    if (cached) {
      try { current = JSON.parse(cached); } catch (e) {}
    }
    const merged = { ...current, ...partial };
    if (partial.profile) merged.profile = { ...(current.profile || {}), ...partial.profile };
    if (partial.cv) merged.cv = { ...(current.cv || {}), ...partial.cv };
    if (partial.audio) merged.audio = { ...(current.audio || {}), ...partial.audio };
    localStorage.setItem('portfolio_config', JSON.stringify(merged));
  } catch (e) {}
}

// Load and Save Config (Hero Audio & Profile)
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    try {
      localStorage.setItem('portfolio_config', JSON.stringify(data));
    } catch (e) {}
    populateConfigUI(data);
  } catch (err) {
    console.error('Erreur chargement config:', err);
    try {
      const cached = localStorage.getItem('portfolio_config');
      if (cached) {
        populateConfigUI(JSON.parse(cached));
      }
    } catch (e) {}
  }
}

function populateConfigUI(data) {
  if (!data) return;

  if (data.audio) {
    const mode = data.audio.mode || 'playlist';
    const modeRadio = document.querySelector(`input[name="audioMode"][value="${mode}"]`);
    if (modeRadio) modeRadio.checked = true;
    const playlistFields = document.getElementById('playlist-audio-fields');
    if (playlistFields) playlistFields.style.display = mode === 'playlist' ? 'block' : 'none';
    const customFields = document.getElementById('custom-audio-fields');
    if (customFields) customFields.style.display = mode === 'custom' ? 'block' : 'none';
    const audioUrl = document.getElementById('audio-url-input');
    if (audioUrl) audioUrl.value = data.audio.customUrl || '';
    const audioVol = document.getElementById('audio-volume-range');
    const volVal = data.audio.volume !== undefined ? data.audio.volume : 0.55;
    if (audioVol) audioVol.value = volVal;
    const volDisp = document.getElementById('vol-display');
    if (volDisp) volDisp.textContent = Math.round(volVal * 100) + '%';
    const audioTitle = document.getElementById('audio-title-input');
    if (audioTitle) audioTitle.value = data.audio.title || "Musiques d'ambiance libres de droit (Aléatoire)";
  }

  if (data.profile) {
    const p = data.profile;
    const elTagline = document.getElementById('profile-hero-tagline');
    if (elTagline) elTagline.value = p.heroTagline || '';

    const elHeroTitle = document.getElementById('profile-hero-title');
    if (elHeroTitle) elHeroTitle.value = p.heroTitle || '';

    const elHeroSub = document.getElementById('profile-hero-subtitle');
    if (elHeroSub) elHeroSub.value = p.heroSubtitle || '';

    const elHeroBio = document.getElementById('profile-hero-bio');
    if (elHeroBio) elHeroBio.value = p.heroBio || '';

    const elName = document.getElementById('profile-name');
    if (elName) elName.value = p.name || '';

    const elPhones = document.getElementById('profile-telephones');
    if (elPhones) elPhones.value = (p.telephones || []).join(', ');

    const elEmails = document.getElementById('profile-emails');
    if (elEmails) elEmails.value = (p.emails || []).join(', ');

    const elGithub = document.getElementById('profile-github');
    if (elGithub) elGithub.value = p.github || '';

    const elLoc = document.getElementById('profile-location');
    if (elLoc) elLoc.value = p.location || '';
  }

  if (data.cv) {
    renderCvFormationsEditor(data.cv.formations || []);
    renderCvEngagementsEditor(data.cv.engagements || []);
    renderCvSkillsEditor(data.cv.skills || []);
  }
}

// Audio Mode Radio Toggle
document.querySelectorAll('input[name="audioMode"]').forEach(r => {
  r.addEventListener('change', () => {
    const customFields = document.getElementById('custom-audio-fields');
    if (customFields) customFields.style.display = r.value === 'custom' ? 'block' : 'none';
    const playlistFields = document.getElementById('playlist-audio-fields');
    if (playlistFields) playlistFields.style.display = r.value === 'playlist' ? 'block' : 'none';
  });
});

const volRange = document.getElementById('audio-volume-range');
if (volRange) {
  volRange.addEventListener('input', () => {
    document.getElementById('vol-display').textContent = Math.round(volRange.value * 100) + '%';
  });
}

// Save Audio Config
const formAudio = document.getElementById('form-audio-config');
if (formAudio) {
  formAudio.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = document.querySelector('input[name="audioMode"]:checked')?.value || 'playlist';
    const customUrl = document.getElementById('audio-url-input')?.value || '';
    const volume = Number(document.getElementById('audio-volume-range')?.value || 0.55);
    const title = document.getElementById('audio-title-input')?.value || "Musiques d'ambiance libres de droit (Aléatoire)";

    const audioPayload = { mode, customUrl, volume, title, shuffle: true };

    try {
      await authFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioPayload })
      });
      updateLocalConfig({ audio: audioPayload });
      alert('Configuration audio enregistrée ! La vallée 3D utilisera vos paramètres au prochain rechargement.');
    } catch (err) {
      alert('Échec enregistrement audio : ' + err.message);
    }
  });
}

// Save Profile & Hero Config
const formProfile = document.getElementById('form-profile-config');
if (formProfile) {
  formProfile.addEventListener('submit', async (e) => {
    e.preventDefault();
    const heroTagline = document.getElementById('profile-hero-tagline')?.value.trim() || '';
    const heroTitle = document.getElementById('profile-hero-title')?.value.trim() || '';
    const heroSubtitle = document.getElementById('profile-hero-subtitle')?.value.trim() || '';
    const heroBio = document.getElementById('profile-hero-bio')?.value.trim() || '';

    const name = document.getElementById('profile-name')?.value.trim() || '';
    const telephones = (document.getElementById('profile-telephones')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    const emails = (document.getElementById('profile-emails')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    const github = document.getElementById('profile-github')?.value.trim() || '';
    const location = document.getElementById('profile-location')?.value.trim() || '';

    const profilePayload = {
      heroTagline,
      heroTitle,
      heroSubtitle,
      heroBio,
      name,
      telephones,
      emails,
      github,
      location
    };

    try {
      await authFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profilePayload })
      });
      updateLocalConfig({ profile: profilePayload });
      alert('Le Hero 3D et les coordonnées ont été enregistrés avec succès ! Le portfolio est immédiatement synchronisé.');
    } catch (err) {
      alert('Échec mise à jour du profil : ' + err.message);
    }
  });
}

// ============================================
// CV & PARCOURS MANAGEMENT IN ADMIN
// ============================================

function createFormationItemHtml(f = { year: '', institution: '', title: '', description: '' }) {
  return `
    <div class="cv-formation-item" style="background:#191c16; border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:16px; position:relative;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-weight:600; font-size:13px; color:var(--cream);">Formation / Diplôme</span>
        <button type="button" class="btn-admin btn-admin-danger btn-remove-cv-item" style="padding:4px 10px; font-size:11px;">Supprimer</button>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:10px;">
        <div class="admin-form-group" style="margin-bottom:0;">
          <label style="font-size:11px;">Année(s) (ex: 2026 — 2027)</label>
          <input type="text" class="admin-input cv-f-year" value="${escapeHtml(f.year || '')}" placeholder="2026 — 2027" required />
        </div>
        <div class="admin-form-group" style="margin-bottom:0;">
          <label style="font-size:11px;">Établissement (ex: INP-HB · Yamoussoukro)</label>
          <input type="text" class="admin-input cv-f-inst" value="${escapeHtml(f.institution || '')}" placeholder="INP-HB · Yamoussoukro" />
        </div>
      </div>
      <div class="admin-form-group" style="margin-bottom:10px;">
        <label style="font-size:11px;">Titre de la formation (ex: CPGE MPI)</label>
        <input type="text" class="admin-input cv-f-title" value="${escapeHtml(f.title || '')}" placeholder="Intitulé officiel" required />
      </div>
      <div class="admin-form-group" style="margin-bottom:0;">
        <label style="font-size:11px;">Description / Contenu</label>
        <textarea rows="2" class="admin-textarea cv-f-desc" placeholder="Détails, matières principales ou distinctions">${escapeHtml(f.description || '')}</textarea>
      </div>
    </div>
  `;
}

function renderCvFormationsEditor(formations) {
  const container = document.getElementById('cv-formations-container');
  if (!container) return;
  container.innerHTML = formations.map(f => createFormationItemHtml(f)).join('');
  attachCvRemoveListeners(container);
}

function createEngagementItemHtml(e = { role: '', context: '' }) {
  return `
    <div class="cv-engagement-item" style="display:grid; grid-template-columns:1fr 1fr auto; gap:10px; align-items:center; background:#191c16; border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px;">
      <input type="text" class="admin-input cv-e-role" value="${escapeHtml(e.role || '')}" placeholder="Rôle (ex: Chef Adjoint Com)" required />
      <input type="text" class="admin-input cv-e-context" value="${escapeHtml(e.context || '')}" placeholder="Structure / Association (ex: INP-HB)" required />
      <button type="button" class="btn-admin btn-admin-danger btn-remove-cv-item" style="padding:6px 10px; font-size:11px;">&times;</button>
    </div>
  `;
}

function renderCvEngagementsEditor(engagements) {
  const container = document.getElementById('cv-engagements-container');
  if (!container) return;
  container.innerHTML = engagements.map(e => createEngagementItemHtml(e)).join('');
  attachCvRemoveListeners(container);
}

function createSkillItemHtml(s = { category: '', items: '' }) {
  return `
    <div class="cv-skill-item" style="display:grid; grid-template-columns:1fr 2fr auto; gap:10px; align-items:center; background:#191c16; border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px;">
      <input type="text" class="admin-input cv-s-cat" value="${escapeHtml(s.category || '')}" placeholder="Catégorie (ex: Programmation)" required />
      <input type="text" class="admin-input cv-s-items" value="${escapeHtml(s.items || '')}" placeholder="Outils & Langages (ex: Python · C · OCaml · SQL)" required />
      <button type="button" class="btn-admin btn-admin-danger btn-remove-cv-item" style="padding:6px 10px; font-size:11px;">&times;</button>
    </div>
  `;
}

function renderCvSkillsEditor(skills) {
  const container = document.getElementById('cv-skills-container');
  if (!container) return;
  container.innerHTML = skills.map(s => createSkillItemHtml(s)).join('');
  attachCvRemoveListeners(container);
}

function attachCvRemoveListeners(parent) {
  parent.querySelectorAll('.btn-remove-cv-item').forEach(btn => {
    btn.onclick = () => {
      const item = btn.closest('.cv-formation-item, .cv-engagement-item, .cv-skill-item');
      if (item) item.remove();
    };
  });
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

// Add formation button
const btnAddFormation = document.getElementById('btn-add-formation');
if (btnAddFormation) {
  btnAddFormation.addEventListener('click', () => {
    const container = document.getElementById('cv-formations-container');
    if (container) {
      const div = document.createElement('div');
      div.innerHTML = createFormationItemHtml();
      const child = div.firstElementChild;
      container.appendChild(child);
      attachCvRemoveListeners(container);
    }
  });
}

// Add engagement button
const btnAddEngagement = document.getElementById('btn-add-engagement');
if (btnAddEngagement) {
  btnAddEngagement.addEventListener('click', () => {
    const container = document.getElementById('cv-engagements-container');
    if (container) {
      const div = document.createElement('div');
      div.innerHTML = createEngagementItemHtml();
      const child = div.firstElementChild;
      container.appendChild(child);
      attachCvRemoveListeners(container);
    }
  });
}

// Add skill button
const btnAddSkill = document.getElementById('btn-add-skill');
if (btnAddSkill) {
  btnAddSkill.addEventListener('click', () => {
    const container = document.getElementById('cv-skills-container');
    if (container) {
      const div = document.createElement('div');
      div.innerHTML = createSkillItemHtml();
      const child = div.firstElementChild;
      container.appendChild(child);
      attachCvRemoveListeners(container);
    }
  });
}

// Save CV Form
const formCv = document.getElementById('form-cv-config');
if (formCv) {
  formCv.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formations = Array.from(document.querySelectorAll('.cv-formation-item')).map(item => ({
      year: item.querySelector('.cv-f-year')?.value.trim() || '',
      institution: item.querySelector('.cv-f-inst')?.value.trim() || '',
      title: item.querySelector('.cv-f-title')?.value.trim() || '',
      description: item.querySelector('.cv-f-desc')?.value.trim() || ''
    })).filter(f => f.title);

    const engagements = Array.from(document.querySelectorAll('.cv-engagement-item')).map(item => ({
      role: item.querySelector('.cv-e-role')?.value.trim() || '',
      context: item.querySelector('.cv-e-context')?.value.trim() || ''
    })).filter(e => e.role);

    const skills = Array.from(document.querySelectorAll('.cv-skill-item')).map(item => ({
      category: item.querySelector('.cv-s-cat')?.value.trim() || '',
      items: item.querySelector('.cv-s-items')?.value.trim() || ''
    })).filter(s => s.category);

    const cvPayload = { formations, engagements, skills };

    try {
      await authFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv: cvPayload })
      });
      updateLocalConfig({ cv: cvPayload });
      alert('Parcours & CV enregistré avec succès ! Le portfolio est immédiatement actualisé.');
    } catch (err) {
      alert('Échec enregistrement du CV : ' + err.message);
    }
  });
}

// Export JSON Backup
const btnExport = document.getElementById('btn-export-json');
if (btnExport) {
  btnExport.addEventListener('click', () => {
    const jsonStr = JSON.stringify(creationsList, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daniel_adjiri_portfolio_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

// Import JSON Backup
const btnImport = document.getElementById('btn-import-json');
const importFileInput = document.getElementById('import-json-file');
if (btnImport && importFileInput) {
  btnImport.addEventListener('click', async () => {
    const file = importFileInput.files[0];
    if (!file) {
      alert('Veuillez sélectionner un fichier JSON de sauvegarde.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Le fichier doit être un tableau JSON de projets.');

      if (confirm(`Confirmez-vous la restauration de ${parsed.length} projets ? Cela remplacera la liste actuelle.`)) {
        const res = await authFetch('/api/creations/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creations: parsed })
        });
        const data = await res.json();
        alert(`Restauration réussie : ${data.count} créations importées.`);
        loadCreations();
      }
    } catch (err) {
      alert('Erreur lors de la lecture du fichier de sauvegarde : ' + err.message);
    }
  });
}
