import { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import crypto from "node:crypto";

const COOKIE_NAME = "chaos_session";
const MAX_AGE = 604800; // 7 days

const WORDLIST = [
  "tiger",
  "castle",
  "bloom",
  "seven",
  "river",
  "flame",
  "cloud",
  "stone",
  "pixel",
  "orbit",
  "maple",
  "drift",
  "spark",
  "frost",
  "coral",
  "steel",
  "grove",
  "pulse",
  "amber",
  "delta",
  "cedar",
  "prism",
  "lunar",
  "ocean",
  "ember",
  "ridge",
  "solar",
  "plume",
  "ivory",
  "nexus",
  "quilt",
  "zephyr",
  "birch",
  "crest",
  "wren",
  "flint",
];

let password: string;

export function resolvePassword(): string {
  if (password) return password;

  const env = process.env.CHAOS_PASSWORD;
  if (env) {
    password = env;
  } else {
    const words: string[] = [];
    for (let i = 0; i < 4; i++) {
      words.push(WORDLIST[crypto.randomInt(WORDLIST.length)]);
    }
    password = words.join("-");
    console.log(`\n  Password: ${password}\n`);
  }
  return password;
}

function sign(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return `${payload}.${hmac.digest("hex")}`;
}

function verify(token: string, secret: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.substring(0, dot);
  const expected = sign(payload, secret);
  if (
    token.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  ) {
    return null;
  }
  return payload;
}

export function createSessionCookie(c: Context): void {
  const payload = `issued:${Date.now()}`;
  const token = sign(payload, resolvePassword());
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Strict",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

function isValidSession(c: Context): boolean {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return false;
  const payload = verify(token, resolvePassword());
  if (!payload) return false;
  const match = payload.match(/^issued:(\d+)$/);
  if (!match) return false;
  const issued = parseInt(match[1], 10);
  return Date.now() - issued < MAX_AGE * 1000;
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (isValidSession(c)) {
    return next();
  }
  return c.redirect("/login");
};

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Chaos Coordinator — Login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ui-monospace, monospace;
      background: #fff;
      color: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    form {
      border: 2px solid #000;
      padding: 2rem;
      max-width: 24rem;
      width: 100%;
    }
    h1 { font-size: 1.25rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; margin-bottom: 0.5rem; }
    input[type="password"] {
      width: 100%;
      padding: 0.75rem;
      font-family: ui-monospace, monospace;
      font-size: 1rem;
      border: 2px solid #000;
      background: #fff;
      color: #000;
      margin-bottom: 1rem;
    }
    button {
      width: 100%;
      padding: 0.75rem;
      font-family: ui-monospace, monospace;
      font-size: 1rem;
      background: #000;
      color: #fff;
      border: 2px solid #000;
      cursor: pointer;
      min-height: 44px;
    }
    .error {
      border: 2px solid #000;
      padding: 0.75rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <form method="POST" action="/login">
    <h1>Chaos Coordinator</h1>
    {{ERROR}}
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autofocus required />
    <button type="submit">Log in</button>
  </form>
</body>
</html>`;

export function loginPage(error?: string): string {
  const errorHtml = error
    ? `<div class="error">${error}</div>`
    : "";
  return LOGIN_HTML.replace("{{ERROR}}", errorHtml);
}

export function checkPassword(input: string): boolean {
  const expected = resolvePassword();
  if (input.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}
