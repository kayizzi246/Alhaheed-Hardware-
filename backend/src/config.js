import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT || 4000),
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  dbFile: path.resolve(root, process.env.DB_FILE || './data/alhadeed.db'),
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()),
  currency: process.env.CURRENCY || 'UGX',
  shopName: process.env.SHOP_NAME || 'Al Hadeed Hardware',
  otpDevMode: process.env.OTP_DEV_MODE !== 'false',

  // The SMS gateway that carries login codes. "log" prints to the server
  // console and sends nothing, which is what development wants; set a real
  // provider and its credentials to send for real.
  sms: {
    provider: (process.env.SMS_PROVIDER || 'log').toLowerCase(),
    apiKey: process.env.SMS_API_KEY || '',
    username: process.env.SMS_USERNAME || '',
    senderId: process.env.SMS_SENDER_ID || '',
    url: process.env.SMS_URL || '',
  },
};
