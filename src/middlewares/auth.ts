import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/AppError'
import { env } from '../config/env'

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers['authorization']

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized(
      'Header Authorization requerido. Formato: Bearer <token>',
    )
  }

  const token = authHeader.slice(7)

  if (token !== env.API_TOKEN) {
    throw AppError.unauthorized('Token inválido')
  }

  next()
}
