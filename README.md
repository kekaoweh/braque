# Braque

Created and maintained by **Keka Oweh** ([github.com/kekaoweh](https://github.com/kekaoweh)).
Live at **[braquestudio.com](https://braquestudio.com)** (invite-only).

An AI video editor where an agent makes the whole video. You describe what you want and pick a
style. The editor researches the subject, finds licensed footage on the web, studies it, writes a
script, cuts a timeline and renders an MP4. Uploads are optional. Ask for changes in plain language
to get a new version.

- **Frontend:** Next.js 15 (App Router, Tailwind v4), `frontend/`
- **Backend:** FastAPI + SQLite + ffmpeg, `backend/`
- **Agent:** Claude Agent SDK (`claude-opus-5-5`), running on each user's own Claude credential

Named for Georges Braque, who invented Cubism alongside Picasso (hence the cubist-eye mark). The
project began as "Picasso"; internal names such as the `PICASSO_*` settings, the `picasso_session`
cookie and the server's `picasso` VM and data volume keep that name so live sessions and data carry over.

## Run it

Requirements: Node 20+, [uv](https://docs.astral.sh/uv/). Python and ffmpeg are installed
automatically: uv fetches Python, and a static ffmpeg build comes from `imageio-ffmpeg` (a
system `ffmpeg` on `PATH` is used instead when one exists).

```bash
./dev.sh            # backend on :8000, frontend on http://localhost:3100
```

## Signing in

| Who | How | Whose AI usage |
|---|---|---|
| **Customers** | **Email and password** (plus the invite code on an invite-only server) | The **studio key**, up to a monthly limit each (default $10), or their own API key added in Settings |
| **People with an Anthropic API key** | "Have an Anthropic API key? Use it instead" | Their own key, no limit |
| **The site admin** (whoever runs the server) | "Site admin": a Claude-account token from `claude setup-token`, plus the admin code | The admin's Claude plan |
| **Clients who only watch** | Nothing: a **share link** (`/s/…`) from the editor's Share button | None |

- Passwords are hashed with scrypt; sign-in attempts are throttled (8 failures per email per 15 min).
- Keys and tokens are encrypted (Fernet) and used only for that user's runs, each in an isolated
  `CLAUDE_CONFIG_DIR`; the server strips any `ANTHROPIC_*` credentials from its own environment.
- Every run records who paid (`billed_to`: `own` or `studio`) and its cost, which is how the monthly
  limit is enforced; Settings shows customers their meter and the admin everyone's usage.
- The sign-in page finds the key inside whatever is pasted (terminal output, borders, `export …=`).

> **Anthropic's terms:** third-party products may not offer claude.ai login or subscription rate limits
> to their users unless Anthropic has approved it
> ([docs](https://code.claude.com/docs/en/agent-sdk/overview)). So Claude-account sign-in is only for
> the site admin, and the studio key must be an API key; the server ignores a Claude-account token there.

## Footage from the web

The editor sources footage itself, only from libraries whose licenses allow reuse in new videos, so
finished work is safe to publish:

| Library | What it's good for | Setup |
| --- | --- | --- |
| Pexels | Modern, cinematic stock video and photos | free key: `PEXELS_API_KEY` |
| Pixabay | Stock video and photos | free key: `PIXABAY_API_KEY` |
| Wikimedia Commons | Places, nature, history, music (CC0 / CC BY / CC BY-SA) | none |
| NASA | Space and Earth (public domain) | none |
| Internet Archive (Prelinger) | Vintage film (public domain) | none |

Pexels and Pixabay give the most polished results. Get free keys at pexels.com/api and
pixabay.com/api/docs, then put them in `backend/.env` (gitignored):

```bash
PEXELS_API_KEY=your-key
PIXABAY_API_KEY=your-key
```

Every clip the editor collects keeps its library, author, license and source link. The editor shows a
Credits list with one-click copy, and videos that use library footage end with a short credits card.

## How a video gets made

```
brief + style ──▶ agent (Claude) ──▶ research + licensed footage ──▶ timeline JSON ──▶ ffmpeg ──▶ MP4
```

The agent has no shell or file access. Of Claude Code's built-in tools only read-only WebSearch is on
(for fact-checking). Everything else goes through tools scoped to the project (`backend/app/agent.py`):

| Tool | What it does |
| --- | --- |
| `list_assets` | Lists the project's clips, photos and audio, with the user's notes and roles |
| `search_footage` | Searches the footage libraries and returns a numbered contact sheet of previews |
| `import_footage` | Downloads chosen results into the project with credit and license (time-boxed, deduplicated) |
| `view_asset` | Returns a labelled contact sheet of frames (optionally for a time range) |
| `write_script` | Saves the markdown script shown in the editor |
| `set_timeline` | Validates the edit (schema, asset ids, trims within source length) and saves it |

The timeline (`backend/app/timeline.py`) is a list of clips, either media or title cards. Each clip
has trims, captions, Ken Burns motion for stills and a transition, plus an optional music bed.
`backend/app/media.py` renders each clip to a normalized segment (style grade, captions, fades),
concatenates the segments and mixes in the music. Supported formats: 16:9, 9:16, 1:1 and 4:5.

**Asset roles:** *Footage* is cut into the video. *Reference* shows the agent a look or pacing to
match. *Music* becomes the soundtrack.

**Styles** combine editing direction for the agent (pacing, tone, caption usage) with render
settings (caption position, color and box, transitions, brightness, contrast, saturation). There are
five built-in styles, and users can create their own on the Styles page.

## Finding your way around

- **`/`** is the public homepage (what Braque is, how it works, about, FAQ), server-rendered with
  search metadata and structured data naming the founder; `robots.txt` and `sitemap.xml` list it and
  keep the studio, people's work and share links out of search results. The studio is at **`/studio`**.

- **⌘K / Ctrl+K** opens the quick switcher anywhere: jump to any video, Studio or Styles, start a new
  video, or sign out.
- **New video** sits at the top of the sidebar, under search; your videos are listed below with
  thumbnails and a pulsing dot while the editor is working.
- In the editor, the **section bar** (Brief, Preview, Timeline, Footage, Credits) follows your scroll
  and jumps to any section.
- **Light and dark mode**: the sun/moon button at the bottom of the sidebar, "Switch to dark mode" in
  ⌘K, or Settings → Appearance (Light, Dark or System). Saved per device and applied before the page
  paints, so there's no flash.

## Settings

Settings (sidebar, or ⌘K) has five groups. Appearance is stored in the browser; everything else is
saved to the account (`GET/PUT /api/settings`, JSON on the user row) and used on every run.

| Group | Settings | Effect |
|---|---|---|
| Appearance | Theme, Motion | Light/Dark/System; Reduced turns off tilt and small animations |
| New videos | Running time, Format, Style | Starting point for new videos (the Studio composer, New video, ⌘K) |
| The editor | Model (Opus 5.5 / Sonnet 5.5), Thoroughness (agent effort), Web research, Footage libraries | Agent options, and which libraries `search_footage` may use |
| The finished video | On-screen words, Music, Credits card, Language | Added to the agent's brief as "creator preferences" |
| Account | Studio name, connected credential, sign out, disconnect | |

## Testing

An end-to-end walkthrough drives the real app in headless Chrome: sign-in states, creating a video,
the quick switcher and section bar, autosave, uploads and roles, starting the editor, styles, removing
a video and signing out. It uses a throwaway account whose Claude token is fake, so the editor run is
expected to end with the friendly "Claude rejected your token" message.

```bash
cookie=$(cd backend && uv run python scripts/dev_session.py create)
(cd frontend && PICASSO_TEST_COOKIE=$cookie npm run test:e2e)   # set FFMPEG if ffmpeg isn't on PATH
(cd backend && uv run python scripts/dev_session.py cleanup)
```

## Configuration (env vars)

| Var | Default | |
| --- | --- | --- |
| `PICASSO_MODEL` | `claude-opus-5-5` | Fallback model (each user picks theirs in Settings) |
| `PICASSO_DATA_DIR` | `backend/data` | DB, uploads, renders |
| `PICASSO_SECRET_KEY` | auto-generated in data dir | Fernet key for stored tokens |
| `PICASSO_AGENT_MAX_TURNS` | `80` | |
| `PICASSO_COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `PICASSO_FFMPEG` / `PICASSO_FONT` | auto | Override the ffmpeg binary / caption font |
| `PICASSO_BACKEND_URL` (frontend) | `http://127.0.0.1:8000` | Where Next proxies `/api` (fixed at build time) |
| `PICASSO_CLAUDE_ACCOUNT_ALLOWLIST` | empty (anyone) | Workspace ids allowed to sign in with a Claude-account token; others must use API keys |
| `PICASSO_INVITE_CODE` | empty (open) | Required to create a new workspace; returning users don't need it |
| `PICASSO_STUDIO_API_KEY` | empty (off) | The admin's Anthropic API key that pays for customers without their own key |
| `PICASSO_STUDIO_MONTHLY_LIMIT_USD` | `10` | Studio-key spending allowed per customer per calendar month |
| `PICASSO_OWNER_CODE` | empty | The owner's private code: with it, any Claude-account token signs in to the owner's workspace (`PICASSO_OWNER_WORKSPACE`, default the first allowlist entry) |
| `TIGRIS_ACCESS_KEY_ID` / `TIGRIS_SECRET_ACCESS_KEY` / `TIGRIS_BUCKET` | empty (local disk only) | Mirror media to Tigris; see Media storage |
| `TIGRIS_ENDPOINT` | `https://t3.storage.dev` | S3 endpoint (`TIGRIS_ADDRESSING=path` for local S3 stand-ins) |

## Backups and account care

- **Daily database backups** (`app/backup.py`): once a day the server copies `picasso.db` with SQLite's
  online backup API into `data/backups/braque-YYYY-MM-DD.db`, keeps the newest 14, and copies
  `secret.key` beside them (without it, stored keys in a restored database can't be decrypted).
  `deploy/gcp-vm.sh backup` takes a fresh copy and downloads them all to `deploy/backups/` (git
  ignores it; keep it private). Media files are not in these copies; Tigris (below) or a disk
  snapshot covers those.
- **Forgotten passwords:** there's no email service yet, so the site admin resets them in
  Settings → Site admin → Reset password, which shows a one-time password to pass on and signs the
  customer out everywhere.
- **Deleting an account:** Settings → Account → Delete account (password required) removes the
  user's projects, renders, uploads, cloud copies, styles, sessions and stored key. The site admin's
  own account can't be deleted this way.
- **Disk:** every update prunes Docker's build cache (it otherwise grows about 1 GB per build).

## Media storage (Tigris)

With `TIGRIS_ACCESS_KEY_ID`, `TIGRIS_SECRET_ACCESS_KEY` and `TIGRIS_BUCKET` set (in `backend/.env`
locally, `deploy/.env` on the server), every file Braque writes (uploads, imported footage,
thumbnails, renders) is mirrored to a private Tigris bucket under the same path it has in the data
folder, e.g. `uploads/usr_…/ast_….mp4`. `app/storage.py` does the work:

- At startup the server checks that the key can write to the bucket; if it can't, storage switches
  off with one log line and everything stays on local disk.
- Uploads happen in the background after a file is saved; the asset or render is then flagged
  `in_cloud`. Until then (or if Tigris is unreachable) it's served from local disk as before.
- The browser loads media straight from Tigris via signed URLs (6-hour lifetime, redirect cached for
  an hour). The bucket stays private, and Tigris has no download fees, unlike the VM's egress.
- The local file stays as ffmpeg's working copy. If one goes missing, the renderer and the
  editor's `view_asset` restore it from the bucket first.
- Deleting a video, asset or project deletes its cloud copies.
- `uv run python scripts/sync_storage.py` uploads files that existed before storage was turned on
  (safe to re-run).

The access key needs Editor (read/write) permission on the bucket.

## Deploying (Google Compute Engine)

Braque runs as three containers on one VM (`deploy/docker-compose.yml`): the FastAPI backend (agent,
ffmpeg, SQLite, files on a persistent volume), the Next.js frontend, and Caddy for automatic HTTPS.
Caddy sends `/api/*` straight to the backend so large uploads and live progress skip the Next proxy.
A VM suits this app better than Cloud Run: runs take minutes, rendering needs steady CPU, and the
database and media live on disk.

```bash
gcloud auth login
gcloud config set project <your-project-id>        # billing must be enabled
CLAUDE_ACCOUNT_ALLOWLIST=usr_… deploy/gcp-vm.sh create
```

`create` reserves a static IP, opens ports 80/443, creates an `e2-standard-2` Debian VM with a 50 GB
disk, uploads the settings in `deploy/.env` (domain, allowlist, invite code, footage keys from
`backend/.env`; never committed) and builds the stack. Without a domain the site is served at
`https://<ip-with-dashes>.sslip.io`; set `DOMAIN=` (with an A record pointing at the IP) to use your
own. Later: `deploy/gcp-vm.sh update` (pull from GitHub and rebuild), `env` (change settings),
`status`, `logs`, `ssh`. Roughly $50/month for the VM and disk; `MACHINE=e2-medium` halves that at the
cost of slower renders.

Who can sign in: Anthropic API keys for anyone with the invite code. Claude-account tokens only for
the owner: either a workspace id in the allowlist (Settings → Account), or any token plus the owner
code, which always lands in the owner's workspace, so a fresh `claude setup-token` never locks the owner
out. The sign-in page detects which kind of key was pasted and only blocks an empty field; the server
cleans stray quotes and spaces and explains anything it rejects.

## Not built yet

- Generating new shots with an AI video model, for moments no library has. A "generate shot" clip type
  would slot into `set_timeline` / `render_timeline`.
- Voiceover / TTS and auto-captions from speech.
- A background job queue. Runs are asyncio tasks in the API process, so use a single worker, or add
  Redis/Celery to scale out.

## Author

**Keka Oweh** ([github.com/kekaoweh](https://github.com/kekaoweh)). Braque is designed, built and owned by
Keka Oweh.
