import bcrypt from 'bcryptjs';

const admin = await bcrypt.hash('admin123', 10);
const member = await bcrypt.hash('member123', 10);

console.log('Admin hash (admin123):', admin);
console.log('Member hash (member123):', member);
