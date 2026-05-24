export type CronAuthFailure =
  | { reason: "missing_secret" }
  | {
      reason: "unauthorized";
      debug: {
        hasCronSecret: boolean;
        hasAuthHeader: boolean;
        hasSecretQuery: boolean;
        secretQueryLength: number;
        cronSecretLength: number;
      };
    };

export type CronAuthResult =
  | { ok: true }
  | ({ ok: false } & CronAuthFailure);

function extractBearerToken(authorization: string | null): string | null {
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function checkCronAuth(request: Request): CronAuthResult {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";

  if (!cronSecret) {
    return { ok: false, reason: "missing_secret" };
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = extractBearerToken(authorization);
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim() ?? "";

  const bearerMatches =
    bearerToken !== null && bearerToken === cronSecret;
  const queryMatches =
    querySecret.length > 0 && querySecret === cronSecret;

  if (bearerMatches || queryMatches) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: "unauthorized",
    debug: {
      hasCronSecret: true,
      hasAuthHeader: authorization !== null && authorization.length > 0,
      hasSecretQuery: url.searchParams.has("secret"),
      secretQueryLength: querySecret.length,
      cronSecretLength: cronSecret.length,
    },
  };
}
