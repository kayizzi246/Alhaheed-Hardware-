import { config } from '../config.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Route not found' });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 && config.env === 'production' ? 'Something went wrong' : err.message,
    code: err.code,
  });
}
