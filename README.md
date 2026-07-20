# Backend Boilerplate — Node / Express / TypeScript / Prisma / PostgreSQL

Socle réutilisable : authentification JWT (access + refresh) + CRUD générique
avec permissions par ressource (owner vs admin). Postgres tourne dans Docker,
l'API tourne en local pour garder le hot-reload.

## Démarrage

### 1. Lancer la base de données
```bash
docker compose up -d
```
Vérifie que le conteneur tourne : `docker ps`

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer l'environnement
```bash
cp .env.example .env
```
Modifie `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` avec des valeurs aléatoires
(ex: `openssl rand -hex 32`).

### 4. Générer le client Prisma + migration
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Lancer le serveur en dev
```bash
docker compose up -d
npm run dev
```
Le serveur tourne sur http://localhost:3000. Teste avec :
```bash
curl http://localhost:3000/health
```

## Endpoints disponibles

### Auth (`/api/auth`)
- `POST /register` — `{ email, password }` → crée un compte, retourne les tokens (rate limité: 10 req/15min/IP)
- `POST /login` — `{ email, password }` → retourne accessToken + refreshToken (rate limité)
- `POST /refresh` — `{ refreshToken }` → retourne un nouvel accessToken **et** un nouveau refreshToken (rotation : l'ancien est invalidé)
- `POST /logout` — `{ refreshToken }` → révoque ce refresh token
- `GET /me` — protégé, retourne les infos de l'utilisateur connecté
- `POST /change-password` — protégé, `{ currentPassword, newPassword }` → change le mot de passe et révoque toutes les sessions actives (déconnexion partout)

**Important** : depuis la rotation des refresh tokens, il faut stocker le
nouveau `refreshToken` retourné par `/refresh` à chaque appel (l'ancien ne
fonctionne plus).

### Tasks (`/api/tasks`) — protégé, header `Authorization: Bearer <accessToken>`
- `GET /` — liste paginée (`?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc&done=true`)
- `GET /:id` — détail
- `POST /` — `{ title, description? }`
- `PATCH /:id` — `{ title?, description?, done? }`
- `DELETE /:id`

Règle de permission : un `USER` ne voit/modifie que ses propres tasks, un
`ADMIN` voit tout. Pour passer un utilisateur en admin, modifie son rôle
directement en base ou via `npx prisma studio`.

## Mettre à jour un projet déjà en place

Si tu avais déjà lancé le projet avant l'ajout de la révocation des refresh
tokens (modèle `RefreshToken`), applique la mise à jour :
```bash
npm install
npx prisma generate
npx prisma migrate dev --name add_refresh_tokens
```

## Dockeriser l'API complète (au-delà du dev local)

En dev quotidien, tu continues avec `docker compose up -d` (juste Postgres) +
`npm run dev` en local — c'est le plus rapide grâce au hot-reload.

Le service `api` dans `docker-compose.yml` sert à **simuler la prod** ou à
livrer le projet sans que le client ait besoin d'installer Node. Il est
volontairement mis dans un profil `full` pour ne pas se lancer par défaut et
ne pas ralentir ton usage quotidien.

### Builder et lancer l'API dockerisée
```bash
docker compose --profile full up -d --build
```
Ça construit l'image (multi-stage : compile le TypeScript, puis image de prod
allégée sans les devDependencies), lance les migrations automatiquement au
démarrage (`prisma migrate deploy`), et démarre le serveur sur le port 3000 —
exactement comme en dev, mais dans un environnement isolé et reproductible.

### Revenir au workflow de dev normal
```bash
docker compose down
docker compose up -d
```
Ça arrête tout (y compris le service `api`) puis relance juste Postgres.

### Point d'attention
Le service `api` lit `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` depuis ton
`.env` local (Docker Compose les injecte automatiquement s'ils sont dans un
fichier `.env` à la racine). Vérifie que ton `.env` est bien rempli avant de
lancer `--profile full`.

## Réutiliser ce boilerplate pour un nouveau projet client

Le vrai actif réutilisable, c'est le pattern, pas juste le code :

1. **Auth** : copier tel quel `modules/auth`, `middlewares/auth.middleware.ts`,
   `utils/jwt.ts` — ne change quasiment jamais d'un projet à l'autre.
2. **CRUD générique** : dupliquer le dossier `modules/tasks` en le renommant
   pour la nouvelle entité (ex: `modules/clients`, `modules/interventions`).
   Le schéma Prisma, le `.schema.ts` (validation Zod) et les champs métier
   changent, mais la structure service/controller/routes reste identique.
3. **Permissions par ressource** : le pattern `ownershipFilter` +
   `assertCanAccess` dans `task.service.ts` est le modèle à reprendre pour
   toute nouvelle ressource qui doit être filtrée par propriétaire.

## Documentation API

### Swagger UI (interactif, dans le navigateur)
Une fois le serveur lancé (`npm run dev`), va sur :
```
http://localhost:3000/api/docs
```
Tu peux tester tous les endpoints directement depuis le navigateur (bouton
"Authorize" en haut pour coller ton `accessToken` et tester les routes
protégées). La spec est dans `src/docs/openapi.json` — à mettre à jour à la
main quand tu ajoutes/modifies une route.

### Collection Postman
Le fichier `postman/backend-boilerplate.postman_collection.json` contient
toutes les routes (auth + tasks), avec des scripts qui **remplissent
automatiquement** les variables `accessToken`, `refreshToken` et `taskId`
après chaque appel réussi — pas besoin de copier-coller les tokens à la
main entre les requêtes.

Pour l'utiliser :
1. Ouvre Postman → Import → sélectionne le fichier
2. Lance "Register" ou "Login" en premier (ça remplit `accessToken`
   automatiquement)
3. Les autres requêtes utilisent déjà `{{accessToken}}` dans leurs headers

## Tests automatisés

Tests Jest + Supertest sur l'auth complète et les permissions du CRUD
(owner vs admin). Ils tournent contre une **vraie base Postgres séparée**
(`boilerplate_test`) dans le même conteneur Docker que le dev — pas de mock,
ça teste le vrai comportement avec Prisma.

### Créer la base de test (une seule fois)
```bash
docker exec -it boilerplate_postgres psql -U dev -c "CREATE DATABASE boilerplate_test;"
```

### Appliquer le schéma sur la base de test
```bash
DATABASE_URL="postgresql://dev:dev@localhost:5432/boilerplate_test?schema=public" npx prisma migrate deploy
```
(à refaire à chaque nouvelle migration créée avec `prisma migrate dev`)

### Lancer les tests
```bash
npm test
```

Les tests nettoient les tables avant chaque test (`beforeEach`) pour rester
indépendants les uns des autres — pas besoin de réinitialiser la base
manuellement entre deux lancements.

### Ce qui est couvert
- **Auth** : register (succès, email dupliqué, mot de passe trop court),
  login (succès, mauvais mot de passe, email inconnu), `/me` (avec/sans
  token), refresh avec rotation (l'ancien token doit devenir invalide),
  logout (révocation), change-password (révoque les sessions existantes).
- **Tasks** : CRUD complet pour son propre compte, isolation entre users
  (un user ne voit/ne peut pas toucher les tasks d'un autre → 403), et accès
  admin à toutes les ressources.

## Prochaines étapes possibles

- Déploiement sur Railway/Render (l'image Docker est prête pour ça).
