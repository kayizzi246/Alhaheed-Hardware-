import { get } from '../db/index.js';
import { verifyToken } from '../utils/tokens.js';
import { unauthorized, forbidden } from '../utils/errors.js';

/** Attach req.user from the Bearer token. Rejects suspended accounts. */
export function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized());

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(unauthorized('Your session has expired, please sign in again'));
  }

  const user = get('SELECT * FROM users WHERE id = ?', [Number(payload.sub)]);
  if (!user) return next(unauthorized('Account no longer exists'));
  if (user.status !== 'active') return next(forbidden('This account has been suspended'));

  req.user = user;
  next();
}

/** Restrict a route to one or more staff/customer roles. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

/** Company owners only (for staff management). */
export function requireCompanyOwner(req, _res, next) {
  if (req.user?.account_type !== 'company_owner') {
    return next(forbidden('Only the company owner can do this'));
  }
  next();
}
