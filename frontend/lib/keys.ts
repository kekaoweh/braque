// Anthropic keys as people actually paste them. Shared by sign-in and "Connect your API key";
// mirrors clean_token() on the server.

/** Codes copied from a chat or a file can pick up spaces, quotes or backticks. */
export const cleanCode = (raw: string) => raw.replace(/\s+/g, "").replace(/^["'`]+|["'`]+$/g, "");

// Whitespace, quotes and the box-drawing borders terminals draw around output.
const FRAME = /^[\s"'`|─-╿]+|[\s"'`|─-╿]+$/g;
const KEY_CHARS = /^[A-Za-z0-9_-]+/;

/**
 * Pull the key out of whatever was pasted: copies from a terminal bring along words,
 * `export VAR=`, box borders, quotes, or the key wrapped over lines.
 */
export function cleanKey(raw: string): string {
  const lines = raw.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].indexOf("sk-ant-");
    if (start < 0) continue;
    let token = lines[i].slice(start).match(KEY_CHARS)![0];
    let rest = lines[i].slice(start + token.length);
    for (const next of lines.slice(i + 1)) {
      if (rest.replace(FRAME, "")) break;
      const part = next.replace(FRAME, "");
      if (!part || !/^[A-Za-z0-9_-]+$/.test(part)) break;
      token += part;
      rest = "";
    }
    return token;
  }
  return raw.replace(/\s+/g, "").replace(FRAME, "");
}

/** What kind of Anthropic credential a cleaned value is. */
export const keyKind = (key: string): "api" | "claude" | null =>
  key.startsWith("sk-ant-api") ? "api" : key.startsWith("sk-ant-oat") ? "claude" : null;
