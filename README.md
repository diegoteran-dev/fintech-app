# Vault

A global personal finance platform that helps people protect their money from inflation and invest in stocks and crypto. Built for Latin America first, expanding globally.

## Stack

| Layer    | Tech                              | Port |
| -------- | --------------------------------- | ---- |
| Web      | React + TypeScript (Vite)         | 3000 |
| Backend  | Python FastAPI + SQLite           | 8000 |
| Mobile   | React Native (Expo)               | —    |
| Shared   | TypeScript types & utils          | —    |

## Project Structure

```
vault/
├── apps/
│   ├── web/          # React + TypeScript web frontend
│   ├── backend/      # Python FastAPI + SQLite
│   ├── mobile/       # Expo React Native (iOS/Android)
│   └── api/          # Node.js/Express (legacy TS API)
└── packages/
    └── shared/       # Shared TypeScript types and utilities
```

## Getting Started

### Web (React + TypeScript)

```bash
cd apps/web
pnpm install
pnpm dev
```

### Backend (Python FastAPI)

```bash
cd apps/backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python main.py
```

API docs available at `http://localhost:8000/docs` (Swagger UI).

### Mobile (Expo)

```bash
cd apps/mobile
pnpm install
pnpm start
```

## Features (Roadmap)

- [ ] User authentication
- [ ] Portfolio dashboard
- [ ] Stock market investing
- [ ] Crypto investing
- [ ] Inflation protection tools
- [ ] Multi-currency support
