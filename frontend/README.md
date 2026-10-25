# PixiAudit — Frontend

Interface Next.js du projet PixiAudit — PFE PixiMind 2026.

## Prérequis

- Node.js 20+
- npm
```bash
node -v
npm -v
```

## Installation
```bash
git clone https://github.com/houssem1677/pixiaudit-frontend.git
cd pixiaudit-frontend
npm install
```

## Variables d'environnement

Créer un fichier `.env.local` à la racine :
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Lancer
```bash
npm run dev
```

Ouvrir : http://localhost:3000

## Structure
```
app/
├── (auth)/
│   ├── login/
│   ├── forgot-password/
│   └── reset-password/
├── dashboard/
└── audits/
components/
└── ui/              # shadcn/ui
lib/
└── axios.ts
```

## Stack

- Next.js 14 — App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Axios

## Équipe

Houssem Ezzeddine · Mahdi Njeh — PixiMind © 2026