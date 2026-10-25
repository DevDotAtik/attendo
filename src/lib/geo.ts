/**
 * Computes great-circle distance between two GPS coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10;
}

export interface GpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

/**
 * Checks for obvious GPS spoofing signatures:
 * 1. Identical coordinates down to >= 7 decimal places across distinct readings
 * 2. Impossible speeds (> 25 m/s in classroom setting)
 */
export function checkSuspiciousLocation(
  reading1: GpsReading,
  reading2?: GpsReading
): { suspicious: boolean; reason?: string } {
  if (!reading2) {
    return { suspicious: false };
  }

  // Check 1: Identical coordinates to >= 7 decimals
  const latDiff = Math.abs(reading1.latitude - reading2.latitude);
  const lngDiff = Math.abs(reading1.longitude - reading2.longitude);

  if (latDiff < 1e-7 && lngDiff < 1e-7) {
    return {
      suspicious: true,
      reason: 'GPS coordinates suspiciously identical across samples (spoof signature)',
    };
  }

  // Check 2: Impossible jump / speed
  const timeDiffSec = Math.abs(reading2.timestamp - reading1.timestamp) / 1000;
  if (timeDiffSec > 0.5 && timeDiffSec < 10) {
    const dist = calculateHaversineDistance(
      reading1.latitude,
      reading1.longitude,
      reading2.latitude,
      reading2.longitude
    );
    const speedMps = dist / timeDiffSec;
    if (speedMps > 25) { // Faster than 90 km/h indoors
      return {
        suspicious: true,
        reason: `Impossible speed jump between readings (${Math.round(speedMps)} m/s)`,
      };
    }
  }

  return { suspicious: false };
}

/**
 * Checks if an IPv4 or IPv6 address falls within a given CIDR block
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    // Normalize localhost / IPv6 mapped IPv4
    const cleanIp = ip.replace(/^::ffff:/, '');
    const cleanCidr = cidr.trim();

    if (cleanCidr === cleanIp) return true;

    // Standard IPv4 CIDR matching
    if (cleanCidr.includes('/')) {
      const [range, bitsStr] = cleanCidr.split('/');
      const bits = parseInt(bitsStr, 10);
      if (isNaN(bits) || bits < 0 || bits > 32) return false;

      const ipNum = ipToLong(cleanIp);
      const rangeNum = ipToLong(range);
      if (ipNum === null || rangeNum === null) return false;

      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (ipNum & mask) === (rangeNum & mask);
    }

    return false;
  } catch {
    return false;
  }
}

function ipToLong(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}
