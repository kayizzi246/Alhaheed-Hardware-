import { badRequest } from '../utils/errors.js';

/** Validate req.body against a zod schema and replace it with the parsed value. */
export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      return next(badRequest(`${first.path.join('.') || 'body'}: ${first.message}`));
    }
    req.body = result.data;
    next();
  };
}
