const AUTH_TOKEN_MAX_AGE_SECONDS = 15 * 60;
const AUTH_SUCCESS_CACHE_MAX_SECONDS = 5 * 60;
const AUTH_NEGATIVE_CACHE_SECONDS = 60;
const AUTH_TOKENINFO_DAILY_BUDGET = 500;
const AUTH_CACHE_VERSION = 'v1';

function googleIdTokenValue_(value) {
  if (typeof value !== 'string') throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  const token = value.trim();
  if (!token || token.length > 10000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  }
  return token;
}

function tokenFingerprint_(token) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8);
  return bytes.map(function (value) { return ('0' + ((value + 256) % 256).toString(16)).slice(-2); }).join('');
}

function authRuntime_(dependencies) {
  const supplied = dependencies || {};
  return {
    nowSeconds: supplied.nowSeconds === undefined ? Math.floor(Date.now() / 1000) : supplied.nowSeconds,
    clientId: supplied.clientId === undefined ? PropertiesService.getScriptProperties().getProperty('GOOGLE_OAUTH_CLIENT_ID') : supplied.clientId,
    cache: supplied.cache || CacheService.getScriptCache(),
    fingerprint: supplied.fingerprint || tokenFingerprint_,
    consumeBudget: supplied.consumeBudget || consumeTokeninfoBudget_,
    fetchTokenInfo: supplied.fetchTokenInfo || fetchTokeninfo_
  };
}

function consumeTokeninfoBudget_(nowSeconds) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw apiError_('AUTHENTICATION_UNAVAILABLE', 'Authentication is temporarily unavailable.');
  try {
    const properties = PropertiesService.getScriptProperties();
    const date = new Date(nowSeconds * 1000).toISOString().slice(0, 10);
    const storedDate = properties.getProperty('AUTH_TOKENINFO_BUDGET_DATE');
    const storedCount = storedDate === date ? Number(properties.getProperty('AUTH_TOKENINFO_BUDGET_COUNT') || '0') : 0;
    if (!isFinite(storedCount) || storedCount < 0) throw apiError_('AUTHENTICATION_UNAVAILABLE', 'Authentication is temporarily unavailable.');
    if (storedCount >= AUTH_TOKENINFO_DAILY_BUDGET) throw apiError_('AUTHENTICATION_RATE_LIMITED', 'Authentication verification budget exceeded.');
    properties.setProperties({ AUTH_TOKENINFO_BUDGET_DATE: date, AUTH_TOKENINFO_BUDGET_COUNT: String(storedCount + 1) });
  } finally {
    lock.releaseLock();
  }
}

function fetchTokeninfo_(token) {
  let response;
  try {
    response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo', {
      method: 'post',
      payload: { id_token: token },
      muteHttpExceptions: true
    });
  } catch (_) {
    throw apiError_('AUTHENTICATION_UNAVAILABLE', 'Authentication is temporarily unavailable.');
  }
  return { statusCode: response.getResponseCode(), body: response.getContentText() };
}

function cacheKey_(kind, fingerprint) {
  return 'auth:' + AUTH_CACHE_VERSION + ':' + kind + ':' + fingerprint;
}

function cacheableClaims_(claims) {
  return {
    aud: claims.aud,
    iss: claims.iss,
    exp: Number(claims.exp),
    iat: Number(claims.iat),
    email: claims.email,
    email_verified: claims.email_verified,
    hd: typeof claims.hd === 'string' ? claims.hd : '',
    sub: claims.sub
  };
}

function verifyGoogleIdToken_(idToken, dependencies) {
  const token = googleIdTokenValue_(idToken);
  const runtime = authRuntime_(dependencies);
  if (!runtime.clientId) throw apiError_('CONFIGURATION_ERROR', 'Google authentication is not configured.');
  const fingerprint = runtime.fingerprint(token);
  const negativeKey = cacheKey_('invalid', fingerprint);
  const successKey = cacheKey_('verified', fingerprint);

  if (runtime.cache.get(negativeKey)) throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  const cached = runtime.cache.get(successKey);
  if (cached) {
    try {
      return validateGoogleClaims_(JSON.parse(cached), runtime.clientId, runtime.nowSeconds);
    } catch (_) {
      runtime.cache.remove(successKey);
    }
  }

  runtime.consumeBudget(runtime.nowSeconds);
  const result = runtime.fetchTokenInfo(token);
  if (!result || typeof result.statusCode !== 'number' || typeof result.body !== 'string') {
    throw apiError_('AUTHENTICATION_UNAVAILABLE', 'Authentication is temporarily unavailable.');
  }
  if (result.statusCode === 429) throw apiError_('AUTHENTICATION_RATE_LIMITED', 'Authentication is temporarily rate limited.');
  if (result.statusCode >= 500 || result.statusCode < 200 || result.statusCode >= 300 && result.statusCode < 400) {
    throw apiError_('AUTHENTICATION_UNAVAILABLE', 'Authentication is temporarily unavailable.');
  }
  if (result.statusCode >= 400) {
    runtime.cache.put(negativeKey, '1', AUTH_NEGATIVE_CACHE_SECONDS);
    throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  }

  let claims;
  try { claims = JSON.parse(result.body); } catch (_) { throw apiError_('AUTHENTICATION_UNAVAILABLE', 'Authentication is temporarily unavailable.'); }
  let identity;
  try {
    identity = validateGoogleClaims_(claims, runtime.clientId, runtime.nowSeconds);
  } catch (error) {
    runtime.cache.put(negativeKey, '1', AUTH_NEGATIVE_CACHE_SECONDS);
    throw error;
  }
  const ttl = Math.min(AUTH_SUCCESS_CACHE_MAX_SECONDS, Math.floor(identity.exp - runtime.nowSeconds));
  if (ttl > 0) runtime.cache.put(successKey, JSON.stringify(cacheableClaims_(claims)), ttl);
  return identity;
}

function validateGoogleClaims_(claims, expectedAudience, nowSeconds) {
  if (!claims || Object.prototype.toString.call(claims) !== '[object Object]') throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  if (typeof claims.aud !== 'string' || claims.aud !== expectedAudience) throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  if (claims.iss !== 'accounts.google.com' && claims.iss !== 'https://accounts.google.com') throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  const exp = Number(claims.exp);
  const iat = Number(claims.iat);
  if (!isFinite(exp) || exp <= nowSeconds) throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  if (!isFinite(iat) || iat > nowSeconds + 300 || iat < nowSeconds - AUTH_TOKEN_MAX_AGE_SECONDS) throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  if (typeof claims.sub !== 'string' || !claims.sub.trim() || claims.sub.length > 255) throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  if (typeof claims.email !== 'string' || !claims.email.trim()) throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  if (!(claims.email_verified === true || claims.email_verified === 'true')) throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  const email = claims.email.trim().toLowerCase();
  if (!email.endsWith('@gmail.com') && !(typeof claims.hd === 'string' && claims.hd.trim())) throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.');
  return { email: email, exp: exp, iat: iat, sub: claims.sub.trim() };
}

function authorizeAdmin_(verifiedIdentity, dependencies) {
  const lookup = dependencies && dependencies.findAdmin ? dependencies.findAdmin : findAdminByEmail_;
  const admin = lookup(verifiedIdentity.email);
  if (!admin || admin.active !== true || admin.email !== verifiedIdentity.email || admin.googleSub !== verifiedIdentity.sub) {
    throw apiError_('FORBIDDEN', 'Administrator access is not authorized.');
  }
  return { email: verifiedIdentity.email, sub: verifiedIdentity.sub };
}

function authenticateAdminRequest_(idToken, dependencies) {
  const verifier = dependencies && dependencies.verifyToken ? dependencies.verifyToken : verifyGoogleIdToken_;
  return authorizeAdmin_(verifier(idToken, dependencies), dependencies);
}
