import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// In-memory data store for testing
interface MockUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'TEACHER' | 'STUDENT';
  createdAt: Date;
  studentProfile?: { rollNo: string; institution: string | null } | null;
  device?: { id: string; credentialIdHash: string; boundAt: Date } | null;
}

interface MockRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const mockDb = {
  users: new Map<string, MockUser>(),
  refreshTokens: new Map<string, MockRefreshToken>(),
  reset() {
    this.users.clear();
    this.refreshTokens.clear();
  },
};

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where, include, select }) => {
        let user: MockUser | undefined;
        if (where.email) {
          user = Array.from(mockDb.users.values()).find((u) => u.email === where.email);
        } else if (where.id) {
          user = mockDb.users.get(where.id);
        }
        if (!user) return null;

        if (select) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            device: user.device
              ? { id: user.device.id, credentialIdHash: user.device.credentialIdHash, boundAt: user.device.boundAt }
              : null,
            studentProfile: user.studentProfile ?? null,
          };
        }

        return {
          ...user,
          device: user.device ?? null,
          studentProfile: user.studentProfile ?? null,
        };
      }),
      create: vi.fn(async ({ data }) => {
        const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const user: MockUser = {
          id,
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role,
          createdAt: new Date(),
        };
        mockDb.users.set(id, user);
        return user;
      }),
    },
    studentProfile: {
      create: vi.fn(async ({ data }) => {
        const user = mockDb.users.get(data.userId);
        if (user) {
          user.studentProfile = { rollNo: data.rollNo, institution: data.institution ?? null };
        }
        return { ...data };
      }),
    },
    refreshToken: {
      create: vi.fn(async ({ data }) => {
        const id = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const token: MockRefreshToken = {
          id,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          revokedAt: null,
        };
        mockDb.refreshTokens.set(data.tokenHash, token);
        return token;
      }),
      findUnique: vi.fn(async ({ where, include }) => {
        const token = mockDb.refreshTokens.get(where.tokenHash);
        if (!token) return null;
        const user = mockDb.users.get(token.userId);
        return {
          ...token,
          user: user
            ? {
                ...user,
                device: user.device ?? null,
              }
            : null,
        };
      }),
      update: vi.fn(async ({ where, data }) => {
        const token = Array.from(mockDb.refreshTokens.values()).find((t) => t.id === where.id);
        if (token && data.revokedAt) {
          token.revokedAt = data.revokedAt;
        }
        return token;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const token of mockDb.refreshTokens.values()) {
          if (where.userId && token.userId === where.userId && (where.revokedAt === null ? token.revokedAt === null : true)) {
            if (data.revokedAt) token.revokedAt = data.revokedAt;
            count++;
          } else if (where.tokenHash && token.tokenHash === where.tokenHash) {
            if (data.revokedAt) token.revokedAt = data.revokedAt;
            count++;
          }
        }
        return { count };
      }),
    },
    $transaction: vi.fn(async (cbOrArray) => {
      if (typeof cbOrArray === 'function') {
        return cbOrArray({
          user: {
            create: vi.fn(async ({ data }) => {
              const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
              const user: MockUser = {
                id,
                name: data.name,
                email: data.email,
                passwordHash: data.passwordHash,
                role: data.role,
                createdAt: new Date(),
              };
              mockDb.users.set(id, user);
              return user;
            }),
          },
          studentProfile: {
            create: vi.fn(async ({ data }) => {
              const user = mockDb.users.get(data.userId);
              if (user) {
                user.studentProfile = { rollNo: data.rollNo, institution: data.institution ?? null };
              }
              return { ...data };
            }),
          },
        });
      }
      return Promise.all(cbOrArray);
    }),
  },
}));

import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as refreshHandler } from '@/app/api/auth/refresh/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { GET as meHandler } from '@/app/api/auth/me/route';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth';

describe('Auth API Routes', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe('POST /api/auth/register', () => {
    it('registers a teacher successfully with 201 and sets httpOnly cookies', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prof. Ada Lovelace',
          email: 'ada@university.edu',
          password: 'SuperSecretPassword123!',
          role: 'TEACHER',
        }),
      });

      const res = await registerHandler(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.user.email).toBe('ada@university.edu');
      expect(json.user.role).toBe('TEACHER');
      expect(json.user.requiresDeviceBinding).toBe(false);

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain(ACCESS_TOKEN_COOKIE);
      expect(setCookie).toContain(REFRESH_TOKEN_COOKIE);
    });

    it('registers a student with roll number successfully', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alan Turing',
          email: 'alan@student.edu',
          password: 'EnigmaPassword123!',
          role: 'STUDENT',
          rollNo: 'CS-2024-042',
          institution: 'MIT',
        }),
      });

      const res = await registerHandler(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.user.requiresDeviceBinding).toBe(true);
    });

    it('rejects student registration missing a roll number with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Anonymous Student',
          email: 'anon@student.edu',
          password: 'Password123!',
          role: 'STUDENT',
        }),
      });

      const res = await registerHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('VALIDATION_ERROR');
    });

    it('rejects duplicate email with 409', async () => {
      const payload = {
        name: 'Teacher One',
        email: 'duplicate@school.edu',
        password: 'Password123!',
        role: 'TEACHER',
      };

      const req1 = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await registerHandler(req1);

      const req2 = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const res = await registerHandler(req2);
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Grace Hopper',
          email: 'grace@navy.mil',
          password: 'CompilerPassword123!',
          role: 'TEACHER',
        }),
      });
      await registerHandler(req);
    });

    it('authenticates valid credentials and issues new cookies', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'grace@navy.mil',
          password: 'CompilerPassword123!',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.user.email).toBe('grace@navy.mil');
      expect(res.headers.get('set-cookie')).toContain(ACCESS_TOKEN_COOKIE);
    });

    it('rejects incorrect password with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'grace@navy.mil',
          password: 'WrongPassword!',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/refresh and rotation', () => {
    it('rotates refresh token and issues fresh access token', async () => {
      // 1. Register user
      const regReq = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Rotate User',
          email: 'rotate@user.org',
          password: 'Password1234!',
          role: 'TEACHER',
        }),
      });
      const regRes = await registerHandler(regReq);
      const cookies = regRes.headers.get('set-cookie') || '';

      // Extract raw refresh token
      const match = cookies.match(/refresh_token=([^;]+)/);
      expect(match).not.toBeNull();
      const rawRefreshToken = match![1];

      // 2. Call refresh
      const refReq = new NextRequest('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        headers: {
          cookie: `refresh_token=${rawRefreshToken}`,
        },
      });

      const refRes = await refreshHandler(refReq);
      expect(refRes.status).toBe(200);
      expect((await refRes.json()).success).toBe(true);

      const newCookies = refRes.headers.get('set-cookie') || '';
      const newMatch = newCookies.match(/refresh_token=([^;]+)/);
      expect(newMatch).not.toBeNull();
      expect(newMatch![1]).not.toBe(rawRefreshToken); // Token was rotated

      // 3. Replay old refresh token -> triggers TOKEN_REUSE_DETECTED
      const replayReq = new NextRequest('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        headers: {
          cookie: `refresh_token=${rawRefreshToken}`,
        },
      });
      const replayRes = await refreshHandler(replayReq);
      expect(replayRes.status).toBe(401);
      expect((await replayRes.json()).error).toBe('TOKEN_REUSE_DETECTED');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user session when valid access token is provided', async () => {
      const regReq = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Session User',
          email: 'session@test.org',
          password: 'Password1234!',
          role: 'TEACHER',
        }),
      });
      const regRes = await registerHandler(regReq);
      const cookies = regRes.headers.get('set-cookie') || '';
      const match = cookies.match(/access_token=([^;]+)/);
      const accessToken = match![1];

      const meReq = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          cookie: `access_token=${accessToken}`,
        },
      });

      const meRes = await meHandler(meReq);
      const json = await meRes.json();

      expect(meRes.status).toBe(200);
      expect(json.user.name).toBe('Session User');
      expect(json.user.email).toBe('session@test.org');
    });

    it('rejects request with missing or invalid access token', async () => {
      const meReq = new NextRequest('http://localhost:3000/api/auth/me');
      const meRes = await meHandler(meReq);
      expect(meRes.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears auth cookies and revokes refresh token', async () => {
      const regReq = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Logout User',
          email: 'logout@test.org',
          password: 'Password1234!',
          role: 'TEACHER',
        }),
      });
      const regRes = await registerHandler(regReq);
      const cookies = regRes.headers.get('set-cookie') || '';
      const match = cookies.match(/refresh_token=([^;]+)/);
      const rawRefreshToken = match![1];

      const logoutReq = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: `refresh_token=${rawRefreshToken}`,
        },
      });

      const logoutRes = await logoutHandler(logoutReq);
      expect(logoutRes.status).toBe(200);

      const clearCookies = logoutRes.headers.get('set-cookie') || '';
      expect(clearCookies).toContain('Max-Age=0');
    });
  });
});
