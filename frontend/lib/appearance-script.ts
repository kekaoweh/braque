// Server-safe: imported by the root layout, which can't import the hook-based lib/appearance.

export const THEME_KEY = "picasso-theme";
export const MOTION_KEY = "picasso-motion";

/** Applies the saved theme and motion to <html> before first paint, so there's no flash. */
export const APPEARANCE_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;if(localStorage.getItem("${MOTION_KEY}")==="reduced")document.documentElement.dataset.motion="reduced"}catch(e){}`;
