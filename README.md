# AttendSheets

**AttendSheets** is a fair, proxy-resistant classroom attendance platform.

Instead of calling names, a teacher launches an attendance session, projects a **10-second rotating QR code** onto the classroom board, and students scan it on their mobile phones. Submissions are authenticated using **platform WebAuthn biometric passkeys** (Touch ID / Face ID) and validated against **server-side GPS proximity** within the teacher's classroom anchor radius.

---

## Architecture Overview

```mermaid
flowchart TD
    Teacher[Teacher Laptop / Mobile] -->|1. Starts Session + GPS Anchor| Backend[Next.js App Router Backend]
    Backend -->|2. Stores Session Anchor| DB[(PostgreSQL 15)]
    Backend -->|3. Generates boardUrl| Board[Classroom Display Board]

    Board -->|4. SSE Stream /api/board/.../stream| Backend
    Backend -->|5. Rotating Signed JWT QR every 10s| Board
    Backend -.->|Nonces with 20s TTL| Redis[(Redis 7 / Memory Cache)]

    Student[Student Registered Phone] -->|6. Scans Board QR| MobileWeb[Student WebApp /s/:token]
    MobileWeb -->|7. Captures GPS + Checks Proximity| Backend
    Backend -->|8. Validates Distance & Nonce| Backend
    MobileWeb -->|9. Signs WebAuthn Biometric Passkey| Backend
    Backend -->|10. Records Attendance / Flags Anomalies| DB
    Backend -->|11. Live SSE Attendance Stream| Teacher
```

---

## Threat Model & Anti-Proxy Mitigations

| Attack Scenario | Threat Vector | AttendSheets Mitigation |
| :--- | :--- | :--- |
| **Screenshot Forwarding** | A student photographs the board and sends it to an absent friend. | QR rotates every **10 seconds** with signed JWTs (15s TTL). Server validates single-use nonces (`jti`) in Redis. Old photos fail with `QR_EXPIRED`. |
| **Dorm / Remote Submission** | Absent student tries submitting from outside class. | Server calculates **Haversine distance** against teacher's classroom GPS anchor. Rejected if distance > radius (`OUT_OF_RANGE`). |
| **Proxy Marking on Laptop** | A student signs in on a friend's laptop in class. | **WebAuthn Platform Passkey**: Students bind their physical phone passkey. Laptops without the platform private key fail biometric assertion (`PASSKEY_FAILED`). |
| **GPS Spoofing Tools** | Student uses mock-location apps or browser dev tools. | Server rejects coarse accuracy (>50m). Compares two consecutive readings for identical decimals (typical spoof signature) and impossible jumps, flagging `SUSPICIOUS_LOCATION`. |
| **Replay Submissions** | Resubmitting previously captured requests. | Cryptographic `checkPassToken` (3 min TTL) bound to `(studentId, sessionId, credentialIdHash)`. DB constraints `UNIQUE(sessionId, studentId)` and `UNIQUE(sessionId, credentialIdHash)`. |
| **Campus WiFi NAT** | Multiple students share one public IP. | **Honest Signal**: AttendSheets maintains a `TrustedIp` CIDR list. Sharing campus WiFi is allowed; sharing non-trusted cellular hotspots flags `SUSPICIOUS_IP` for teacher review instead of dropping. |

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router, Route Handlers) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui design tokens, mobile-first, Dark Mode
- **Database**: PostgreSQL 15 + Prisma ORM
- **Cache & Nonces**: Redis 7 (`ioredis`) with seamless in-memory fallback
- **Authentication**: `jose` (JWT access cookies, 15m), rotating refresh tokens (7d), bcrypt
- **Device Passkeys**: `@simplewebauthn/server` and `@simplewebauthn/browser`
- **QR Rendering**: `qrcode`
- **Real-Time**: Server-Sent Events (SSE) Route Handlers

---

## Getting Started

### 1. Prerequisites
- Node.js 18+ (tested on Node v20/v22)
- PostgreSQL & Redis (or Docker)

### 2. Setup Environment
```bash
cp .env.example .env
npm install
```

Configure your database connection in `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/attendsheets?schema=public"
REDIS_URL="redis://localhost:6379"
```

### 3. Database Migration & Seed
```bash
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```
*Default Seed Credentials:*
- Teacher: `teacher@university.edu` / `Password123!`
- Students: `alice@university.edu`, `bob@university.edu`, `charlie@university.edu`, `diana@university.edu`, `ethan@university.edu` / `Password123!`

### 4. Local HTTPS Setup (Required for Geolocation, Camera, and WebAuthn)
Modern browsers require a secure origin (HTTPS or `localhost`) for WebAuthn passkeys and high-accuracy geolocation.

To run with local HTTPS using `mkcert`:
```bash
# Install mkcert (e.g. brew install mkcert or apt install mkcert)
mkcert -install
mkcert localhost 127.0.0.1

# Run Next.js with HTTPS
npm run dev -- --experimental-https
```
Or use a secure tunnel (e.g. `cloudflared` or `ngrok`):
```bash
cloudflared tunnel --url http://localhost:3000
```

### 5. Running Tests
```bash
npm test
```

### 6. Classroom Simulation Script
Run the 30-student load test against the anti-proxy verification engine:
```bash
npx tsx scripts/simulate-class.ts
```

---

## API Documentation

### Authentication
- `POST /api/auth/register` — Create teacher or student account
- `POST /api/auth/login` — Sign in and receive secure cookies
- `POST /api/auth/refresh` — Rotate refresh token and obtain new access JWT
- `POST /api/auth/logout` — Revoke session and clear cookies
- `GET /api/auth/me` — Current authenticated session context

### WebAuthn Device Binding
- `POST /api/webauthn/register/options` — Generate platform passkey creation options
- `POST /api/webauthn/register/verify` — Verify attestation and bind device to student
- `POST /api/webauthn/assert/options` — Generate challenge for biometric sign-off
- `POST /api/webauthn/assert/verify` — Verify biometric signature

### Templates & Sessions
- `GET, POST /api/templates` — List and create custom form templates
- `GET, PATCH, DELETE /api/templates/:id` — Manage specific template
- `GET, POST /api/sessions` — List sessions and start new attendance session with GPS anchor
- `POST /api/sessions/:id/close` — Close active session
- `GET /api/sessions/:id/live` — SSE stream of real-time attendance for teacher
- `GET /api/sessions/:id/export` — Download session attendance as CSV
- `GET /api/sessions/export?month=YYYY-MM` — Download monthly consolidated CSV

### Classroom Board
- `GET /board/:boardToken` — Full-screen classroom display page
- `GET /api/board/:boardToken/stream` — SSE stream emitting 10-second rotating signed QR codes

### Attendance Submission
- `POST /api/attendance/check` — Verify rotating QR token and GPS proximity; returns form schema and `checkPassToken`
- `POST /api/attendance/submit` — Submit form responses signed with WebAuthn passkey
