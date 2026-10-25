# Security Policy & Limitations Analysis

AttendSheets is designed to maximize attendance fairness while respecting user privacy and browser trust boundaries.

---

## Threat Model & Design Trade-Offs

### 1. Physical Device Hand-Off
- **Limitation**: If Student A physically brings Student B's unlocked phone into class (or Student B unlocks it with their fingerprint beforehand), Student A can mark attendance for Student B.
- **Why Web Browsers Cannot Prevent This**: Browsers attest device possession and cryptographic key ownership, not the biometric owner's live intent beyond local user verification.
- **Mitigations in AttendSheets**:
  - WebAuthn `userVerification: "required"` prompts fresh biometrics immediately prior to submission.
  - Strict composite constraint `UNIQUE(sessionId, credentialIdHash)` prevents one phone from marking more than one student per session.
- **Recommended Future Enhancements**:
  - Live face liveness verification.
  - Short-range BLE beacon proximity or ultrasonic room pairing.

### 2. Browser GPS Mocking
- **Limitation**: Web browsers do not expose a reliable hardware flag indicating whether location is mocked or derived from GPS vs WiFi triangulation.
- **Mitigations in AttendSheets**:
  - GPS accuracy > 50m is rejected (`LOW_GPS_ACCURACY`), blocking desktop browsers and coarse WiFi guesses.
  - Dual-sample heuristic checks consecutive readings: identical float decimals or impossible jump velocities flag `SUSPICIOUS_LOCATION` for teacher review.
  - Client signals verify mobile user agent characteristics; non-mobile clients are flagged (`NON_MOBILE_CLIENT`).

### 3. Campus WiFi NAT vs. Single-IP Restrictions
- **Design Decision**: Hard "one IP = one attendance" blocks are deliberately **not** implemented.
- **Rationale**: On typical university campus WiFi networks, hundreds of students share a single egress NAT IP. A hard one-IP restriction would break the system for legitimate classes.
- **Mitigation**:
  - Teachers configure campus WiFi subnets (`TrustedIp`).
  - Outside of trusted campus networks, duplicate IP usage triggers a `SUSPICIOUS_IP` warning badge on the teacher's live dashboard, enabling manual verification.

### 4. Privacy by Design
- **No Permanent Coordinate Tracking**:
  - Student GPS coordinates are evaluated in volatile memory during the proximity check and discarded immediately.
  - Only the calculated distance (`distanceM`) and status flags are retained.
  - Teacher anchor coordinates are strictly scoped to the session.

---

## Reporting Vulnerabilities

If you identify a security vulnerability in AttendSheets, please disclose it responsibly by contacting the maintainers directly.
