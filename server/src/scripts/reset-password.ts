import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { User } from '../models/User';

async function resetPassword() {
  const [,, username, newPassword] = process.argv;

  if (!username || !newPassword) {
    console.log('Usage: npx tsx src/scripts/reset-password.ts <username> <newPassword>');
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);

  const user = await User.findOne({ username });
  if (!user) {
    console.log(`User "${username}" not found`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.updateOne({ username }, { $set: { passwordHash } });

  console.log(`Password updated for "${username}"`);
  await mongoose.connection.close();
}

resetPassword();
