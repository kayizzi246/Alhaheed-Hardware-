import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      accountType: user.account_type,
      companyId: user.company_id || null,
      name: user.full_name,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
