/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config({ path: process.cwd() + '/.env' });
import bcrypt from 'bcryptjs';
import { connectDB } from '../db';
import { User } from '../models/User';

async function main() {
  // Prioritize CLI args over env vars (USERNAME is a Windows system variable)
  const username = process.argv[2] || process.env.TEACHER_USERNAME;
  const password = process.argv[3] || process.env.TEACHER_PASSWORD;
  if (!username || !password) {
    console.error('Usage: npx tsx src/scripts/create-teacher.ts <username> <password>');
    console.error('   or: TEACHER_USERNAME=<name> TEACHER_PASSWORD=<pass> npx tsx src/scripts/create-teacher.ts');
    process.exit(1);
  }
  await connectDB();
  const existing = await User.findOne({ username, role: 'teacher' });
  if (existing) {
    console.error('Teacher username already exists');
    process.exit(2);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash, role: 'teacher' });
  console.log('Created teacher:', username, 'id=', String(user._id));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
