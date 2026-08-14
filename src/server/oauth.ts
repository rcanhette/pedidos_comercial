import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { loginWithVerifiedEmail, secureCompare } from "./auth";

export type OAuthProvider = "google" | "microsoft";

type ProviderConfig = {
  clientId?: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
};

type OAuthUserInfo = {
  email?: string;
  mail?: string;
  userPrincipalName?: string;
};

const providers = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"]
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authorizationUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}/oauth2/v2.0/token`,
    userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
    scopes: ["openid", "email", "profile"]
  }
} satisfies Record<OAuthProvider, ProviderConfig>;

function secureCookie() {
  return process.env.SESSION_COOKIE_SECURE === "true";
}

function getBaseUrl(request: NextRequest) {
  return process.env.AUTH_BASE_URL?.replace(/\/$/, "") || request.nextUrl.origin;
}

function getRedirectUri(request: NextRequest, provider: OAuthProvider) {
  return `${getBaseUrl(request)}/api/auth/${provider}/callback`;
}

function stateCookie(provider: OAuthProvider) {
  return `pedidos_oauth_${provider}_state`;
}

function verifierCookie(provider: OAuthProvider) {
  return `pedidos_oauth_${provider}_verifier`;
}

function sha256Base64Url(input: string) {
  return createHash("sha256").update(input).digest("base64url");
}

function oauthErrorRedirect(request: NextRequest, message: string) {
  const url = new URL("/login", getBaseUrl(request));
  url.searchParams.set("erro", message);
  return NextResponse.redirect(url);
}

export function isOAuthProviderConfigured(provider: OAuthProvider) {
  const config = providers[provider];
  return Boolean(config.clientId && config.clientSecret);
}

export async function beginOAuthLogin(request: NextRequest, provider: OAuthProvider) {
  const config = providers[provider];
  if (!isOAuthProviderConfigured(provider)) {
    return oauthErrorRedirect(request, "Login externo não configurado.");
  }

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookie(),
    maxAge: 10 * 60,
    path: "/"
  };

  cookieStore.set(stateCookie(provider), state, cookieOptions);
  cookieStore.set(verifierCookie(provider), verifier, cookieOptions);

  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId!);
  url.searchParams.set("redirect_uri", getRedirectUri(request, provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", sha256Base64Url(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(url);
}

export async function completeOAuthLogin(request: NextRequest, provider: OAuthProvider) {
  const config = providers[provider];
  if (!isOAuthProviderConfigured(provider)) {
    return oauthErrorRedirect(request, "Login externo não configurado.");
  }

  const error = request.nextUrl.searchParams.get("error");
  if (error) return oauthErrorRedirect(request, "Login externo cancelado ou negado.");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(stateCookie(provider))?.value;
  const verifier = cookieStore.get(verifierCookie(provider))?.value;

  cookieStore.delete(stateCookie(provider));
  cookieStore.delete(verifierCookie(provider));

  if (!code || !state || !expectedState || !verifier || !secureCompare(state, expectedState)) {
    return oauthErrorRedirect(request, "Resposta de login inválida.");
  }

  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(request, provider),
      code_verifier: verifier
    }),
    cache: "no-store"
  });

  if (!tokenResponse.ok) return oauthErrorRedirect(request, "Não foi possível validar o login externo.");
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) return oauthErrorRedirect(request, "Login externo sem token de acesso.");

  const userInfoResponse = await fetch(config.userInfoUrl, {
    headers: { authorization: `Bearer ${tokenData.access_token}` },
    cache: "no-store"
  });

  if (!userInfoResponse.ok) return oauthErrorRedirect(request, "Não foi possível obter o e-mail do login externo.");
  const userInfo = (await userInfoResponse.json()) as OAuthUserInfo;
  const email = userInfo.email || userInfo.mail || userInfo.userPrincipalName;
  if (!email) return oauthErrorRedirect(request, "A conta externa não retornou um e-mail.");

  const result = await loginWithVerifiedEmail(provider, email);
  if (!result.ok) return oauthErrorRedirect(request, result.message);

  return NextResponse.redirect(new URL("/login/verify", getBaseUrl(request)));
}
