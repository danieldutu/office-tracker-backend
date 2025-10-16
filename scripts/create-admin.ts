import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@company.com';
  const password = 'admin123';
  const name = 'Admin User';

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log('Admin user already exists!');
    console.log('Email:', email);
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create admin user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'admin',
    },
  });

  console.log('✅ Admin user created successfully!');
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('Role:', user.role);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
