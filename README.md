# White Tiger GG

Operations portal for the **WHITE TIGER** GTA 5 Roleplay faction.

## Features

- **Streaming Monitor** — multi-stream YouTube live dashboard with auto-assignment
- **Player Finder** — live FiveM server roster search

## Local development

```bash
npm install
cp .env.example .env.local
```

Add your YouTube Data API v3 key to `.env.local`:

```env
YOUTUBE_API_KEY=your_youtube_data_api_v3_key
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `YOUTUBE_API_KEY` | Yes (Streaming) | YouTube Data API v3 key — **server-side only** |

Never commit `.env.local`. Use `.env.example` as a template.

## Deploy on Vercel

This project is configured for Vercel's Next.js preset.

**Build command:** `npm run build`  
**Output directory:** (default — leave empty)  
**Install command:** `npm install`  
**Node.js version:** 20.x or later

After importing the repo, add `YOUTUBE_API_KEY` under **Project Settings → Environment Variables** for Production, Preview, and Development. Redeploy after saving.
