# ShoFlow — landing page

Marketing site for [ShoFlow](https://shoflow.io), a native macOS dashboard for
your AI agents (Claude Code & Cowork). Built with **Astro + Tailwind**, adapted
from the AgentDesk landing repo with a light/warm, editorial design inspired by
wisprflow.ai and ShoFlow's own brand (cream paper · cocoa ink · coral accent ·
Newsreader serif).

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output → dist/
npm run preview
```

## Editing

- **Copy / structure:** `src/pages/index.astro` (hero, features, CTA, footer) and `src/components/Header.astro` (nav).
- **Design tokens:** `tailwind.config.mjs` (colors, fonts) and `src/styles/global.css`.
- **Download link:** the `DOWNLOAD_URL` const in `Header.astro` and `index.astro`
  → point it at the hosted DMG (e.g. `https://releases.shoflow.io/mac/…`).
- **Hero screenshot:** `public/screenshots/app.png` — **replace this placeholder**
  with a polished full-window ShoFlow capture (≈2000×1250).
- **OG image:** add `public/og-image.png` (referenced in `Layout.astro`).

## Deploy

Static site — host the `dist/` output on any static host (Cloudflare Pages,
Vercel, Netlify, GitHub Pages) mapped to `shoflow.io`.
