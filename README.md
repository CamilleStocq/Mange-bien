# Mange bien ! — repas, batch cooking, sport & progression

Application web personnelle (PWA) installable sur iPhone, en français, pensée pour savoir chaque jour :
quoi manger et en quelles quantités, quoi cuisiner le dimanche, quoi acheter, quoi sortir du congélateur,
où en est le budget, quelle activité est autorisée et comment évolue la progression. Le tout sans pression.

---

## 1. Architecture en bref

| Élément | Choix | Pourquoi |
|---|---|---|
| Interface | **React 19 + TypeScript**, Vite | Écosystème standard, typage strict, build rapide |
| PWA | **vite-plugin-pwa** (service worker Workbox personnalisé `src/sw.ts`) | Installation sur l’écran d’accueil, fonctionnement hors ligne, réception des push |
| Données | **IndexedDB** (via `idb-keyval`) + store **zustand** | Données persistantes, 100 % locales, aucune inscription |
| Graphiques | **Recharts** (chargé à la demande) | Graphiques fiables, accessibles, légers pour l’écran d’accueil |
| Notifications | **Web Push standard** (VAPID) + **Cloudflare Worker** avec tâche planifiée chaque minute | Seule façon d’avoir de vrais rappels **app fermée** sur iPhone |
| Hébergement | **Cloudflare Workers** (gratuit) : un seul déploiement sert l’app ET le serveur de rappels | HTTPS inclus (obligatoire pour une PWA), pas de serveur à maintenir |

### Stratégie de stockage
Toutes les données (recettes, repas, calendrier, courses, pesées, douleurs, hydratation, réglages) sont dans
l’IndexedDB de l’appareil. Les photos de recettes sont stockées à part (redimensionnées). Export / import JSON
dans Réglages → Mes données.

### Stratégie de notifications sur iPhone
1. L’app calcule elle-même les rappels des **21 prochains jours** à partir du planning, des horaires et des
   préférences, en heure de **Bruxelles** convertie en UTC (changements d’heure gérés et testés).
2. Elle envoie cette liste à **ton** serveur (Cloudflare Worker) à chaque modification et à chaque ouverture.
3. Chaque minute, le Worker envoie les rappels arrivés à échéance via le service push d’Apple
   (chiffrement RFC 8291, authentification VAPID — implémentés sans dépendance, testés contre la
   bibliothèque de référence).
4. Sans serveur, ou si les notifications sont refusées, l’app fonctionne normalement ; les rappels ne
   s’affichent alors que lorsque l’app est ouverte.

**Ce que le serveur reçoit** : l’adresse technique de notification de l’iPhone (fournie par Apple), une
empreinte du jeton de l’appareil, et le titre + texte + heure des rappels à venir. Jamais de poids, de
douleurs ni de données de santé. Le **mode discret** retire aussi les noms de repas.

---

## 2. Installer et lancer en local (sur ton ordinateur)

Prérequis : [Node.js 20 ou plus récent](https://nodejs.org).

```bash
npm install
```

Interface seule (rechargement à chaud, sans notifications push) :

```bash
npm run dev
```

Application complète avec le serveur de rappels local :

```bash
npm run vapid
```

Copie `.dev.vars.example` en `.dev.vars` et colle les deux clés affichées, puis choisis un `ACCESS_CODE`.
Ensuite :

```bash
npm run worker:dev
```

L’app est sur http://127.0.0.1:8787. (Sous Windows, si le stockage local de Wrangler échoue à cause d’un
chemin trop long, déplace le projet dans un dossier au chemin court, par ex. `C:\dev\moncap`.)

Tests automatisés :

```bash
npm test
```

---

## 3. Déployer (Cloudflare, gratuit) — étape par étape

1. Crée un compte gratuit sur https://dash.cloudflare.com/sign-up.
2. Connecte l’outil en ligne de commande (une page de connexion s’ouvre) :
   ```bash
   npx wrangler login
   ```
3. Crée le stockage des abonnements :
   ```bash
   npx wrangler kv namespace create KV
   ```
   Copie l’`id` affiché dans `wrangler.toml` à la place de `REMPLACE_MOI_PAR_L_ID_KV`.
4. Génère les clés de notification :
   ```bash
   npm run vapid
   ```
5. Enregistre les 4 secrets (chaque commande te demande la valeur) :
   ```bash
   npx wrangler secret put VAPID_PUBLIC_KEY
   ```
   ```bash
   npx wrangler secret put VAPID_PRIVATE_KEY
   ```
   ```bash
   npx wrangler secret put VAPID_SUBJECT
   ```
   (valeur : `mailto:` suivi de ton adresse e-mail — Apple l’exige)
   ```bash
   npx wrangler secret put ACCESS_CODE
   ```
   (un code de ton choix : il empêche des inconnus d’utiliser ton serveur)
6. Déploie :
   ```bash
   npm run deploy
   ```
   L’adresse s’affiche, du type `https://mange-bien.<ton-sous-domaine>.workers.dev`.

Pour publier une nouvelle version plus tard : `npm run deploy`. L’app installée se met à jour seule à
l’ouverture suivante. Tes données restent sur l’iPhone.

---

## 4. Installer sur l’iPhone et activer les notifications

1. Ouvre l’adresse de l’app dans **Safari**.
2. Bouton **Partager** → **Sur l’écran d’accueil** → **Ajouter**.
3. Ouvre **Mange bien ! depuis l’icône** (pas depuis Safari) et fais la configuration de départ.
4. Réglages (roue dentée) → **Notifications** → **Autoriser les notifications** → accepte la demande d’iOS.
5. Saisis ton **code d’accès** → **Activer les rappels**.
6. Touche **« Push dans ~2 minutes »**, ferme l’app, attends : si la notification arrive, tout fonctionne.

Conditions : iOS **16.4 ou plus récent**. Les modes Concentration peuvent retarder / masquer les
notifications ; ajustements dans Réglages iPhone → Notifications → Mange bien !.

---

## 5. Ce qui a été vérifié

- **55 tests automatisés** (`npm test`) : dates et semaines, conversions Bruxelles ↔ UTC autour des changements
  d’heure (25/10/2026 et 28/03/2027, heures inexistantes / doublées), génération de semaine (uniquement tes
  recettes, rotation variée, samedi libre, collations les jours de coaching), règles frigo / congélateur
  (riz ≤ 24 h, plats ≤ 3 jours), quantités (3 × 120 g = 360 g, pas de doublons, regroupement casse / accents / œ),
  stock déduit, suppression / remplacement / modification de recette répercutés sur courses et batch,
  portions en plus à congeler, budget (suggestions sans jamais réduire les portions), rappels (heures, heures
  calmes, pause, mode discret, sport seulement si autorisé, pesée), absence de messages culpabilisants sur 60
  jours, tendance du poids, chiffrement Web Push déchiffré par la bibliothèque de référence `http_ece`,
  signature VAPID vérifiée, API du serveur (code d’accès, jetons, fenêtre d’envoi, abonnement expiré).
- **Dans un navigateur à taille iPhone (390 × 844)**, clair et sombre : configuration de départ, écran
  Aujourd’hui, hydratation, calendrier semaine / mois, journée détaillée, remplacement d’un repas avec
  recalcul du batch, batch cooking, courses, sport, alerte de symptômes d’urgence, progression, notifications
  (cas « permission refusée » affiché proprement), persistance après rechargement.
- **Serveur sous workerd** (le moteur de Cloudflare, en local) : abonnement, mauvais code refusé,
  programmation, tâche planifiée qui envoie le rappel échu, chiffrement et signature exécutés.

**Non vérifié** (impossible sans ton iPhone et ton compte) : la réception réelle d’une notification sur
iPhone via le service push d’Apple. Le test « Push dans ~2 minutes » sert exactement à ça.

---

## 6. Limites connues et solutions

| Limite | Solution / contournement |
|---|---|
| Rappels app fermée = serveur nécessaire | Déploiement Cloudflare gratuit ci-dessus. Sans lui : rappels seulement app ouverte. |
| Les rappels couvrent 21 jours d’avance | Ils sont prolongés à chaque ouverture. Si l’app n’est pas ouverte 3 semaines, ils s’arrêtent jusqu’à la prochaine ouverture. |
| Rappel « étapes restantes du batch » générique | Le serveur ne connaît pas l’état de ta checklist (données locales). |
| Prix = estimations indicatives | Modifie-les (Réglages → Ingrédients & prix) ou utilise « Mettre à jour mes prix avec ces prix réels » après les courses. Le coût est proportionnel aux quantités utilisées, pas aux paquets entiers. |
| Quantités des recettes provisoires | Marquées « provisoire » jusqu’à ce que tu les corriges ou confirmes. |
| Repères nutritionnels approximatifs | Tables générales ; aucun objectif calorique n’est imposé. |
| Données uniquement sur l’iPhone | Exporte régulièrement (Réglages → Mes données). Supprimer l’icône supprime les données. Pas de synchronisation entre appareils. |
| Photos non incluses dans l’export | Elles restent sur l’appareil. |
| Semaine vidée volontairement | La semaine en cours et la suivante sont regénérées automatiquement si elles ne contiennent aucun repas. |

---

## 7. Structure du projet

```
mange-bien/
├─ index.html                 page hôte (métadonnées iPhone)
├─ vite.config.ts             build + manifeste PWA
├─ wrangler.toml              déploiement Cloudflare (app + serveur + cron)
├─ public/icons/              icônes (générées par scripts/gen-icons.mjs)
├─ scripts/                   génération des icônes et des clés VAPID
├─ src/
│  ├─ main.tsx, App.tsx       démarrage, navigation, gestion d’erreurs
│  ├─ sw.ts                   service worker (hors ligne + push)
│  ├─ styles.css              thème pastel clair / sombre, titres en Outfit (auto-hébergée)
│  ├─ store/                  types de données + stockage IndexedDB
│  ├─ data/                   recettes de départ, catalogue d’ingrédients, réglages par défaut
│  ├─ lib/                    logique testable : dates/fuseau, planning, courses, batch, rappels, stats, push
│  ├─ components/             composants réutilisables (repas, journée, sport, hydratation, UI)
│  └─ pages/                  Aujourd’hui, Calendrier, Alimentation, Recette, Batch, Courses, Sport,
│                             Progression, Notifications, Réglages, Configuration de départ
├─ worker/                    serveur de rappels (Cloudflare Worker) + Web Push en WebCrypto
└─ tests/                     tests Vitest
```

## 8. Santé

L’application ne remplace pas l’avis de ton médecin ou de ton kiné. Elle démarre en **phase de récupération**,
ne programme aucune séance d’elle-même, ne propose que des activités que tu as indiquées comme autorisées,
et n’augmente jamais la charge automatiquement. En cas de nouvelle faiblesse importante d’une jambe, de perte de
sensibilité du périnée ou de troubles de la vessie / des intestins : **112** ou les urgences sans attendre.
