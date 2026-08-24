import mongoose from 'mongoose';

export async function connect(uri) {
  if (!uri) throw new Error('MONGODB_URI is not set — copy .env.example to .env and fill in your password');
  if (uri.includes('<db_password>')) {
    throw new Error('MONGODB_URI still contains the <db_password> placeholder — put your real Atlas password in server/.env');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`[db] connected to ${mongoose.connection.name}`);
  return mongoose.connection;
}
