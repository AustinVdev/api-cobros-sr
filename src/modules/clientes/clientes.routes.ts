import { Router } from 'express'
import { clientesController } from './clientes.controller'
import { cobrosController } from '../cobros/cobros.controller'

export const clientesRouter = Router()

clientesRouter.post('/', clientesController.crear)
clientesRouter.get('/:id/cobros', cobrosController.listarPorCliente)
