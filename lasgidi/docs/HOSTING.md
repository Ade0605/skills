# Hosting Lasgidi for everyone

Lasgidi is static files, so free hosts can serve it. The repository has a GitHub Pages workflow ready to use: `.github/workflows/lasgidi-pages.yml`.

## What works where

| | claude.ai artifact | Your own site (GitHub Pages, Netlify, Cloudflare Pages) |
|---|---|---|
| The whole single-player game, 3D, offline play, saves | ✅ | ✅ |
| Hall of Fame, weekly board, chat, live players, governor race, shared ads | ✅ | ✅ with a free Supabase project (below); otherwise ❌ |
| Real-money Style shop and top-ups | ❌ | Only with the Node shop server running somewhere (`npm run shop`) |

Without the online setup below, the game on your own site runs alone in each player's browser, and saves stay on the device.

## Option 1: GitHub Pages (free, HTTPS, deploys on every push)

1. Merge the pull request into `main`.
2. Open **Actions → "Lasgidi on GitHub Pages" → Run workflow**, or push any change under `lasgidi/`. The workflow builds the game, runs the tests and pushes the site to the `gh-pages` branch.
3. GitHub usually turns Pages on for `gh-pages` by itself. If the address below shows a 404 after a few minutes, open **Settings → Pages** and under *Build and deployment* set **Source** to **Deploy from a branch**, branch **gh-pages**, folder **/ (root)**, then Save.
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

## Online features on your own site (free Supabase project)

Hall of Fame, the weekly board, chat, live players on the map, the governor race, sea plots, ads, gifts, homes and player shops can all run on your own site. They use a free [Supabase](https://supabase.com) project. Players sign in anonymously, one id per device, with no email or password. The database enforces the same rules as the claude.ai version: anyone can read, each player writes only their own records, and a few collections are editor-only. The Hall of Fame still replays every life move by move before ranking it.

1. **Create a project.** At supabase.com, make a free account and a new project. Any region near your players is fine, for example London or Frankfurt for Lagos.
2. **Turn on anonymous sign-in.** In **Authentication → Sign In / Providers**, switch **Anonymous sign-ins** on.
3. **Create the tables and rules.** Open the **SQL editor**, paste all of `lasgidi/supabase/schema.sql`, and click **Run**. It is safe to run again later.
4. **Copy two values.** In **Project Settings → API**, copy the **Project URL** and the **anon public** key. The anon key is meant to be public: the database rules are what protect the data. Never use the `service_role` key in the game.
5. **Add them to the repository.** In **Settings → Secrets and variables → Actions → Variables**, add `LASGIDI_SUPABASE_URL` and `LASGIDI_SUPABASE_ANON`.
6. **Deploy.** Run the **Lasgidi on GitHub Pages** workflow. The site now has online features.
7. **Make yourself the editor**, so you can review ads, sea-plot pictures, photos and reports.
   - Open your site once.
   - Find your id in the Supabase dashboard under **Authentication → Users** (the newest anonymous user is you).
   - In the SQL editor run `insert into public.admins values ('<your id>');`.

**Good to know**

- **Names:** player names are the names players give themselves in the game, passed through the game's chat filter. There are no account names.
- **Ids:** an id belongs to the browser. Clearing site data, or using another phone, gives a new id. Saves can still be moved with the game's save code.
- **Chat:** messages are kept for at most 10 minutes, then deleted by a scheduled job. The database stamps who sent each one, so a message can't claim to be from someone else.
- **Presence:** where players stand on the map is self-reported, the same as on claude.ai. The game treats it as untrusted and checks it.
- **Free tier:** Supabase's free plan allows 50,000 monthly active users, a 500 MB database and limited Realtime connections. A free project pauses after a week with no activity, and you wake it from the dashboard.

## Keep in mind

- **Names:** "Lagos Life" and lagoslife.app belong to someone else. Use your own name and domain.
- **Updates:** a service worker caches the game. After an update, players get the new version on their next visit. Bump `CACHE` in `sw.js` with each release, as the build already does.
- **The shop:** to sell real-money cosmetics on your own site, run the shop server (`server/`) on a Node host and serve the game from it. Read `server/terms.html` and the README's shop section first. Flutterwave and PayPal keys go in that host's environment, never in the game files.

## Staying within GitHub's terms

The free website (GitHub Pages) and the build (GitHub Actions) are used within GitHub's Terms of Service, Acceptable Use Policies and GitHub Pages rules:

- **No selling on GitHub Pages.** GitHub Pages is not for running an online business or sites mainly for commercial transactions. The website is the free game only. In-game naira has no real value and cannot be cashed out. The optional real-money shop (`server/`) must run on your own Node host, never on GitHub Pages.
- **Secret scanning.** Gitleaks checks every push and pull request (`.github/workflows/gitleaks.yml`) and the whole history can be scanned with `gitleaks git . --log-opts="--all" --config .gitleaks.toml`. `.gitleaks.toml` lists the only known safe matches (browser save-slot names and the public Supabase anon key). If it ever flags a real key, remove it and rotate it with the provider at once; deleting the line is not enough, because it stays in the history.
- **No secrets in the repository.** Only the public Supabase anon key goes into the site (it is meant to be public; the database rules protect the data). Payment keys, the Supabase service key and admin tokens never go in the repository or the Actions variables used by the site.
- **Others' work.** Third-party code keeps its licence: three.js (`vendor/THREE-LICENSE`, MIT) and supabase-js (`vendor/SUPABASE-LICENSE`, MIT). Real places keep their real names, but company logos are not copied: brands, banks, clubs and events in the game have made-up names, and transport and shop signs are plain text.
- **Content.** Chat, names, ads and captions are filtered (no sexual content, harassment, threats, scams, links or personal details), pictures are reviewed before others see them, and players can block and report. Betting and the casino use game money only, are 18+ and are off in Family mode.
- **Privacy.** The site collects only what the Safety and privacy card in the game lists (an anonymous id, a display name and what players choose to post, plus each player's last voice note). As the owner you are responsible for honouring deletion requests: delete a player's rows in the Supabase dashboard.
- **Actions.** The workflow only builds and publishes this site. It does not mine, spam or run anything unrelated. If GitHub turns Actions off for the repository (Settings → Actions), the site stops updating until it is turned back on.
