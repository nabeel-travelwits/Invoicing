import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
    console.error('Please provide a password as an argument.');
    console.log('Usage: node hash_password.js YourSecretPassword');
    process.exit(1);
}

const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('\n--- HASH GENERATED ---');
console.log('Password:', password);
console.log('Hashed Password:', hash);
console.log('----------------------\n');
console.log('Run this SQL in Supabase to add/update your user:');
console.log(`INSERT INTO auth_users (email, password_hash, full_name) \nVALUES ('nabeel@travelwits.com', '${hash}', 'Nabeel') \nON CONFLICT (email) DO UPDATE SET password_hash = '${hash}';`);
