/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config({ path: process.cwd() + '/.env' });
import bcrypt from 'bcryptjs';
import readline from 'readline';
import { connectDB } from '../db';
import { User } from '../models/User';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n=== SpellWise Teacher Account Creator ===\n');
  
  await connectDB();
  console.log('✅ Connected to database\n');

  // Get username
  let username = '';
  let isUnique = false;
  
  while (!isUnique) {
    username = await question('Enter teacher username: ');
    username = username.trim();
    
    if (!username) {
      console.log('❌ Username cannot be empty\n');
      continue;
    }
    
    const existing = await User.findOne({ username, role: 'teacher' });
    if (existing) {
      console.log(`❌ Username "${username}" is already taken. Try another.\n`);
    } else {
      console.log('✅ Username is available!\n');
      isUnique = true;
    }
  }

  // Get password
  let password = '';
  while (!password) {
    password = await question('Enter password (min 4 characters): ');
    password = password.trim();
    
    if (password.length < 4) {
      console.log('❌ Password must be at least 4 characters\n');
      password = '';
    }
  }

  // Create teacher
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash, role: 'teacher' });
  
  console.log('\n✅ Teacher account created successfully!');
  console.log(`   Username: ${username}`);
  console.log(`   ID: ${String(user._id)}\n`);
  
  rl.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  rl.close();
  process.exit(1);
});
