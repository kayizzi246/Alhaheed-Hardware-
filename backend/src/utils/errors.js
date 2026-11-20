export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || undefined;
  }
}

export const badRequest = (m, c) => new ApiError(400, m, c);
export const unauthorized = (m = 'Not signed in') => new ApiError(401, m);
export const forbidden = (m = 'You do not have access to this') => new ApiError(403, m);
export const notFound = (m = 'Not found') => new ApiError(404, m);
export const conflict = (m) => new ApiError(409, m);
