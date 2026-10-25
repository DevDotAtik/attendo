import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AttendSheets database...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Create Teacher
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@university.edu' },
    update: {},
    create: {
      name: 'Prof. Katherine Johnson',
      email: 'teacher@university.edu',
      passwordHash,
      role: 'TEACHER',
    },
  });

  console.log(`👤 Teacher created: ${teacher.email}`);

  // 2. Create Default Template
  const template = await prisma.formTemplate.create({
    data: {
      teacherId: teacher.id,
      title: 'CS101 Computer Science Lecture',
      fields: [
        { id: '1', name: 'rollNo', label: 'Roll Number', type: 'text', required: true },
        { id: '2', name: 'division', label: 'Division', type: 'dropdown', required: true, options: ['Div A', 'Div B', 'Div C'] },
      ],
    },
  });

  // 3. Create Trusted Campus WiFi IP
  await prisma.trustedIp.create({
    data: {
      teacherId: teacher.id,
      cidr: '192.168.1.0/24',
    },
  });

  // 4. Create 5 Students
  const studentData = [
    { name: 'Alice Smith', rollNo: 'CS-2024-001', email: 'alice@university.edu', hasDevice: true },
    { name: 'Bob Jones', rollNo: 'CS-2024-002', email: 'bob@university.edu', hasDevice: true },
    { name: 'Charlie Brown', rollNo: 'CS-2024-003', email: 'charlie@university.edu', hasDevice: true },
    { name: 'Diana Prince', rollNo: 'CS-2024-004', email: 'diana@university.edu', hasDevice: true },
    { name: 'Ethan Hunt', rollNo: 'CS-2024-005', email: 'ethan@university.edu', hasDevice: false }, // Needs passkey enrollment
  ];

  for (const s of studentData) {
    const student = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        name: s.name,
        email: s.email,
        passwordHash,
        role: 'STUDENT',
        studentProfile: {
          create: {
            rollNo: s.rollNo,
            institution: 'State University',
          },
        },
      },
    });

    if (s.hasDevice) {
      const credId = `cred-${student.id}`;
      const credHash = crypto.createHash('sha256').update(credId).digest('hex');

      await prisma.device.upsert({
        where: { userId: student.id },
        update: {},
        create: {
          userId: student.id,
          credentialId: credId,
          credentialIdHash: credHash,
          publicKey: Buffer.from('mock-public-key').toString('base64'),
          counter: BigInt(1),
          transports: ['internal'],
        },
      });
    }

    console.log(`🎓 Student created: ${s.name} (${s.rollNo}) - Device Bound: ${s.hasDevice}`);
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
