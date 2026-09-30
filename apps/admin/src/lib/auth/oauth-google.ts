import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Google sign-in for operators (OpenID Connect, authorization code + PKCE).
 *
 * STATUS: DISABLED. There is no Google OAuth client in the client's Firebase
 * / Google Cloud project yet, so the button on /login is disabled and says
 * why. Nothing in this file fakes a Google sign-in: the two network steps
 * throw until they are implemented against a real client.
 *
 * Planned flow (each step maps to a function below):
 *  1. /login "Continue with Google" -> server action `startGoogleSignIn`:
 *     make `state`, `nonce` and a PKCE verifier, keep them in a short-lived
 *     signed httpOnly cookie (like tp_mfa, path /login/google), and redirect
 *     to `googleAuthorizationUrl(...)`.
 *  2. Google redirects to /login/google/callback (route handler, TODO):
 *     check `state` against the cookie, then `exchangeGoogleCode` with the
 *     verifier.
 *  3. `verifyGoogleIdToken`: signature against Google's JWKS, `iss`, `aud`
 *     (our client id), `exp`, the `nonce`, and `email_verified === true`.
 *     Optionally require the Workspace domain (`hd`).
 *  4. Look up an ACTIVE admin by that email. No match -> the same generic
 *     "no operator account" answer as the password path. Never auto-create.
 *  5. Match -> issue the pending-login ticket with method "google" and send a
 *     6-digit code to the operator's email (channel "email"), exactly like
 *     the password path. Google proves the account; the code is still step 2.
 *
 * What the client must provide (TODOs):
 *  - an OAuth 2.0 Web client in the FYT Google Cloud project that backs
 *    Firebase (APIs & Services > Credentials), with the consent screen set
 *    up and this redirect URI registered:
 *      https://<console-domain>/login/google/callback
 *  - env vars GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
 *    GOOGLE_OAUTH_REDIRECT_URI on Vercel.
 *  Alternatively Firebase Authentication's Google provider can do steps 1-3
 *  in the browser; the server then verifies the Firebase ID token with the
 *  Admin SDK before step 4.
 */

export interface GoogleOAuthStatus {
  enabled: boolean;
  /** Shown under the disabled button. */
  reason: string;
}

export function googleOAuthStatus(): GoogleOAuthStatus {
  // Deliberately hard-wired off until steps 2-3 are implemented and tested
  // against a real client; setting the env vars alone must not turn on a
  // half-built flow.
  return {
    enabled: false,
    reason: "Not set up yet. Google sign-in needs an OAuth client in FYT's Firebase project.",
  };
}

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

export interface GooglePkce {
  state: string;
  nonce: string;
  verifier: string;
  challenge: string;
}

export function newGooglePkce(): GooglePkce {
  const verifier = randomBytes(32).toString("base64url");
  return {
    state: randomBytes(16).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

/** Step 1: where to send the browser. Pure URL building, no network. */
export function googleAuthorizationUrl(
  cfg: { clientId: string; redirectUri: string; hostedDomain?: string },
  pkce: Pick<GooglePkce, "state" | "nonce" | "challenge">,
): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", pkce.state);
  url.searchParams.set("nonce", pkce.nonce);
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  if (cfg.hostedDomain) url.searchParams.set("hd", cfg.hostedDomain);
  return url.toString();
}

export class GoogleOAuthNotConfiguredError extends Error {
  constructor() {
    super("Google sign-in is not configured: no OAuth client exists in the FYT Firebase project yet.");
    this.name = "GoogleOAuthNotConfiguredError";
  }
}

/** Step 2 (TODO): POST https://oauth2.googleapis.com/token with the code and PKCE verifier. */
export async function exchangeGoogleCode(code: string, verifier: string): Promise<{ idToken: string }> {
  void code;
  void verifier;
  throw new GoogleOAuthNotConfiguredError();
}

/** Step 3 (TODO): verify the ID token (JWKS signature, iss, aud, exp, nonce, email_verified). */
export async function verifyGoogleIdToken(idToken: string, expectedNonce: string): Promise<{ email: string }> {
  void idToken;
  void expectedNonce;
  throw new GoogleOAuthNotConfiguredError();
}
