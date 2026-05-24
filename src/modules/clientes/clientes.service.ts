import prisma from '../../config/prisma'
import { AppError } from '../../utils/AppError'
import type { CreateClienteDTO } from './clientes.validators'

export class ClientesService {
  async crear(data: CreateClienteDTO) {
    const existente = await prisma.cliente.findUnique({
      where: { dpi: data.dpi },
    })

    if (existente) {
      throw AppError.conflict(
        `Ya existe un cliente con DPI ${data.dpi}`,
      )
    }

    return prisma.cliente.create({ data })
  }

  async obtenerPorId(id: bigint) {
    const cliente = await prisma.cliente.findUnique({ where: { id } })

    if (!cliente) {
      throw AppError.notFound(`Cliente ${id} no encontrado`)
    }

    return cliente
  }
}
