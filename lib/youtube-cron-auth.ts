export type CronAuthFailure =
  | { reason: "missing_secret" }
  | {
      reason: "unauthorized";
      debug: CronAuthComparisonDebug;
    };

export type CronAuthResult =
  | { ok: true }
  | ({ ok: false } & CronAuthFailure);

export type CronAuthComparisonDebug = {
  hasCronSecret: boolean;
  hasSecretQuery: boolean;
  secretQueryLength: number;
  cronSecretLength: number;
  secretQueryFirst4: string;
  secretQueryLast4: string;
  cronSecretFirst4: string;
  cronSecretLast4: string;
};

export type CronEnvDebug = {
  hasCronSecret: boolean;
  cronSecretLength: number;
  nodeEnv: string;
  vercelEnv: string | null;
  currentCommit: string | null;
};

function safePrefixSuffix(value: string): { first4: string; last4: string } {
  if (!value) {
    return { first4: "", last4: "" };
  }

  if (value.length <= 4) {
    return { first4: value, last4: value };
  }

  return {
    first4: value.slice(0, 4),
    last4: value.slice(-4),
  };
}

function getTrimmedCronSecret(): string {
  return process.env.CRON_SECRET?.trim() ?? "";
}

function getTrimmedQuerySecret(request: Request): string {
  const url = new URL(request.url);
  const raw = url.searchParams.get("secret");
  return raw?.trim() ?? "";
}

function extractBearerToken(authorization: string | null): string | null {
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function buildComparisonDebug(
  cronSecret: string,
  querySecret: string,
  hasSecretQueryParam: boolean,
): CronAuthComparisonDebug {
  const queryParts = safePrefixSuffix(querySecret);
  const cronParts = safePrefixSuffix(cronSecret);

  return {
    hasCronSecret: cronSecret.length > 0,
    hasSecretQuery: hasSecretQueryParam,
    secretQueryLength: querySecret.length,
    cronSecretLength: cronSecret.length,
    secretQueryFirst4: queryParts.first4,
    secretQueryLast4: queryParts.last4,
    cronSecretFirst4: cronParts.first4,
    cronSecretLast4: cronParts.last4,
  };
}

export function getCronEnvDebug(): CronEnvDebug {
  const cronSecret = getTrimmedCronSecret();

  return {
    hasCronSecret: cronSecret.length > 0,
    cronSecretLength: cronSecret.length,
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    vercelEnv: process.env.VERCEL_ENV ?? null,
    currentCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  };
}

export function checkCronAuth(request: Request): CronAuthResult {
  const cronSecret = getTrimmedCronSecret();

  if (!cronSecret) {
    return { ok: false, reason: "missing_secret" };
  }

  const url = new URL(request.url);
  const querySecret = getTrimmedQuerySecret(request);
  const bearerToken = extractBearerToken(request.headers.get("authorization"));

  const bearerMatches =
    bearerToken !== null && bearerToken.length > 0 && bearerToken === cronSecret;
  const queryMatches = querySecret.length > 0 && querySecret === cronSecret;

  if (bearerMatches || queryMatches) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: "unauthorized",
    debug: buildComparisonDebug(
      cronSecret,
      querySecret,
      url.searchParams.has("secret"),
    ),
  };
}
