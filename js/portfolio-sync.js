/**
 * portfolio-sync.js
 * Synchronise dynamiquement les textes du Hero 3D, les coordonnées
 * et l'intégralité du Parcours & CV avec le CMS Admin (/api/config).
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function initPortfolioSync() {
  function applyCvConfig(cv) {
    if (!cv) return;

    // 1. Formations
    if (Array.isArray(cv.formations) && cv.formations.length > 0) {
      const listEl = document.getElementById('cv-formations-list');
      if (listEl) {
        listEl.innerHTML = cv.formations.map(f => `
          <article class="career-entry">
            <div class="career-entry-header">
              <span class="career-year">${escapeHtml(f.year)}</span>
              <span class="career-institution">${escapeHtml(f.institution)}</span>
            </div>
            <h3>${escapeHtml(f.title)}</h3>
            <p>${escapeHtml(f.description)}</p>
          </article>
        `).join('');
      }
    }

    // 2. Engagements & Responsabilités
    if (Array.isArray(cv.engagements) && cv.engagements.length > 0) {
      const engList = document.getElementById('cv-engagements-list');
      if (engList) {
        engList.innerHTML = cv.engagements.map(e => `
          <li>
            <span class="k">${escapeHtml(e.role)}</span>
            <span class="v">${escapeHtml(e.context)}</span>
          </li>
        `).join('');
      }
    }

    // 3. Compétences Techniques & Création
    if (Array.isArray(cv.skills) && cv.skills.length > 0) {
      const skillsList = document.getElementById('cv-skills-list');
      if (skillsList) {
        skillsList.innerHTML = cv.skills.map(s => `
          <li>
            <span class="k">${escapeHtml(s.category)}</span>
            <span class="v">${escapeHtml(s.items)}</span>
          </li>
        `).join('');
      }
    }
  }

  function applyProfileConfig(profile) {
    if (!profile) return;

    // 1. Hero 3D - Tagline (ex: "Élève-Ingénieur CPGE MP2I / MPI · INP-HB")
    if (profile.heroTagline) {
      const elTagline = document.getElementById('hero-tagline');
      if (elTagline) {
        if (profile.heroTagline.includes(' · ')) {
          const [left, right] = profile.heroTagline.split(' · ');
          elTagline.innerHTML = `${escapeHtml(left)} · <strong>${escapeHtml(right)}</strong>`;
        } else {
          elTagline.textContent = profile.heroTagline;
        }
      }
    }

    // 2. Hero 3D - Grand Titre (ex: "Code, design, création.")
    if (profile.heroTitle) {
      const elTitle = document.getElementById('hero-title');
      if (elTitle) {
        if (!profile.heroTitle.includes('<')) {
          const words = profile.heroTitle.trim().split(' ');
          if (words.length > 1) {
            const lastWord = words.pop();
            elTitle.innerHTML = `${escapeHtml(words.join(' '))} <em>${escapeHtml(lastWord)}</em>`;
          } else {
            elTitle.innerHTML = `<em>${escapeHtml(profile.heroTitle)}</em>`;
          }
        } else {
          elTitle.innerHTML = profile.heroTitle;
        }
      }
    }

    // 3. Hero 3D - Sous-titre & Bio
    const elCap = document.getElementById('hero-cap');
    if (elCap && (profile.heroSubtitle || profile.heroBio || profile.name)) {
      const name = profile.name || 'ADJIRI N’DA ÉLIE DANIEL';
      const sub = profile.heroSubtitle || `${name} — Développeur full-stack & créatif audiovisuel.`;
      const bio = profile.heroBio || 'Je construis des expériences qui vivent.';
      elCap.innerHTML = `<strong>${escapeHtml(sub)}</strong><br /><span>${escapeHtml(bio)}</span>`;
    }

    // 4. Section Contact - Téléphones
    if (profile.telephones && Array.isArray(profile.telephones) && profile.telephones.length > 0) {
      const elPhones = document.getElementById('contact-phones-list');
      if (elPhones) {
        elPhones.innerHTML = profile.telephones.map(tel => {
          const cleanTel = tel.replace(/\s+/g, '');
          return `<a href="tel:${escapeHtml(cleanTel)}" class="contact-link">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.7;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>${escapeHtml(tel)}</span>
          </a>`;
        }).join('');
      }
    }

    // 5. Section Contact - Emails
    if (profile.emails && Array.isArray(profile.emails) && profile.emails.length > 0) {
      const elEmails = document.getElementById('contact-emails-list');
      if (elEmails) {
        elEmails.innerHTML = profile.emails.map(email => {
          return `<a href="mailto:${escapeHtml(email)}" class="contact-link">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.7;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span>${escapeHtml(email)}</span>
          </a>`;
        }).join('');
      }
    }

    // 6. Section Contact - GitHub & Localisation
    if (profile.github) {
      const elGithub = document.getElementById('contact-github-link');
      if (elGithub) {
        elGithub.href = profile.github;
        elGithub.textContent = profile.github.replace(/^https?:\/\//, '');
      }
    }

    if (profile.location) {
      const elLoc = document.getElementById('contact-location-text');
      if (elLoc) {
        elLoc.textContent = profile.location;
      }
    }
  }

  // A. Immediately apply cached configuration to prevent layout shift
  try {
    const cached = localStorage.getItem('portfolio_config');
    if (cached) {
      const data = JSON.parse(cached);
      if (data && data.profile) applyProfileConfig(data.profile);
      if (data && data.cv) applyCvConfig(data.cv);
    }
  } catch (e) {
    // ignore JSON cache errors
  }

  // B. Fetch fresh configuration from server
  fetch('/api/config')
    .then(res => res.json())
    .then(data => {
      if (data) {
        if (data.profile) applyProfileConfig(data.profile);
        if (data.cv) applyCvConfig(data.cv);
        try {
          localStorage.setItem('portfolio_config', JSON.stringify(data));
        } catch (e) {}
      }
    })
    .catch(err => {
      console.warn('Config sync info:', err);
    });
}
