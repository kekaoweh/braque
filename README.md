# Picasso

Created and maintained by **Keka Oweh** ([github.com/kekaoweh](https://github.com/kekaoweh)).

An AI video editor where an agent makes the whole video. You describe what you want and pick a
style. The editor researches the subject, finds licensed footage on the web, studies it, writes a
script, cuts a timeline and renders an MP4. Uploads are optional. Ask for changes in plain language
to get a new version.

- **Frontend:** Next.js 15 (App Router, Tailwind v4), Notion-style UI, `frontend/`
- **Backend:** FastAPI + SQLite + ffmpeg, `backend/`
- **Agent:** Claude Agent SDK (`claude-opus-5-5`), running on each user's own Claude credential

## Run it

Requirements: Node 20+, [uv](https://docs.astral.sh/uv/). Python and ffmpeg are installed
automatically: uv fetches Python, and a static ffmpeg build comes from `imageio-ffmpeg` (a
system `ffmpeg` on `PATH` is used instead when one exists).

```bash
./dev.sh            # backend on :8000, frontend on http://localhost:3100
```

## Signing in

Users sign in with their Claude account:

1. Run `claude setup-token` in a terminal (it opens the browser for Claude login).
2. Paste the `sk-ant-oat…` token on the Picasso sign-in page.

The token is checked with one tiny request, encrypted (Fernet) and stored, then passed to the agent as
`CLAUDE_CODE_OAUTH_TOKEN` for that user's runs only. Each user gets an isolated `CLAUDE_CONFIG_DIR`, and
the server strips any `ANTHROPIC_*` credentials from its own environment. A run can never fall back
to a different account. Anthropic API keys (`sk-ant-api…`) are accepted at the same screen.

> **Before you launch publicly:** Anthropic's Agent SDK terms say third-party products may not offer
> claude.ai login or subscription rate limits to their users unless Anthropic has approved it
> ([docs](https://code.claude.com/docs/en/agent-sdk/overview)). Using your own token yourself is fine.
> For other users, get approval first, or switch them to API keys (already supported).

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
| `PICASSO_MODEL` | `claude-opus-5-5` | Model the agent uses |
| `PICASSO_DATA_DIR` | `backend/data` | DB, uploads, renders |
| `PICASSO_SECRET_KEY` | auto-generated in data dir | Fernet key for stored tokens |
| `PICASSO_AGENT_MAX_TURNS` | `80` | |
| `PICASSO_COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `PICASSO_FFMPEG` / `PICASSO_FONT` | auto | Override the ffmpeg binary / caption font |
| `PICASSO_BACKEND_URL` (frontend) | `http://127.0.0.1:8000` | Where Next proxies `/api` |

## Not built yet

- Generating new shots with an AI video model, for moments no library has. A "generate shot" clip type
  would slot into `set_timeline` / `render_timeline`.
- Voiceover / TTS and auto-captions from speech.
- A background job queue. Runs are asyncio tasks in the API process, so use a single worker, or add
  Redis/Celery to scale out.

## Author

**Keka Oweh** ([github.com/kekaoweh](https://github.com/kekaoweh)). Picasso is designed, built and owned by
Keka Oweh.
