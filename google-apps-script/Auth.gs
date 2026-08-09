function verifyGoogleIdToken_(idToken) {
  const token = stringValue_(idToken, 'idToken', { required: true, max: 10000 });
  const clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_OAUTH_CLIENT_ID');
  if (!clientId) throw apiError_('CONFIGURATION_ERROR', 'Google authentication is not configured.');

  let response;
  try {
    response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo', {
      method: 'post',
      payload: { id_token: token },
      muteHttpExceptions: true
    });
  } catch (_) {
    throw apiError_('AUTHENTICATION_FAILED', 'Google token verification is temporarily unavailable.');
  }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw apiError_('AUTHENTICATION_FAILED', 'Invalid Google ID token.');

  let claims;
  try { claims = JSON.parse(response.getContentText()); } catch (_) { throw apiError_('AUTHENTICATION_FAILED', 'Invalid Google verification response.'); }
  return validateGoogleClaims_(claims, clientId, Math.floor(Date.now() / 1000));
}

function validateGoogleClaims_(claims, expectedAudience, nowSeconds) {
  assertObject_(claims, 'claims');
  if (claims.aud !== expectedAudience) throw apiError_('AUTHENTICATION_FAILED', 'Google token audience is invalid.');
  if (claims.iss !== 'accounts.google.com' && claims.iss !== 'https://accounts.google.com') throw apiError_('AUTHENTICATION_FAILED', 'Google token issuer is invalid.');
  const exp = Number(claims.exp);
  const iat = Number(claims.iat);
  if (!isFinite(exp) || exp <= nowSeconds) throw apiError_('AUTHENTICATION_FAILED', 'Google ID token has expired.');
  if (!isFinite(iat) || iat > nowSeconds + 300) throw apiError_('AUTHENTICATION_FAILED', 'Google ID token issue time is invalid.');
  if (typeof claims.email !== 'string' || !claims.email.trim()) throw apiError_('AUTHENTICATION_FAILED', 'Verified email is missing.');
  if (!(claims.email_verified === true || claims.email_verified === 'true')) throw apiError_('AUTHENTICATION_FAILED', 'Google email is not verified.');
  const email = claims.email.trim().toLowerCase();
  if (!email.endsWith('@gmail.com') && !(typeof claims.hd === 'string' && claims.hd.trim())) throw apiError_('AUTHENTICATION_FAILED', 'Google is not authoritative for this email account.');
  return { email: email, exp: exp, sub: String(claims.sub || '') };
}

function authorizeAdmin_(verifiedIdentity, dependencies) {
  const lookup = dependencies && dependencies.findAdmin ? dependencies.findAdmin : findAdminByEmail_;
  const admin = lookup(verifiedIdentity.email);
  if (!admin || admin.active !== true) throw apiError_('FORBIDDEN', 'Administrator access is not authorized.');
  return { email: verifiedIdentity.email };
}

function authenticateAdminRequest_(idToken, dependencies) {
  const verifier = dependencies && dependencies.verifyToken ? dependencies.verifyToken : verifyGoogleIdToken_;
  return authorizeAdmin_(verifier(idToken), dependencies);
}
