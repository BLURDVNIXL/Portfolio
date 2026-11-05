# Plan d'Architecture & Sécurité Backend — Portfolio Daniel Adjiri

Refonte complète du backend Node/Express (`server.ts`) pour éliminer les vulnérabilités critiques, sécuriser l'administration avec des tokens HMAC horodatés, garantir la persistance pérenne sur Vercel (via synchronisation GitHub API / JSON) et intégrer un résolveur d'aperçus en direct pour médias externes (Google Drive, YouTube, Vimeo).

---

## Synthèse des Décisions & Choix Utilisateur

> [!IMPORTANT]
> Les trois arbitrages stratégiques validés avec Daniel (@BLURDVNIXL) :
> 1. **Stockage & Persistance Vercel :** Synchronisation directe avec le fichier JSON du dépôt GitHub (`data/creations.json` via GitHub API avec fallback local). Solution 100% gratuite, versionnée sous git, sans base de données payante, garantissant zéro perte de données sur Vercel.
> 2. **Sécurité & Authentification :** Suppression de la backdoor en dur `daniel2026`. Protection par variable d'environnement `ADMIN_PASSCODE`, génération de tokens cryptographiques signés HMAC-SHA256 avec horodatage (expiration 24h), et rate-limiter anti-brute-force sur `/api/admin/login`.
> 3. **Gestion des Médias :** Liens externes (Google Drive, YouTube, CDN) avec résolveur d'aperçus automatique (conversion des liens Drive en URLs d'affichage direct `lh3.googleusercontent.com/d/ID` et vignettes YouTube HD).

---

## 1. Vue d'Ensemble & Objectifs

- **Problème résolu :** Corriger la vulnérabilité d'accès administrateur, empêcher la perte de données inhérente au filesystem éphémère de Vercel, et supprimer les risques liés aux uploads non filtrés tout en permettant d'afficher des aperçus riches de vidéos et documents hébergés sur Google Drive.
- **Bénéficiaire :** Daniel Adjiri pour la gestion autonome et sans risque de son portfolio d'ingénieur/créatif, et les visiteurs (recruteurs, jurys, clients) pour des temps de réponse rapides et sécurisés.
- **Critère de succès :** Zéro faille OWASP sur l'authentification, persistance vérifiée des créations après redémarrage Vercel, et affichage instantané des prévisualisations de fichiers Drive et YouTube.

---

## 2. Expérience Utilisateur & Parcours

### Parcours Administrateur
```
[Visiteur ou Daniel]
       │
       ▼
[URL secrète /admin.html ou Ctrl+Shift+A]
       │
       ▼ Saisie du code d'accès
[Protection Anti-Brute-Force] ──── Max 5 tentatives erronées / 15 min
       │
       ▼ Validation contre process.env.ADMIN_PASSCODE
[Génération Token HMAC-SHA256 (24h)]
       │
       ▼ Interface CMS Admin
[Formulaire Projet : Saisie lien Google Drive ou YouTube]
       │
       ▼ Résolveur automatique en temps réel
[Aperçu visuel instantané dans la modale]
       │
       ▼ Clic Enregistrer
[Commit sécurisé GitHub API / Sauvegarde JSON locale]
       │
       ▼
[Mise à jour en direct du portfolio sans rechargement lourd]
```

---

## 3. Choix Techniques & Arbitrages

### Arbitrage 1 : GitHub Contents API vs Vercel Blob pour la persistance
- **Choix retenu :** GitHub API (`/repos/BLURDVNIXL/Portfolio/contents/data/creations.json`) avec fallback local bidirectionnel.
- **Pourquoi :** Vercel Blob nécessite un compte bancaire et un token propriétaire Vercel. L'API GitHub utilise un simple *Personal Access Token* gratuit, garde l'historique complet des modifications (`git log`), et permet à Daniel d'éditer ses projets soit depuis son CMS admin, soit directement dans VS Code / GitHub.
- **Alternative écartée :** Base SQL Supabase (trop lourde pour un portfolio personnel de 10 à 50 projets).

### Arbitrage 2 : Token signé HMAC vs JSON Web Token (JWT) externe
- **Choix retenu :** Signature HMAC-SHA256 native via le module standard Node.js `crypto` (`crypto.createHmac('sha256', SECRET)`).
- **Pourquoi :** Zéro dépendance npm supplémentaire, performances optimales, signature infalsifiable contenant `{ role: 'admin', timestamp, expiry }`.
- **Alternative écartée :** `jsonwebtoken` tiers (superflu pour un profil mono-administrateur).

### Arbitrage 3 : Résolution d'URLs Google Drive
- **Choix retenu :** Parser d'URL universel côté serveur et client. Détection de l'ID Drive (`/d/FILE_ID/` ou `id=FILE_ID`) et transformation en :
  - Aperçu image directe : `https://lh3.googleusercontent.com/d/FILE_ID=w1200`
  - Lecteur vidéo/document intégré : `https://drive.google.com/file/d/FILE_ID/preview`
- **Pourquoi :** Permet à Daniel de stocker ses affiches et films HD sur son Google Drive personnel sans saturer son serveur, tout en offrant un rendu visuel immédiat dans le portfolio.

---

## 4. Architecture Technique & Flux de Données

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Navigateur)                           │
│  - index.html (Portfolio public)    - admin.html (CMS Daniel)          │
│  - Resolveur de media en temps réel (Aperçu Drive / YouTube)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Requêtes HTTP Fetch
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SERVEUR EXPRESS (server.ts)                     │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                Couche Sécurité & Middlewares                    │  │
│  │  - Limiteur de débit (Rate-limit: 5 essais / 15 min)             │  │
│  │  - Vérification Token HMAC-SHA256 (Header Authorization)         │  │
│  │  - Helmet & En-têtes HTTP de protection                          │  │
│  │  - Parser JSON strict (limite réduite à 5 Mo)                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                   │                                    │
│  ┌────────────────────────────────▼─────────────────────────────────┐  │
│  │                       Contrôleurs d'API                          │  │
│  │  POST /api/admin/login     ➔ Vérif code + émission token HMAC   │  │
│  │  GET  /api/creations       ➔ Lecture cache local / GitHub API   │  │
│  │  POST /api/creations       ➔ Validation + Commit GitHub / Local  │  │
│  │  PUT  /api/creations/:id   ➔ Mise à jour projet                  │  │
│  │  DELETE /api/creations/:id ➔ Suppression projet                 │  │
│  │  POST /api/media/preview   ➔ Résolution métadonnées Drive/YT     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                   │                                    │
│  ┌────────────────────────────────▼─────────────────────────────────┐  │
│  │                   Couche Persistance Hybride                     │  │
│  │  1. Mémoire cache pour lectures instantanées                     │  │
│  │  2. Fichiers locaux data/creations.json (mode dev / backup)      │  │
│  │  3. GitHub API Octokit/Fetch (mode prod Vercel)                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Plan d'Exécution Détaillé

### Étape 1 : Sécurisation de `server.ts`
- Éliminer la chaîne `daniel2026` et la backdoor de connexion.
- Implémenter l'algorithme HMAC avec sel aléatoire ou `process.env.ADMIN_SECRET`.
- Ajouter le limiteur de débit sur `/api/admin/login`.
- Remplacer les opérations de fichiers synchrones (`readFileSync`, `writeFileSync`) par des opérations asynchrones `fs.promises`.

### Étape 2 : Module de Résolution & Aperçu Drive / YouTube
- Ajouter la route `/api/media/preview` pour extraire les métadonnées et convertir automatiquement les liens Drive en URLs d'affichage sécurisées.
- Adapter les cartes projets du portfolio pour supporter les aperçus Drive nativement.

### Étape 3 : Module de Synchronisation GitHub pour Vercel
- Créer un connecteur asynchrone pour mettre à jour `data/creations.json` directement sur le dépôt GitHub si un token `GITHUB_TOKEN` est présent, avec fallback automatique sur le système de fichiers local.

### Étape 4 : Tests & Validation
- Vérifier la résistance aux tentatives de brute-force.
- Tester l'émission et l'expiration des tokens d'administration.
- Compiler et valider sans avertissement TypeScript.
