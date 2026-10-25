import { NextRequest } from 'next/server';

export interface ClientSignalResult {
  flags: string[];
  isMobile: boolean;
  userAgent: string;
  ip: string;
}

export interface ClientSignalProvider {
  evaluateSignals(req: NextRequest, previousSignals?: Partial<ClientSignalResult>): Promise<ClientSignalResult>;
}

export class DefaultClientSignalProvider implements ClientSignalProvider {
  async evaluateSignals(
    req: NextRequest,
    previousSignals?: Partial<ClientSignalResult>
  ): Promise<ClientSignalResult> {
    const flags: string[] = [];

    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const ip =
      req.ip ||
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Check for mobile signature
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const isMobile = mobileRegex.test(userAgent);

    if (!isMobile) {
      flags.push('NON_MOBILE_CLIENT');
    }

    // Check UA consistency between /check and /submit
    if (previousSignals?.userAgent && previousSignals.userAgent !== userAgent) {
      flags.push('USER_AGENT_MISMATCH');
    }

    // Check IP consistency between /check and /submit
    if (previousSignals?.ip && previousSignals.ip !== ip) {
      flags.push('IP_MISMATCH');
    }

    return {
      flags,
      isMobile,
      userAgent,
      ip,
    };
  }
}

export const clientSignalProvider = new DefaultClientSignalProvider();
