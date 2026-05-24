import { z } from 'zod'

export const createCobroSchema = z.object({
  clienteId: z
    .number({ invalid_type_error: 'clienteId debe ser un número' })
    .int()
    .positive('clienteId debe ser positivo'),
  monto: z
    .number({ invalid_type_error: 'monto debe ser un número' })
    .positive('El monto debe ser mayor a 0'),
  moneda: z.string().length(3, 'La moneda debe ser un código de 3 letras').default('GTQ'),
  referenciaExterna: z.string().max(100).optional(),
})

export const procesarLoteSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1, 'Se requiere al menos un ID'),
})

export const filtrosCobrosSchema = z
  .object({
    estado: z.enum(['PENDIENTE', 'PROCESADO', 'FALLIDO']).optional(),
    desde: z
      .string()
      .refine(
        (v) => !isNaN(new Date(v).getTime()),
        'Formato de fecha inválido. Use ISO 8601 (ej: 2024-01-01T00:00:00Z)',
      )
      .optional(),
    hasta: z
      .string()
      .refine(
        (v) => !isNaN(new Date(v).getTime()),
        'Formato de fecha inválido. Use ISO 8601 (ej: 2024-12-31T23:59:59Z)',
      )
      .optional(),
  })
  .refine(
    ({ desde, hasta }) =>
      !desde || !hasta || new Date(desde) <= new Date(hasta),
    { message: 'La fecha "desde" debe ser anterior o igual a "hasta"' },
  )

export type CreateCobroDTO = z.infer<typeof createCobroSchema>
export type ProcesarLoteDTO = z.infer<typeof procesarLoteSchema>
export type FiltrosCobrosDTO = z.infer<typeof filtrosCobrosSchema>
