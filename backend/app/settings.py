"""Per-user studio settings: defaults for new videos and how the editor (the agent) works.

Stored as JSON on the user row so new settings can be added without a migration; anything
missing or no longer valid falls back to the defaults below.
"""

import json
from typing import Literal, Optional

from pydantic import BaseModel, Field, ValidationError

from .db import User

MODELS = {
    "claude-opus-5-5": "Opus 5.5",
    "claude-sonnet-5-5": "Sonnet 5.5",
}


class Settings(BaseModel):
    # Defaults for new videos
    default_seconds: int = Field(default=60, ge=5, le=3600)
    default_aspect: Literal["16:9", "9:16", "1:1", "4:5"] = "16:9"
    default_style_id: Optional[str] = "sty_explainer"

    # The editor
    model: Literal["claude-opus-5-5", "claude-sonnet-5-5"] = "claude-opus-5-5"
    effort: Literal["low", "medium", "high"] = "high"
    web_research: bool = True
    libraries_off: list[str] = Field(default_factory=list, max_length=20)

    # The cut
    on_screen_text: Literal["style", "minimal", "none"] = "style"
    music: Literal["auto", "none"] = "auto"
    credits_card: bool = True
    language: str = Field(default="English", min_length=1, max_length=40)


def load(user: User) -> Settings:
    try:
        return Settings(**json.loads(user.settings_json or "{}"))
    except (ValueError, ValidationError):
        return Settings()


def prompt_notes(s: Settings) -> list[str]:
    """Creator preferences, phrased as direction for the editor."""
    notes = []
    if s.language.strip().lower() != "english":
        notes.append(f"Write every on-screen word (captions, titles, credits) in {s.language.strip()}.")
    if s.on_screen_text == "minimal":
        notes.append("Keep on-screen words to a minimum: an opening title and only the few captions "
                     "the story can't do without.")
    elif s.on_screen_text == "none":
        notes.append("Use no on-screen words at all: no captions and no title cards with text, except a "
                     "credits card if one is required. Let the images carry the piece.")
    if s.music == "none":
        notes.append("Don't add music. Keep the footage's natural sound where it helps.")
    if not s.credits_card:
        notes.append("Don't end with a credits title card; the app lists credits separately.")
    if not s.web_research:
        notes.append("Web research is switched off for this creator; work from the brief and your own knowledge.")
    return notes
