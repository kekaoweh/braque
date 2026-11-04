// End-to-end walkthrough of Picasso in a real (headless) Chrome.
//
//   cookie=$(cd ../backend && uv run python scripts/dev_session.py create)
//   PICASSO_TEST_COOKIE=$cookie npm run test:e2e
//   (cd ../backend && uv run python scripts/dev_session.py cleanup)
//
// Env: BASE_URL (default http://localhost:3100), CHROME_PATH, FFMPEG (to generate fixtures).
// The test account's Claude token is fake, so "Make the video" is expected to end with the
// friendly "Claude rejected your token" error; every other flow runs for real.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const COOKIE = process.env.PICASSO_TEST_COOKIE;
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), ".fixtures");
if (!COOKIE) {
  console.error("Set PICASSO_TEST_COOKIE (see backend/scripts/dev_session.py)");
  process.exit(2);
}

function fixtures() {
  mkdirSync(FIXTURES, { recursive: true });
  const ff = process.env.FFMPEG ?? "ffmpeg";
  const make = (name, args) => existsSync(join(FIXTURES, name)) || execFileSync(ff, ["-hide_banner", "-loglevel", "error", "-y", ...args, join(FIXTURES, name)]);
  make("clip.mp4", ["-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=6", "-f", "lavfi", "-i", "sine=f=440:d=6", "-c:v", "libx264", "-c:a", "aac", "-shortest"]);
  make("photo.jpg", ["-f", "lavfi", "-i", "mandelbrot=s=1600x1200", "-frames:v", "1"]);
  make("music.mp3", ["-f", "lavfi", "-i", "sine=f=220:d=12"]);
  return ["clip.mp4", "photo.jpg", "music.mp3"].map((n) => join(FIXTURES, n));
}

const results = [];
const problems = [];
const ok = (name, cond, extra = "") => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) problems.push(name);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  // 1. Sign-in page
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.waitForURL("**/login", { timeout: 15000 });
    ok("signed-out visitor is sent to sign-in", page.url().endsWith("/login"));
    const enter = page.getByRole("button", { name: /Enter the studio/ });
    ok("Enter is disabled until a token is pasted", await enter.isDisabled());
    await page.getByPlaceholder("sk-ant-oat01-…").fill("sk-ant-oat01-" + "z".repeat(90));
    ok("Enter is enabled with a token", await enter.isEnabled());
    await enter.click();
    await page.getByRole("button", { name: /Checking with Claude/ }).waitFor({ timeout: 5000 });
    ok("shows 'Checking with Claude' while verifying", true);
    await page.getByText("Claude didn't accept that token").waitFor({ timeout: 90000 });
    ok("an invalid token shows a clear error", page.url().endsWith("/login"));
    await ctx.close();
  }

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "picasso_session", value: COOKIE, domain: new URL(BASE).hostname, path: "/" }]);
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && !/401|Failed to load resource/.test(m.text()) && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.url().includes("/api/") && r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`));

  // 2. Studio home: compose a new video
  await page.goto(`${BASE}/`);
  await page.getByRole("heading", { name: /What shall we/ }).waitFor();
  ok("Studio loads", await page.getByText("The studio of UI Test").isVisible());
  await page.getByRole("button", { name: /A thirty-second vertical teaser/ }).click();
  ok("an idea fills the brief", (await page.getByPlaceholder(/Describe the piece/).inputValue()).includes("thirty-second vertical teaser"));
  await page.getByRole("button", { name: /1 min/ }).click();
  await page.getByRole("button", { name: "30 sec", exact: true }).click();
  await page.getByRole("button", { name: /Landscape/ }).click();
  await page.getByRole("button", { name: /Vertical/ }).click();
  await page.getByRole("button", { name: /Explainer/ }).click();
  await page.getByRole("button", { name: /Kinetic/ }).click();
  ok("length, format and style pickers update",
    (await page.getByRole("button", { name: /30 sec/ }).isVisible()) && (await page.getByRole("button", { name: /Vertical/ }).isVisible()));
  await page.getByRole("button", { name: "Create video", exact: true }).click();
  await page.waitForURL("**/projects/**");
  const projectUrl = page.url();
  await page.getByPlaceholder(/What is the piece about/).waitFor();
  ok("Create video opens the editor with the chosen settings",
    (await page.getByRole("button", { name: /30 sec/ }).isVisible()) && (await page.getByRole("button", { name: /Vertical/ }).isVisible()));

  // 3. Navigation: section bar and the ⌘K quick switcher
  ok("the editor shows its section bar",
    await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: /Footage/ }).isVisible());
  await page.keyboard.press("Meta+k");
  await page.getByPlaceholder("Search videos, pages and actions…").waitFor({ timeout: 5000 });
  await page.keyboard.type("styles");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/styles");
  ok("⌘K quick switcher jumps to Styles", page.url().endsWith("/styles"));
  await page.goto(projectUrl);
  await page.getByPlaceholder(/What is the piece about/).waitFor();

  // 4. Title and brief autosave
  await page.getByPlaceholder("Untitled").fill("Launch teaser QA");
  await page.getByPlaceholder(/What is the piece about/).fill("A 30 second teaser for our launch. End with 'Coming soon'.");
  await page.waitForTimeout(1200);
  ok("the sidebar shows the new title", await page.locator("aside").getByText("Launch teaser QA").isVisible());

  // 5. Uploads, roles and notes
  await page.locator('input[type="file"]').setInputFiles(fixtures());
  await page.getByText("music.mp3").waitFor({ timeout: 30000 });
  ok("three files upload as cards", (await page.getByPlaceholder("A note for the editor…").count()) === 3);
  ok("audio is tagged Score automatically", (await page.getByRole("button", { name: "Score", exact: true }).count()) === 1);
  const thumbs = await page.locator('main img[src*="/thumb"], section img[src*="/thumb"]').evaluateAll((els) => els.map((e) => e.naturalWidth > 0));
  ok("video and photo thumbnails render", thumbs.length >= 2 && thumbs.every(Boolean), `${thumbs.length} thumbs`);
  await page.getByRole("button", { name: "Footage", exact: true }).nth(1).click();
  await page.getByRole("button", { name: /Reference/ }).click();
  await page.getByPlaceholder("A note for the editor…").first().fill("Hero shot, open on this");
  await page.waitForTimeout(1200);

  // 6. Everything persists across a reload
  await page.reload();
  await page.getByText("music.mp3").waitFor();
  ok("title persists", (await page.getByPlaceholder("Untitled").inputValue()) === "Launch teaser QA");
  ok("brief persists", (await page.getByPlaceholder(/What is the piece about/).inputValue()).includes("Coming soon"));
  ok("role change persists", (await page.getByRole("button", { name: "Reference", exact: true }).count()) === 1);
  ok("asset note persists", (await page.getByPlaceholder("A note for the editor…").first().inputValue()) === "Hero shot, open on this");

  // 7. Make the video (fake token -> friendly failure)
  await page.getByPlaceholder(/What is the piece about/).fill("FRESH BRIEF right before clicking");
  await page.getByRole("button", { name: /Make the video/ }).click();
  const saved = await page.evaluate(async (u) => (await (await fetch(`/api/projects/${u.split("/").pop()}`)).json()).prompt, projectUrl);
  ok("a brief typed right before Make the video is saved first", saved === "FRESH BRIEF right before clicking", saved);
  await page.getByText("The editor sets to work").waitFor({ timeout: 20000 });
  ok("the activity feed goes live", true);
  await page.getByText("Claude rejected your token").waitFor({ timeout: 120000 });
  ok("the run ends with a readable error", true);
  ok("Make the video is available again", await page.getByRole("button", { name: /Make the video/ }).isEnabled());

  // 8. Styles: compose, edit, use, remove
  await page.goto(`${BASE}/styles`);
  await page.getByRole("button", { name: "Compose a style" }).click();
  await page.getByPlaceholder("Name the style").fill("QA Warm");
  await page.getByPlaceholder(/Warm and unhurried/).fill("Warm and slow. Linger on faces.");
  await page.getByRole("button", { name: "Fade", exact: true }).click();
  await page.getByRole("button", { name: "Save style" }).click();
  await page.getByText("QA Warm", { exact: true }).waitFor();
  ok("a custom style is created", true);
  await page.locator("div.group", { hasText: "QA Warm" }).last().getByRole("button", { name: "Edit" }).click();
  await page.getByPlaceholder("Name the style").fill("QA Warm v2");
  await page.getByRole("button", { name: "Save style" }).click();
  await page.getByText("QA Warm v2", { exact: true }).waitFor();
  ok("a custom style is edited", true);
  await page.goto(projectUrl);
  await page.getByRole("button", { name: /Kinetic/ }).click();
  ok("the custom style appears in the editor's style picker", await page.getByRole("button", { name: /QA Warm v2/ }).isVisible());
  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/styles`);
  page.once("dialog", (d) => d.accept());
  await page.locator("div.group", { hasText: "QA Warm v2" }).last().getByRole("button", { name: "Remove" }).click();
  await page.getByText("QA Warm v2", { exact: true }).waitFor({ state: "detached" });
  ok("a custom style is removed", true);

  // 9. Remove the video, then sign out
  await page.goto(projectUrl);
  await page.getByRole("button", { name: "More" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove this work" }).click();
  await page.waitForURL(`${BASE}/`);
  await page.waitForTimeout(500);
  ok("removing a video returns to the Studio without it", !(await page.locator("aside").getByText("Launch teaser QA").count()));
  await page.getByRole("button", { name: /UI Test/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  ok("sign out returns to sign-in", true);
  await ctx.close();
} catch (e) {
  problems.push(`aborted: ${String(e.message).split("\n")[0]}`);
} finally {
  await browser.close();
  console.log(results.join("\n"));
  console.log(problems.length ? `\nPROBLEMS:\n${problems.join("\n")}` : "\nNo console errors, page errors or 5xx responses.");
  process.exit(problems.length ? 1 : 0);
}
