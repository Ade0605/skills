# Hosting Lasgidi for everyone

Lasgidi is static files, so free hosts can serve it. The repository has a GitHub Pages workflow ready to use: `.github/workflows/lasgidi-pages.yml`.

## What works where

| | claude.ai artifact | Your own site (GitHub Pages, Netlify, Cloudflare Pages) |
|---|---|---|
| The whole single-player game, 3D, offline play, saves | ✅ | ✅ |
| Hall of Fame, weekly board, chat, live players, governor race, shared ads | ✅ | ❌ (these use the claude.ai sign-in and shared storage) |
| Real-money Style shop and top-ups | ❌ | Only with the Node shop server running somewhere (`npm run shop`) |

On your own site the game runs alone in each player's browser. Saves stay on their device. Shared boards and chat need claude.ai, or a backend added later.

## Option 1: GitHub Pages (free, HTTPS, deploys on every push)

1. Merge the pull request into `main`.
2. In the repository, open **Settings → Pages**. Under *Build and deployment*, set **Source** to **GitHub Actions**.
3. Open **Actions → "Lasgidi on GitHub Pages" → Run workflow**, or push any change under `lasgidi/`.
4. The site goes live at `https://ade0605.github.io/skills/`. `play.html` is the single-file build.

### Use your own domain, such as gidilife.app

You have to own the domain first. `.app` domains cost money at any registrar (Namecheap, Porkbun, Cloudflare, Google/Squarespace and others). Then:

1. In the repository, open **Settings → Secrets and variables → Actions → Variables** and add `LASGIDI_DOMAIN` = `gidilife.app`.
2. At your domain's DNS, add these records:
   - `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - `AAAA` records for `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
   - A `CNAME` record for `www`: `ade0605.github.io`.
3. Open **Settings → Pages**, enter `gidilife.app` as the custom domain and tick **Enforce HTTPS** once the certificate is ready. That can take up to a day. `.app` domains only work over HTTPS, and GitHub provides it for free.
4. Run the workflow again. The game is then at `https://gidilife.app`.

## Option 2: Netlify or Cloudflare Pages (free, drag and drop)

1. In `lasgidi/`, run `npm ci && npm run build`.
2. Make a folder holding `index.html`, `manifest.webmanifest`, `icon.svg`, `sw.js`, `src/`, `vendor/` and `img/`, plus `dist/lasgidi.html` renamed to `play.html`.
3. Drag the folder onto **app.netlify.com/drop**, or create a Cloudflare Pages project with *Direct upload*.
4. To add a custom domain, use the host's **Domain settings**. It shows you the DNS records to add.

If you only want a single file, `dist/lasgidi.html` runs on its own on any static host.

## Keep in mind

- **Names:** "Lagos Life" and lagoslife.app belong to someone else. Use your own name and domain.
- **Updates:** a service worker caches the game. After an update, players get the new version on their next visit. Bump `CACHE` in `sw.js` with each release, as the build already does.
- **The shop:** to sell real-money cosmetics on your own site, run the shop server (`server/`) on a Node host and serve the game from it. Read `server/terms.html` and the README's shop section first. Flutterwave and PayPal keys go in that host's environment, never in the game files.
