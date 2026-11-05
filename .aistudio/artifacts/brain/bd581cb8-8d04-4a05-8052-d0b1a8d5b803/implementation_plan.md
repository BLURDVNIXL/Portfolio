# Plan d'implémentation — Portfolio Officiel d'ADJIRI N’DA ÉLIE DANIEL

Transformation complète du portfolio pour **Daniel Adjiri (@BLURDVNIXL)** : élève-ingénieur CPGE (MP2I/MPI) à l'INP-HB, développeur et créatif audiovisuel.

---

## 1. Hero 3D Réactif & Ambiance Audio Personnalisable

### A. Déplacement de la Caméra 3D asservi à la souris (avec dérive procédurale)
- **Dérive continue préservée** : La caméra continue son voyage cinématique organique le long de la spline de la vallée de fleurs avec ses variations d'altitude et turbulences mathématiques.
- **Réactivité fluide à la souris (Parallaxe & Regard)** :
  - La position de la souris applique un décalage physique bidimensionnel lissé (lerp) sur la caméra : inclinaison subtile (pitch/yaw/roll) et léger déplacement latéral suivant la position du curseur.
  - Au déplacement du curseur, les fleurs s'écartent interactivement grâce au shader GLSL (`uMouse` & `uMousePush`), créant un sillage physique dans la végétation.
  - L'expérience reste 100% fluide et s'adapte au trackpad et au gyroscope sur mobile.

### B. Gestionnaire de Musique d'Ambiance dans le Panel Admin
- Possibilité pour Daniel de choisir l'ambiance sonore du Hero directement depuis le Panel Admin :
  1. **Synthétiseur Procédural Génératif (Défaut)** : Synthèse Web Audio temps réel sans téléchargement, atmosphère planante et apaisante.
  2. **Bande Son Audio Personnalisée (MP3 / OGG / WAV)** :
     - Téléversement direct d'un fichier audio (ex: le thème musical du court-métrage *"Le prix du prestige"* ou musique cinématique).
     - Ou saisie d'une URL de flux audio externe (SoundCloud / CDN).
     - Réglage du volume d'écoute et du fondu progressif.
  - Le bouton sonore interactif (`#sound`) du Hero respecte immédiatement ce choix avec indicateur d'ondes animées.

---

## 2. Profil Réel & Identité Officielle

- **Nom** : ADJIRI N’DA ÉLIE DANIEL (`BLURDVNIXL`)
- **Titre** : Élève-Ingénieur CPGE (MP2I/MPI) à l'INP-HB · Développeur Full-Stack & Réalisateur
- **GitHub** : [https://github.com/BLURDVNIXL](https://github.com/BLURDVNIXL)
- **Coordonnées** :
  - Téléphones : `+225 07 78 78 02 55` / `+225 01 70 14 37 77` / `+225 07 79 81 59 33`
  - Emails : `adjirieliedaniel@gmail.com` / `nda.adjiri25@inphb.ci`
  - Établissement : INP-HB (Institut National Polytechnique Félix Houphouët-Boigny, Yamoussoukro / Abidjan)

---

## 3. Hub des Créations & Projets Authentiques Pré-chargés

Transition cinématographique au défilement vers le Hub de créations :

### A. Montages Vidéo (Lecteur Lightbox YouTube Haute Définition)
1. **"Le prix du prestige"** — Court-métrage de fiction (Réalisateur & co-scénariste avec DATA CORPORATION, équipe de 16 personnes, After Effects / Premiere).
2. **"Noël de partage 2025"** — Aftermovie officiel (Association des Caïmans Techno 25 INP-HB).
3. **"Cérémonie de Binômage CPGE 2025/2026"** — Vidéo officielle d'intégration des prépas.

### B. Affiches & Design Graphique (Zoom Plein Écran)
1. **Affiche officielle — "Le prix du prestige"** (Direction artistique sombre, retouche Photoshop, composition typographique).
2. **Affiches événementielles — "Noël de partage" & "Binômage Caïmans Techno 25"** (INP-HB).
3. **Identité visuelle & Branding — DATA CORPORATION**.

### C. Applications, Algorithmes & Code (Démos Photo/Vidéo & Code)
1. **Algorithme d'Appairage & Plateforme de Binômage CPGE** (matching automatisé en Python / Web / SQL pour les prépas de l'INP-HB).
2. **Plateforme de services — DATA CORPORATION** (service de programmation et design).
3. **Vallée 3D interactive & Shaders GLSL** (ce hero Three.js génératif).
4. **Mini-compilateur & Analyseur syntaxique** (OCaml / C).

---

## 4. Section CV & Parcours Interactif

- **Formations** :
  - CPGE MPI (2ème année, 2026/2027) & MP2I (1ère année, 2025/2026) à l'INP-HB.
  - Baccalauréat C Mention Bien au Lycée Classique d'Abidjan (2025).
  - BEPC Mention Très Bien au Collège Saint-Paul Riviera M'Badon (2022).
  - Diplôme d'excellence scientifique décerné par l'ONG EFODEV-CI (décembre 2022).
  - CEPE Mention Très Bien (2018).
- **Responsabilités** : Chef Adjoint Communication (Caïmans Techno 25 INP-HB), Chef section programmation (DATA CORPORATION), Réalisateur "Le prix du prestige", Membre Label Prestige & Schrödinger.
- **Compétences** : Python, C, OCaml, SQL, HTML, CSS, JavaScript, After Effects, Photoshop, Anglais, Français.
- **Actions** : Téléchargement du CV, appels directs en 1 clic et liens GitHub.

---

## 5. Panel Admin Sécurisé (CMS Personnel)

Accessible via `/admin` ou clic discret sécurisé :
- **Authentification par code d'accès administrateur**.
- **Gestionnaire Audio du Hero** : Choix entre le synthétiseur ambiant procédural ou téléversement d'un MP3 personnalisé avec volume réglable.
- **Gestion des projets (CRUD)** : Formulaires pour ajouter, modifier ou supprimer des vidéos YouTube, des affiches ou des applications.
- **Upload direct de médias** : Enregistrement des fichiers images et audio avec génération d'URL permanente.
- **Sauvegarde intégrale (Export/Import JSON)** : Téléchargement en 1 clic de l'ensemble du portfolio pour une sauvegarde physique.

---

## 6. Déploiement en Production

- **Google Cloud Run (Actif)** : accessible mondialement en HTTPS avec domaine sécurisé permanent.
- **Compatibilité tous hébergeurs** : Vercel, Netlify, Render, Railway ou domaine personnalisé (`.ci`, `.dev`, `.com`).

---

## 7. Plan d'Exécution

1. **Backend Full-Stack & Persistance** :
   - Mise en place de `server.ts` avec API REST pour les créations (`/api/creations`), la configuration du Hero/Audio (`/api/config`), et l'upload de médias (`/api/upload`).
   - Stockage persistant dans `data/creations.json` et `data/config.json`.
2. **Hero 3D avec Asservissement Souris & Audio Dynamique** :
   - Amélioration de `hero-three.js` : mouvement de caméra réactif à la souris combiné à la dérive aléatoire.
   - Support de la lecture du fichier MP3 personnalisé ou du synthétiseur procédural selon la configuration admin.
3. **Panel Admin Complet** :
   - Interface de gestion `/admin` avec gestionnaire audio, formulaires d'ajout/édition de créations, upload et sauvegarde.
4. **Interface Publique & CV d'Élie Daniel** :
   - Refonte complète de `index.html`, `portfolio.css` et `creations.css` intégrant l'identité réelle, la Lightbox YouTube/Affiches et la section CV interactive.
5. **Tests de validation** :
   - Vérification Playwright (souris, audio, lightbox, admin) et compilation de production.
