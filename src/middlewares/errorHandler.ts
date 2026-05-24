import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '../generated/prisma/client'
import { AppError } from '../utils/AppError'
import { logger } from '../config/logger'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Validación fallida',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'El recurso ya existe (restricción de unicidad)',
        },
      })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' },
      })
      return
    }
  }

  logger.error(err, 'Unhandled error')

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error inesperado',
    },
  })
}
