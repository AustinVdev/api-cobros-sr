import type { Request, Response } from 'express'
import { ClientesService } from './clientes.service'
import { createClienteSchema } from './clientes.validators'

const service = new ClientesService()

export const clientesController = {
  async crear(req: Request, res: Response): Promise<void> {
    const data = createClienteSchema.parse(req.body)
    const cliente = await service.crear(data)
    res.status(201).json({ data: cliente })
  },
}
