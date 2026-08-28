import { OAuth2Client } from 'google-auth-library';

/*
 * Google sign-in, ID-token flow.
 *
 * The browser gets a short-lived ID token from Google and posts it here. This
 * verifies the signature against Google's published keys and checks that the
 * token was minted for *this* app — without that audience check, a token issued
 * to any other Google app would be accepted, which is the whole ballgame.
 *
 * GOOGLE_CLIENT_ID is not a secret: it ships inside the frontend bundle. The
 * security comes from the signature check, not from hiding the id.
 */
const clientId = () => (process.env.GOOGLE_CLIENT_ID || '').trim();

export const googleEnabled = () => !!clientId();

let client = null;

export async function verifyGoogleToken(credential) {
  const id = clientId();
  if (!id) {
    throw Object.assign(new Error('Google sign-in is not configured on this server'), { status: 503 });
  }
  if (!credential) {
    throw Object.assign(new Error('No Google credential was sent'), { status: 400 });
  }

  client ||= new OAuth2Client(id);

  let payload;
  try {
    // Checks the signature, the issuer, the expiry and the audience.
    const ticket = await client.verifyIdToken({ idToken: credential, audience: id });
    payload = ticket.getPayload();
  } catch {
    throw Object.assign(new Error('That Google sign-in could not be verified — please try again'), { status: 401 });
  }

  const email = String(payload?.email || '').trim().toLowerCase();
  if (!email) {
    throw Object.assign(new Error('Google did not share an email address for that account'), { status: 401 });
  }
  /* Accounts are matched to existing ones by email, so an unverified address
     would let anyone claim someone else's account by name alone. */
  if (payload.email_verified !== true) {
    throw Object.assign(new Error('That Google account has an unverified email address'), { status: 401 });
  }

  return {
    googleId: String(payload.sub),
    email,
    name: String(payload.name || payload.given_name || email.split('@')[0]).trim(),
    avatarUrl: payload.picture || null,
  };
}
