import "server-only";

/**
 * Single sign-on for operators through the client's own identity provider
 * (SAML 2.0 or OpenID Connect).
 *
 * STATUS: DISABLED. No identity provider is connected to this workspace, so
 * the "Continue with SSO" button on /login explains that instead of starting
 * a flow. Nothing here fakes a sign-in.
 *
 * Planned flow:
 *  1. /login "Continue with SSO" -> start route (TODO: /login/sso) builds the
 *     SAML AuthnRequest or the OIDC authorization URL (state + nonce + PKCE,
 *     kept in a short-lived signed httpOnly cookie) and redirects to the IdP.
 *  2. The IdP returns to the ACS / callback URL `/login/sso/callback`
 *     (route handler, TODO): validate the SAML response signature, audience
 *     and conditions, or exchange the OIDC code and verify the ID token.
 *  3. Look up an ACTIVE admin by the asserted email. No match -> the same
 *     generic "no operator account" answer as the password path. Never
 *     auto-create an operator.
 *  4. Match -> issue the pending-login ticket and send the 6-digit code,
 *     exactly like the password path. SSO proves the account; the code is
 *     still step 2.
 *
 * What the client must provide (TODOs):
 *  - SAML: the IdP metadata URL (or its signing certificate and SSO URL), and
 *    this service provider registered at the IdP with
 *      entity ID:  https://<console-domain>/login/sso
 *      ACS URL:    https://<console-domain>/login/sso/callback
 *  - OIDC: an issuer URL, client id and client secret, with the redirect URI
 *      https://<console-domain>/login/sso/callback
 *  - env vars on Vercel:
 *      SSO_PROTOCOL            "saml" | "oidc"
 *      SSO_IDP_METADATA_URL    SAML metadata document
 *      SSO_SP_ENTITY_ID        SAML entity ID of this console
 *      SSO_CALLBACK_URL        ACS / redirect URL (/login/sso/callback)
 *      SSO_OIDC_ISSUER         OIDC issuer
 *      SSO_OIDC_CLIENT_ID      OIDC client id
 *      SSO_OIDC_CLIENT_SECRET  OIDC client secret
 */

export interface SsoStatus {
  enabled: boolean;
  /** Shown under the button when SSO is not available. */
  reason: string;
}

export function ssoStatus(): SsoStatus {
  // Deliberately hard-wired off until steps 1-2 are implemented and tested
  // against a real identity provider; setting the env vars alone must not
  // turn on a half-built flow.
  return {
    enabled: false,
    reason: "Not set up yet. SSO needs a SAML or OIDC identity provider connected to this workspace.",
  };
}
