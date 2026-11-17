import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@jotaish.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('Set ADMIN_PASSWORD in apps/api/.env before seeding.');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    console.log(`${email} is an admin.`);
    return;
  }
  await prisma.user.create({
    data: { email, name: 'Jotaish Admin', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Created admin ${email}.`);
}

main().finally(() => prisma.$disconnect());
