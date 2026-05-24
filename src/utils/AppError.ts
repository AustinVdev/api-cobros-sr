export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'VALIDATION_ERROR', message, details)
  }

  static unauthorized(message = 'No autorizado'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message)
  }

  static notFound(message: string): AppError {
    return new AppError(404, 'NOT_FOUND', message)
  }

  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message)
  }

  static unprocessable(message: string, details?: unknown): AppError {
    return new AppError(422, 'UNPROCESSABLE_ENTITY', message, details)
  }
}
