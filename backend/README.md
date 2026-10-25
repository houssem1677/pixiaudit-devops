# PixiAudit — Backend

API NestJS du projet PixiAudit — PFE PixiMind 2026.

## Prérequis

- Node.js 20+
- npm
- Docker Desktop
```bash
node -v
npm -v
docker -v
```

## Installation
```bash
git clone https://github.com/houssem1677/pixiaudit-backend.git
cd pixiaudit-backend
npm install
```

## Variables d'environnement

Créer un fichier `.env` à la racine :
```env
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5433
DATABASE_USER=pixiaudit
DATABASE_PASSWORD=pixiaudit123
DATABASE_NAME=pixiaudit_db
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=7d
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_gmail_app_password
MAIL_FROM=noreply@pixiaudit.com
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## Lancer PostgreSQL + Redis avec Docker
```bash
docker compose up -d
```

Vérifier que les containers tournent :
```bash
docker ps
```

Tu dois voir :
```
pixiaudit_postgres   Up   0.0.0.0:5433->5432/tcp
pixiaudit_redis      Up   0.0.0.0:6379->6379/tcp
```

Arrêter les containers :
```bash
docker compose down
```

Arrêter et supprimer toutes les données :
```bash
docker compose down -v
```

## Lancer le backend
```bash
npm run start:dev
```

API disponible : http://localhost:3001




## Stack

- NestJS + TypeScript
- PostgreSQL + Prisma
- Redis + BullMQ
- JWT + bcrypt

## Équipe

Houssem Ezzeddine · Mahdi Njeh — PixiMind © 2026