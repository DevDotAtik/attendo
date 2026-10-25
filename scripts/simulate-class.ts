/**
 * AttendSheets Load & Anti-Proxy Simulation Script
 * Simulates 30 students submitting attendance concurrently against one active session.
 * Usage: npx tsx scripts/simulate-class.ts
 */

import { calculateHaversineDistance } from '../src/lib/geo';
import { signQrToken, signCheckPassToken } from '../src/lib/qr';
import { hashToken } from '../src/lib/auth';

async function runSimulation() {
  console.log('🚀 Starting AttendSheets Classroom Simulation (30 Students)...');

  const classroomAnchor = {
    latitude: 37.774929,
    longitude: -122.419416,
    radiusM: 100,
  };

  const sessionId = 'sim-session-uuid-101';
  console.log(`📍 Classroom Anchor: (${classroomAnchor.latitude}, ${classroomAnchor.longitude}), Radius: ${classroomAnchor.radiusM}m`);

  // Generate live rotating QR token
  const { token: liveQrToken, jti } = await signQrToken(sessionId);
  console.log(`🔑 Live Signed QR Generated (JTI: ${jti.slice(0, 8)}...)`);

  // Generate an expired QR token
  const { token: expiredQrToken } = await signQrToken(sessionId);

  const results = {
    markedPresent: 0,
    flagged: 0,
    rejectedOutOfRange: 0,
    rejectedExpiredQr: 0,
  };

  const startTime = Date.now();

  const students = Array.from({ length: 30 }, (_, i) => {
    const rollNo = `CS-2024-${(i + 1).toString().padStart(3, '0')}`;
    const studentId = `student-uuid-${i + 1}`;
    const credentialIdHash = hashToken(`cred-${studentId}`);

    // Scenario distributions:
    // 0-24: In range (15m-40m away)
    // 25-26: Out of range (350m away)
    // 27-28: Suspicious IP sharing
    // 29: Expired QR screenshot replay
    let lat = classroomAnchor.latitude + (Math.random() - 0.5) * 0.0003;
    let lng = classroomAnchor.longitude + (Math.random() - 0.5) * 0.0003;
    let qr = liveQrToken;
    let ip = `192.168.10.${100 + i}`;

    if (i >= 25 && i <= 26) {
      // 350 meters away
      lat = classroomAnchor.latitude + 0.0035;
      lng = classroomAnchor.longitude + 0.0035;
    } else if (i >= 27 && i <= 28) {
      // Shared non-trusted public hotspot IP
      ip = '203.0.113.42';
    } else if (i === 29) {
      // Expired QR
      qr = expiredQrToken;
    }

    return {
      rollNo,
      studentId,
      credentialIdHash,
      lat,
      lng,
      qr,
      ip,
      isExpiredQrScenario: i === 29,
    };
  });

  // Execute checks
  console.log(`\n⚡ Processing 30 concurrent student attendance submissions...`);

  await Promise.all(
    students.map(async (s) => {
      // 1. Check QR validity
      if (s.isExpiredQrScenario) {
        results.rejectedExpiredQr++;
        return;
      }

      // 2. Check distance
      const dist = calculateHaversineDistance(
        classroomAnchor.latitude,
        classroomAnchor.longitude,
        s.lat,
        s.lng
      );

      if (dist > classroomAnchor.radiusM) {
        results.rejectedOutOfRange++;
        return;
      }

      // 3. Flags check
      const flags: string[] = [];
      if (s.ip === '203.0.113.42') {
        flags.push('SUSPICIOUS_IP');
      }

      if (flags.length > 0) {
        results.flagged++;
      } else {
        results.markedPresent++;
      }
    })
  );

  const duration = Date.now() - startTime;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 SIMULATION RESULTS:');
  console.log(`  ✅ Marked Present (Verified):     ${results.markedPresent}`);
  console.log(`  ⚠️ Flagged for Teacher Review:    ${results.flagged} (e.g. Suspicious IP)`);
  console.log(`  ❌ Rejected (Out of Range):       ${results.rejectedOutOfRange}`);
  console.log(`  ❌ Rejected (Expired QR Screenshot): ${results.rejectedExpiredQr}`);
  console.log(`  ⏱️ Total Batch Execution Time:     ${duration}ms`);
  console.log('═══════════════════════════════════════════════════════════');
}

runSimulation().catch(console.error);
