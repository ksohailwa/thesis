import dotenv from 'dotenv';
dotenv.config({ path: process.cwd() + '/.env' });
import bcrypt from 'bcryptjs';
import { connectDB } from '../db';
import { User } from '../models/User';

async function main() {
  const username = process.env.USERNAME || process.argv[2];
  const password = process.env.PASSWORD || process.argv[3];
  if (!username || !password) {
    console.error('Usage: USERNAME=<name> PASSWORD=<pass> tsx src/scripts/create-student.ts');
    process.exit(1);
  }
  await connectDB();
  const existing = await User.findOne({ username });
  if (existing) { console.error('Username already exists'); process.exit(2); }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash, role: 'student' });
  console.log('Created student:', username, 'id=', String(user._id));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

