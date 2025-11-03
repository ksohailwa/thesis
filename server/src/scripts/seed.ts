import dotenv from 'dotenv';
dotenv.config({ path: process.cwd() + '/.env' });
import bcrypt from 'bcryptjs';
import { connectDB } from '../db';
import { User } from '../models/User';
import { StoryTemplate } from '../models/StoryTemplate';
import { ClassSession } from '../models/ClassSession';

async function main() {
  await connectDB();

  const email = 'teacher@example.com';
  const password = 'password123';
  let teacher = await User.findOne({ email });
  if (!teacher) {
    const passwordHash = await bcrypt.hash(password, 10);
    teacher = await User.create({ email, passwordHash, role: 'teacher' });
  }

  const tpl = await StoryTemplate.create({
    owner: teacher._id,
    title: 'Demo Story',
    language: 'en',
    difficulty: 'B2',
    targetWords: ['accommodate', 'rhythm', 'occurred', 'necessary', 'separate'],
    prompt: 'Write a short story embedding each target word twice.',
    storyText: 'This is a demo story including target words. Each word appears twice for gap-fill practice.',
    condition: 'self-generate'
  });

  const session = await ClassSession.create({
    template: tpl._id,
    code: 'DEMO01',
    status: 'live',
    createdBy: teacher._id,
    allowDelayedAfterHours: 24
  });

  console.log('Seed complete');
  console.log('Teacher login:', email, password);
  console.log('Session code:', session.code);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

