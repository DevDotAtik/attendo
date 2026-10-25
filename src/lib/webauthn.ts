import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

export const RP_NAME = process.env.RP_NAME || 'AttendSheets';
export const RP_ID =
  process.env.RP_ID ||
  (process.env.VERCEL_URL ? process.env.VERCEL_URL.replace(/^https?:\/\//, '') : 'localhost');
export const RP_ORIGIN =
  process.env.RP_ORIGIN ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export async function createRegistrationOptions(user: {
  id: string;
  email: string;
  name: string;
}) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred',
    },
  });
}

export async function checkRegistrationResponse(
  response: any,
  expectedChallenge: string
) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });
}

export async function createAuthenticationOptions(allowCredentials?: {
  id: string;
  transports?: AuthenticatorTransport[];
}[]) {
  return generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    allowCredentials: allowCredentials?.map((cred) => ({
      id: cred.id,
      transports: cred.transports,
    })),
  });
}

export async function checkAuthenticationResponse(
  response: any,
  expectedChallenge: string,
  authenticator: {
    credentialID: string;
    credentialPublicKey: Uint8Array;
    counter: number;
  }
) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
    authenticator,
  });
}
