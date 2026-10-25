import { describe, it, expect } from 'vitest';
import { calculateHaversineDistance, isIpInCidr, checkSuspiciousLocation } from './geo';

describe('Geo & Network Anti-Proxy Utilities', () => {
  it('calculates Haversine distance accurately between GPS coordinates', () => {
    // San Francisco coordinates
    const lat1 = 37.774929;
    const lon1 = -122.419416;

    // Same point -> 0 meters
    expect(calculateHaversineDistance(lat1, lon1, lat1, lon1)).toBe(0);

    // Approximate ~111m north (0.001 deg latitude ~ 111m)
    const lat2 = 37.775929;
    const dist = calculateHaversineDistance(lat1, lon1, lat2, lon1);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(125);
  });

  it('matches IPv4 addresses against CIDR subnets', () => {
    expect(isIpInCidr('192.168.1.50', '192.168.1.0/24')).toBe(true);
    expect(isIpInCidr('192.168.2.50', '192.168.1.0/24')).toBe(false);

    expect(isIpInCidr('10.254.12.1', '10.0.0.0/8')).toBe(true);
    expect(isIpInCidr('172.16.0.1', '10.0.0.0/8')).toBe(false);

    expect(isIpInCidr('::ffff:192.168.1.1', '192.168.1.0/24')).toBe(true);
    expect(isIpInCidr('127.0.0.1', '127.0.0.1')).toBe(true);
  });

  it('flags suspicious location readings with identical decimals down to 7 places', () => {
    const r1 = { latitude: 37.77492912, longitude: -122.41941623, accuracy: 10, timestamp: 1000 };
    const r2 = { latitude: 37.77492912, longitude: -122.41941623, accuracy: 10, timestamp: 3000 };

    const check = checkSuspiciousLocation(r1, r2);
    expect(check.suspicious).toBe(true);
    expect(check.reason).toContain('spoof signature');
  });

  it('flags impossible speed jumps between 2-second readings', () => {
    const r1 = { latitude: 37.774929, longitude: -122.419416, accuracy: 10, timestamp: 1000 };
    // Jump 1 km in 2 seconds = 500 m/s
    const r2 = { latitude: 37.784929, longitude: -122.419416, accuracy: 10, timestamp: 3000 };

    const check = checkSuspiciousLocation(r1, r2);
    expect(check.suspicious).toBe(true);
    expect(check.reason).toContain('Impossible speed jump');
  });

  it('passes normal real-world GPS variance without flags', () => {
    const r1 = { latitude: 37.774929, longitude: -122.419416, accuracy: 10, timestamp: 1000 };
    // Small realistic drift: 1.5 meters in 2s
    const r2 = { latitude: 37.774940, longitude: -122.419420, accuracy: 10, timestamp: 3000 };

    const check = checkSuspiciousLocation(r1, r2);
    expect(check.suspicious).toBe(false);
  });
});
