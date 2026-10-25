import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { signAccessToken, hashToken } from '@/lib/auth';
import { signQrToken, signCheckPassToken } from '@/lib/qr';
import { cache } from '@/lib/redis';

// Mock DB store for attendance tests
const mockDb = {
  sessions: new Map<string, any>(),
  devices: new Map<string, any>(),
  records: new Map<string, any>(),
  users: new Map<string, any>(),
  reset() {
    this.sessions.clear();
    this.devices.clear();
    this.records.clear();
    this.users.clear();
  },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }) => mockDb.users.get(where.id) || null),
    },
    device: {
      findUnique: vi.fn(async ({ where }) => mockDb.devices.get(where.userId) || null),
      update: vi.fn(async ({ where, data }) => {
        const d = mockDb.devices.get(where.id);
        if (d) Object.assign(d, data);
        return d;
      }),
    },
    attendanceSession: {
      findUnique: vi.fn(async ({ where }) => mockDb.sessions.get(where.id) || null),
      findFirst: vi.fn(async ({ where }) => {
        return Array.from(mockDb.sessions.values()).find((s) => s.id === where.id) || null;
      }),
    },
    attendanceRecord: {
      findMany: vi.fn(async ({ where }) => {
        const records = Array.from(mockDb.records.values());
        return records.filter((r) => !where?.sessionId || r.sessionId === where.sessionId);
      }),
      findFirst: vi.fn(async ({ where }) => {
        const records = Array.from(mockDb.records.values());
        return (
          records.find((r) => {
            if (r.sessionId !== where.sessionId) return false;
            if (where.studentId && r.studentId === where.studentId) return true;
            if (where.credentialIdHash && r.credentialIdHash === where.credentialIdHash) return true;
            if (where.OR) {
              return where.OR.some(
                (o: any) =>
                  (o.studentId && o.studentId === r.studentId) ||
                  (o.credentialIdHash && o.credentialIdHash === r.credentialIdHash) ||
                  (o.ip && o.ip === r.ip)
              );
            }
            return false;
          }) || null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const id = `rec-${Date.now()}-${Math.random()}`;
        const record = { id, ...data, submittedAt: new Date() };
        mockDb.records.set(id, record);
        return record;
      }),
    },
    $transaction: vi.fn(async (cb) => {
      if (typeof cb === 'function') {
        return cb({
          attendanceRecord: {
            findMany: vi.fn(async ({ where }) => {
              const records = Array.from(mockDb.records.values());
              return records.filter((r) => !where?.sessionId || r.sessionId === where.sessionId);
            }),
            findFirst: vi.fn(async ({ where }) => {
              const records = Array.from(mockDb.records.values());
              return (
                records.find((r) => {
                  if (r.sessionId !== where.sessionId) return false;
                  if (where.studentId && r.studentId === where.studentId) return true;
                  if (where.credentialIdHash && r.credentialIdHash === where.credentialIdHash) return true;
                  if (where.OR) {
                    return where.OR.some(
                      (o: any) =>
                        (o.studentId && o.studentId === r.studentId) ||
                        (o.credentialIdHash && o.credentialIdHash === r.credentialIdHash) ||
                        (o.ip && o.ip === r.ip)
                    );
                  }
                  return false;
                }) || null
              );
            }),
            create: vi.fn(async ({ data }) => {
              const id = `rec-${Date.now()}-${Math.random()}`;
              const record = { id, ...data, submittedAt: new Date() };
              mockDb.records.set(id, record);
              return record;
            }),
          },
        });
      }
      return Promise.all(cb);
    }),
  },
}));

import { POST as checkHandler } from '@/app/api/attendance/check/route';
import { POST as submitHandler } from '@/app/api/attendance/submit/route';

describe('Attendance Check & Submit API', () => {
  const studentId = 'student-test-1';
  const sessionId = 'session-test-1';
  const credentialId = 'cred-test-1';
  const credentialIdHash = hashToken(credentialId);

  let studentCookie: string;

  beforeEach(async () => {
    mockDb.reset();

    // Mock student user
    mockDb.users.set(studentId, {
      id: studentId,
      name: 'Alice Student',
      email: 'alice@school.edu',
      role: 'STUDENT',
    });

    // Mock student device
    mockDb.devices.set(studentId, {
      id: 'device-1',
      userId: studentId,
      credentialId,
      credentialIdHash,
      publicKey: Buffer.from('mock-pubkey').toString('base64'),
      counter: BigInt(1),
      transports: ['internal'],
    });

    // Mock active session with anchor in San Francisco
    mockDb.sessions.set(sessionId, {
      id: sessionId,
      teacherId: 'teacher-1',
      anchorLat: 37.774929,
      anchorLng: -122.419416,
      anchorAccuracy: 10,
      radiusM: 100,
      status: 'ACTIVE',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 600000), // 10 mins
      template: {
        title: 'Algorithms 101',
        fields: [{ id: 'f1', name: 'division', label: 'Division', type: 'text', required: true }],
      },
      teacher: {
        trustedIps: [{ cidr: '192.168.1.0/24' }],
      },
    });

    const token = await signAccessToken({
      sub: studentId,
      role: 'STUDENT',
      credentialIdHash,
    });
    studentCookie = `access_token=${token}`;
  });

  it('passes attendance check when within radius and returns checkPassToken', async () => {
    // Generate QR token and save JTI in cache
    const { token: qrToken, jti } = await signQrToken(sessionId);
    await cache.setex(`qr:jti:${jti}`, 20, sessionId);

    const req = new NextRequest('http://localhost:3000/api/attendance/check', {
      method: 'POST',
      headers: {
        cookie: studentCookie,
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      },
      body: JSON.stringify({
        qrToken,
        reading1: {
          latitude: 37.774935, // ~1m away
          longitude: -122.41942,
          accuracy: 10,
          timestamp: Date.now(),
        },
      }),
    });

    const res = await checkHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(typeof json.checkPassToken).toBe('string');
    expect(json.distanceM).toBeLessThan(100);
    expect(json.formSchema.length).toBe(1);
  });

  it('rejects attendance check if distance exceeds session radius with OUT_OF_RANGE', async () => {
    const { token: qrToken, jti } = await signQrToken(sessionId);
    await cache.setex(`qr:jti:${jti}`, 20, sessionId);

    const req = new NextRequest('http://localhost:3000/api/attendance/check', {
      method: 'POST',
      headers: {
        cookie: studentCookie,
      },
      body: JSON.stringify({
        qrToken,
        reading1: {
          latitude: 37.784929, // ~1.1km away
          longitude: -122.419416,
          accuracy: 10,
          timestamp: Date.now(),
        },
      }),
    });

    const res = await checkHandler(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('OUT_OF_RANGE');
  });

  it('rejects stale GPS timestamp with LOW_GPS_ACCURACY', async () => {
    const { token: qrToken, jti } = await signQrToken(sessionId);
    await cache.setex(`qr:jti:${jti}`, 20, sessionId);

    const req = new NextRequest('http://localhost:3000/api/attendance/check', {
      method: 'POST',
      headers: { cookie: studentCookie },
      body: JSON.stringify({
        qrToken,
        reading1: {
          latitude: 37.774929,
          longitude: -122.419416,
          accuracy: 10,
          timestamp: Date.now() - 40000, // 40s old (> 30s)
        },
      }),
    });

    const res = await checkHandler(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('LOW_GPS_ACCURACY');
  });

  it('rejects expired QR tokens without matching cache JTI with QR_EXPIRED', async () => {
    const { token: qrToken } = await signQrToken(sessionId);
    // Do not set JTI in cache (simulates old rotated QR or screenshot)

    const req = new NextRequest('http://localhost:3000/api/attendance/check', {
      method: 'POST',
      headers: { cookie: studentCookie },
      body: JSON.stringify({
        qrToken,
        reading1: {
          latitude: 37.774929,
          longitude: -122.419416,
          accuracy: 10,
          timestamp: Date.now(),
        },
      }),
    });

    const res = await checkHandler(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('QR_EXPIRED');
  });

  it('allows attendance check when location permission is denied and adds review flag', async () => {
    const { token: qrToken, jti } = await signQrToken(sessionId);
    await cache.setex(`qr:jti:${jti}`, 20, sessionId);

    const req = new NextRequest('http://localhost:3000/api/attendance/check', {
      method: 'POST',
      headers: {
        cookie: studentCookie,
      },
      body: JSON.stringify({
        qrToken,
        locationDenied: true,
      }),
    });

    const res = await checkHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(typeof json.checkPassToken).toBe('string');
    expect(json.locationDenied).toBe(true);
    expect(json.flags).toContain('LOCATION_PERMISSION_DENIED');
  });

  it('records attendance successfully and prevents duplicate submissions', async () => {
    const checkPassToken = await signCheckPassToken({
      studentId,
      sessionId,
      credentialIdHash,
    });

    // 1. Submit attendance
    const submitReq1 = new NextRequest('http://localhost:3000/api/attendance/submit', {
      method: 'POST',
      headers: { cookie: studentCookie },
      body: JSON.stringify({
        checkPassToken,
        formData: { division: 'Div A' },
      }),
    });

    const submitRes1 = await submitHandler(submitReq1);
    expect(submitRes1.status).toBe(200);
    const json1 = await submitRes1.json();
    expect(json1.success).toBe(true);

    // 2. Submit attendance again with same student / credential -> ALREADY_MARKED (409)
    const submitReq2 = new NextRequest('http://localhost:3000/api/attendance/submit', {
      method: 'POST',
      headers: { cookie: studentCookie },
      body: JSON.stringify({
        checkPassToken,
        formData: { division: 'Div A' },
      }),
    });

    const submitRes2 = await submitHandler(submitReq2);
    expect(submitRes2.status).toBe(409);
    expect((await submitRes2.json()).error).toBe('ALREADY_MARKED');
  });

  it('allows guest attendance submission via deviceToken without login and prevents duplicate device & rollNo submission', async () => {
    const rawDeviceToken1 = 'guest-android-device-token-123';
    const guestCredentialHash1 = hashToken(rawDeviceToken1);

    const { token: qrToken, jti } = await signQrToken(sessionId);
    await cache.setex(`qr:jti:${jti}`, 20, sessionId);

    // 1. Check endpoint called without any auth cookies, only deviceToken
    const checkReq = new NextRequest('http://localhost:3000/api/attendance/check', {
      method: 'POST',
      body: JSON.stringify({
        qrToken,
        deviceToken: rawDeviceToken1,
        locationDenied: true,
      }),
    });

    const checkRes = await checkHandler(checkReq);
    expect(checkRes.status).toBe(200);
    const checkJson = await checkRes.json();
    expect(checkJson.success).toBe(true);
    expect(typeof checkJson.checkPassToken).toBe('string');

    // 2. Submit attendance without auth cookie
    const submitReq1 = new NextRequest('http://localhost:3000/api/attendance/submit', {
      method: 'POST',
      body: JSON.stringify({
        checkPassToken: checkJson.checkPassToken,
        formData: { rollNo: 'CS-2024-999', name: 'Camera Scanner Student' },
      }),
    });

    const submitRes1 = await submitHandler(submitReq1);
    expect(submitRes1.status).toBe(200);
    const submitJson1 = await submitRes1.json();
    expect(submitJson1.success).toBe(true);

    // 3. Same device attempting to submit again -> 409 ALREADY_MARKED
    const checkPassTokenDupeDevice = await signCheckPassToken({
      studentId: 'guest',
      sessionId,
      credentialIdHash: guestCredentialHash1,
    });
    const submitReqDupeDevice = new NextRequest('http://localhost:3000/api/attendance/submit', {
      method: 'POST',
      body: JSON.stringify({
        checkPassToken: checkPassTokenDupeDevice,
        formData: { rollNo: 'CS-2024-888', name: 'Different Name Same Phone' },
      }),
    });
    const submitResDupeDevice = await submitHandler(submitReqDupeDevice);
    expect(submitResDupeDevice.status).toBe(409);
    expect((await submitResDupeDevice.json()).error).toBe('ALREADY_MARKED');

    // 4. Different device attempting to submit duplicate rollNo -> 409 ROLL_ALREADY_MARKED
    const rawDeviceToken2 = 'different-phone-token-456';
    const guestCredentialHash2 = hashToken(rawDeviceToken2);
    const checkPassTokenDupeRoll = await signCheckPassToken({
      studentId: 'guest',
      sessionId,
      credentialIdHash: guestCredentialHash2,
    });
    const submitReqDupeRoll = new NextRequest('http://localhost:3000/api/attendance/submit', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '198.51.100.2',
      },
      body: JSON.stringify({
        checkPassToken: checkPassTokenDupeRoll,
        formData: { rollNo: 'CS-2024-999', name: 'Proxy For Friend' },
      }),
    });
    const submitResDupeRoll = await submitHandler(submitReqDupeRoll);
    expect(submitResDupeRoll.status).toBe(409);
    expect((await submitResDupeRoll.json()).error).toBe('ROLL_ALREADY_MARKED');

    // 5. Cleared cache test: New deviceToken generated on same phone, but SAME IP -> 409 ALREADY_MARKED
    const rawDeviceTokenClearedCache = 'cleared-cache-fresh-token-789';
    const checkReqClearedCache = new NextRequest('http://localhost:3000/api/attendance/check', {
      method: 'POST',
      body: JSON.stringify({
        qrToken,
        deviceToken: rawDeviceTokenClearedCache,
        locationDenied: true,
      }),
    });
    const checkResClearedCache = await checkHandler(checkReqClearedCache);
    expect(checkResClearedCache.status).toBe(409);
    expect((await checkResClearedCache.json()).error).toBe('ALREADY_MARKED');
  });
});
