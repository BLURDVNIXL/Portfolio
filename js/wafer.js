/**
 * Wafer — Creations Studio & Interactive Dashboard Engine
 * Scène 1 : "Voir mes créations" avec vidéo château & overlay ASCII
 * Scène 2 : Dashboard "Vidéos, Images, Démo, Autres" avec vidéo ciel & overlay ASCII
 */

export const WAFER_LOGO_PATH = "M12 2c5.52 0 10 4.48 10 10v10H12C6.48 22 2 17.52 2 12S6.48 2 12 2Zm-.3 4.1a5.9 5.9 0 1 0 0 11.8 5.9 5.9 0 0 0 0-11.8Z";

export function ascii(canvas, video, mode) {
  if (!canvas || !video) return { start: () => {}, stop: () => {} };

  const ctx = canvas.getContext('2d');
  if (!ctx) return { start: () => {}, stop: () => {} };

  let offscreen = document.createElement('canvas');
  let offCtx = null;
  try {
    offCtx = offscreen.getContext('2d', { willReadFrequently: true });
  } catch {
    offCtx = offscreen.getContext('2d');
  }

  let running = false;
  let rafId = 0;
  let lastTime = 0;
  let cols = 0, rows = 0;
  let cellW = 8, cellH = 11;
  let width = 0, height = 0;

  function updateSize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (width <= 0 || height <= 0) return;

    if (width < 640) {
      cellW = 7;
      cellH = 10;
    } else {
      cellW = 8;
      cellH = 11;
    }

    cols = Math.ceil(width / cellW);
    rows = Math.ceil(height / cellH);

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    offscreen.width = cols;
    offscreen.height = rows;
  }

  const resizeObserver = new ResizeObserver(() => {
    updateSize();
  });
  resizeObserver.observe(canvas);
  updateSize();

  function render(now) {
    if (!running) return;

    if (now - lastTime >= 110) {
      lastTime = now;

      if (cols > 0 && rows > 0 && video.readyState >= 2) {
        try {
          const vw = video.videoWidth || 1920;
          const vh = video.videoHeight || 1080;
          const targetAspect = cols / rows;
          const videoAspect = vw / vh;

          let sx = 0, sy = 0, sw = vw, sh = vh;
          if (videoAspect > targetAspect) {
            sw = vh * targetAspect;
            sx = (vw - sw) / 2;
          } else {
            sh = vw / targetAspect;
            sy = (vh - sh) / 2;
          }

          offCtx.drawImage(video, sx, sy, sw, sh, 0, 0, cols, rows);
          const imgData = offCtx.getImageData(0, 0, cols, rows);
          const data = imgData.data;

          const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, width, height);
          ctx.font = `500 ${cellH - 1}px 'Geist Mono', ui-monospace, monospace`;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'center';

          for (let y = 0; y < rows; y++) {
            const cy = y * cellH;
            for (let x = 0; x < cols; x++) {
              const cx = x * cellW + cellW * 0.5;
              const idx = (y * cols + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              const warm = r - b;
              const k = ((Math.sin(x * 127.1 + y * 311.7) * 43758.545) % 1 + 1) % 1;

              if (mode === 'castle') {
                if (L < 0.27) {
                  ctx.fillStyle = 'rgba(8,16,30,0.52)';
                  ctx.fillRect(x * cellW, cy, cellW, cellH);
                  const chars = ":;1s5$:.";
                  const charIdx = Math.floor(k * 8 + L * 20) & 7;
                  ctx.fillStyle = 'rgba(205,224,236,0.5)';
                  ctx.fillText(chars[charIdx], cx, cy);
                } else if (warm > 20 && L < 0.70) {
                  const chars = "@0G8@6C0";
                  const charIdx = Math.floor(k * 3 + L * 14) & 7;
                  const alpha = 0.24 + (0.70 - L) * 0.55;
                  ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                  ctx.fillText(chars[charIdx], cx, cy);
                } else if (L > 0.60) {
                  if (k >= 0.18) {
                    ctx.fillStyle = 'rgba(255,255,255,0.46)';
                    ctx.fillText('.', cx, cy - 2);
                  }
                } else if (k > 0.45) {
                  const ch = L < 0.4 ? ':' : '.';
                  ctx.fillStyle = 'rgba(255,255,255,0.26)';
                  ctx.fillText(ch, cx, cy - 1);
                }
              } else if (mode === 'sky') {
                if (warm < 14 || L < 0.56) {
                  continue;
                }
                const ch = k > 0.7 ? '+' : (k > 0.35 ? ':' : '.');
                const col = L > 0.8 ? 'rgba(255,255,255,0.34)' : 'rgba(92,112,104,0.30)';
                ctx.fillStyle = col;
                ctx.fillText(ch, cx, cy);
              }
            }
          }
          ctx.restore();
        } catch (err) {
          console.warn('[ASCII] Canvas sampling security or context exception:', err);
          canvas.style.display = 'none';
          stop();
          return;
        }
      }
    }

    rafId = requestAnimationFrame(render);
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    updateSize();
    rafId = requestAnimationFrame(render);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  return { start, stop, updateSize };
}

export function initWafer(rootContainer = document) {
  const auth = rootContainer.querySelector('.auth');
  const app = rootContainer.querySelector('.app');
  const castleVideo = rootContainer.querySelector('#castle-video');
  const castleCanvas = rootContainer.querySelector('#castle-canvas');
  const skyVideo = rootContainer.querySelector('#sky-video');
  const skyCanvas = rootContainer.querySelector('#sky-canvas');

  if (!auth || !app) return;

  const castleAscii = ascii(castleCanvas, castleVideo, 'castle');
  const skyAscii = ascii(skyCanvas, skyVideo, 'sky');

  castleAscii.start();

  let readyTriggered = false;
  const triggerReady = () => {
    if (readyTriggered) return;
    readyTriggered = true;
    auth.classList.add('ready');
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      setTimeout(triggerReady, 900);
    });
  }
  setTimeout(triggerReady, 2600);

  // Function to switch between separate rubriques: 'videos', 'images', 'demo', 'autres'
  function switchRubrique(rubriqueKey) {
    if (!rubriqueKey) rubriqueKey = 'videos';
    const key = rubriqueKey.toLowerCase().replace('#', '').replace('block-', '').replace('rubrique-', '').replace('nav-', '');

    // 1. Hide all rubrique views, show only the active one
    const allViews = rootContainer.querySelectorAll('.rubrique-view');
    allViews.forEach(v => v.classList.remove('active'));

    const targetView = rootContainer.querySelector(`#rubrique-${key}`) || rootContainer.querySelector('#rubrique-videos');
    if (targetView) {
      targetView.classList.add('active');
    }

    // 2. Sync Top Rubrique Tab Bar buttons
    const tabBtns = rootContainer.querySelectorAll('.rubrique-tab-btn');
    tabBtns.forEach(btn => {
      const bKey = btn.dataset.rubrique;
      btn.classList.toggle('active', bKey === key);
      btn.setAttribute('aria-selected', String(bKey === key));
    });

    // 3. Sync Sidebar Nav Items
    const sideNavs = rootContainer.querySelectorAll('.side-nav .nav-item');
    sideNavs.forEach(nav => {
      const navId = nav.id || '';
      const isMatch = navId === `nav-${key}`;
      nav.classList.toggle('active', isMatch);
    });

    // 4. Scroll smoothly to top of pane
    const scrollPane = rootContainer.querySelector('.scroll-pane');
    if (scrollPane) {
      scrollPane.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 5. On mobile, collapse sidebar
    if (window.innerWidth <= 768) {
      app.classList.add('mini');
    }
  }

  // Transition from Scene 1 to Scene 2 (Dashboard)
  let transitionDone = false;
  function triggerDashboardTransition(targetRubrique = 'videos') {
    if (transitionDone) {
      if (targetRubrique) switchRubrique(targetRubrique);
      return;
    }
    transitionDone = true;

    auth.classList.add('leaving');

    if (skyVideo) {
      skyVideo.play().catch(() => {});
    }

    setTimeout(() => {
      app.classList.add('on');
      skyAscii.start();
      castleAscii.stop();
      if (castleVideo) castleVideo.pause();

      if (window.innerWidth <= 760) {
        app.classList.add('mini');
      }

      switchRubrique(targetRubrique || 'videos');
    }, 520);
  }

  // Hook explore triggers in Scene 1
  const exploreTriggers = rootContainer.querySelectorAll('#btn-see-creations, #btn-shortcut-videos, #btn-shortcut-images, #btn-shortcut-demo, #auth-form, .btn-oauth, #btn-create, #btn-login');
  exploreTriggers.forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const target = el.dataset.target || (el.id === 'btn-shortcut-images' ? 'images' : 'videos');
      triggerDashboardTransition(target);
    });
  });

  // Sidebar Collapse / Expand
  const btnCollapse = rootContainer.querySelector('#btn-collapse');
  const btnExpandGlyph = rootContainer.querySelector('#btn-expand-glyph');
  const panel = rootContainer.querySelector('.panel');

  if (btnCollapse) {
    btnCollapse.addEventListener('click', () => {
      app.classList.add('mini');
    });
  }

  if (btnExpandGlyph) {
    btnExpandGlyph.addEventListener('click', () => {
      app.classList.remove('mini');
    });
  }

  if (panel) {
    panel.addEventListener('click', (e) => {
      if (window.innerWidth <= 760 && !app.classList.contains('mini')) {
        const side = rootContainer.querySelector('.side');
        if (side && !side.contains(e.target)) {
          app.classList.add('mini');
        }
      }
    });
  }

  // Sidebar Navigation Links (Vidéos, Images, Démo, Autres)
  const navVideos = rootContainer.querySelector('#nav-videos');
  const navImages = rootContainer.querySelector('#nav-images');
  const navDemo = rootContainer.querySelector('#nav-demo');
  const navAutres = rootContainer.querySelector('#nav-autres');

  if (navVideos) navVideos.addEventListener('click', () => switchRubrique('videos'));
  if (navImages) navImages.addEventListener('click', () => switchRubrique('images'));
  if (navDemo) navDemo.addEventListener('click', () => switchRubrique('demo'));
  if (navAutres) navAutres.addEventListener('click', () => switchRubrique('autres'));

  // Top Rubriques Tab Bar Links
  const tabBtns = rootContainer.querySelectorAll('.rubrique-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.rubrique;
      if (key) switchRubrique(key);
    });
  });

  // Rubrique switcher is fully handled by switchRubrique() via sidebar and top tabs

  // Keyboard shortcut "/" scrolls to top
  window.addEventListener('keydown', (e) => {
    if (e.key === '/') {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
      if (!isInput && app.classList.contains('on')) {
        e.preventDefault();
        const scrollPane = rootContainer.querySelector('.scroll-pane');
        if (scrollPane) {
          scrollPane.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }
  });

  // Search pill click
  const searchPill = rootContainer.querySelector('.search-pill');
  if (searchPill) {
    searchPill.addEventListener('click', () => {
      const scrollPane = rootContainer.querySelector('.scroll-pane');
      if (scrollPane) {
        scrollPane.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Tab visibility resume video
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (app.classList.contains('on')) {
        if (skyVideo && skyVideo.paused) skyVideo.play().catch(() => {});
      } else {
        if (castleVideo && castleVideo.paused) castleVideo.play().catch(() => {});
      }
    }
  });
}
