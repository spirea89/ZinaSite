export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly expose: boolean;

  constructor(code: string, message: string, statusCode = 400, expose = true) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.expose = expose;
  }
}

export function publicError(error: unknown): { code: string; message: string; statusCode: number } {
  if (error instanceof ApiError && error.expose) {
    return { code: error.code, message: error.message, statusCode: error.statusCode };
  }
  return { code: 'INTERNAL_ERROR', message: 'The request could not be completed.', statusCode: 500 };
}

