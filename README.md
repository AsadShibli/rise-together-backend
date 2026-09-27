# Rise Together API

The API for the Rise Together poster site. It stores accounts and posters, and builds the poster picture.

Live API: https://rise-together-api.onrender.com

Health check: https://rise-together-api.onrender.com/health

The site that calls this API is https://rise-together-ten.vercel.app

## Run locally

Copy `.env.example` to `.env` and fill in the values. Do not commit `.env`.

```bash
npm install
npm run dev
```

The server listens on http://localhost:4000 after MongoDB connects. `GET /` has no page. Use `GET /health`.

`npm run seed` loads the poster designs.

## What it serves

- `/api/auth` — register, log in, the current account, and a password change.
- `/api/templates` — the designs people can choose.
- `/api/upload` — a leader photo.
- `/api/posters` — save a poster, build the picture, and download it.
- `/api/admin` — counts, designs, and review. An admin account is required.
