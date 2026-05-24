import { z } from 'zod'

export const createClienteSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(255),
  dpi: z
    .string()
    .min(1, 'El DPI es requerido')
    .max(20)
    .regex(/^\d+$/, 'El DPI debe contener solo dígitos'),
  email: z.string().email('Email inválido').optional(),
  telefono: z.string().max(20).optional(),
})

export type CreateClienteDTO = z.infer<typeof createClienteSchema>
