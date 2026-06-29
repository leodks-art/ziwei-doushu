import { pbkdf2Sync, randomBytes } from 'crypto';
import { stdin as input, stdout as output } from 'process';
import readline from 'readline/promises';

const password = process.argv[2] || await promptPassword();
if (!password || password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}

const iterations = 210_000;
const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
console.log(`pbkdf2$${iterations}$${salt}$${hash}`);

async function promptPassword() {
  const rl = readline.createInterface({ input, output });
  const value = await rl.question('Admin password to hash: ');
  rl.close();
  return value;
}
