import { Router } from 'express'
import { cobrosController } from './cobros.controller'

export const cobrosRouter = Router()

// /lotes/procesar debe definirse ANTES que /:id/procesar para evitar conflicto de rutas
cobrosRouter.post('/lotes/procesar', cobrosController.procesarLote)
cobrosRouter.post('/', cobrosController.crear)
cobrosRouter.post('/:id/procesar', cobrosController.procesar)
