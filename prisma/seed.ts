/**
 * Seed de Prisma — alternativa idempotente al init.sql.
 * NOTA: init.sql ya inserta datos de ejemplo al levantar el contenedor por primera vez.
 * Este seed usa upsert para ser idempotente: puede ejecutarse múltiples veces sin duplicar.
 */
import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const clientes = await Promise.all([
    prisma.cliente.upsert({
      where: { dpi: '1234567890101' },
      update: {},
      create: {
        nombre: 'Ana Pérez',
        dpi: '1234567890101',
        email: 'ana.perez@example.com',
        telefono: '50212345678',
      },
    }),
    prisma.cliente.upsert({
      where: { dpi: '2345678910102' },
      update: {},
      create: {
        nombre: 'Carlos López',
        dpi: '2345678910102',
        email: 'carlos.lopez@example.com',
      },
    }),
    prisma.cliente.upsert({
      where: { dpi: '3456789120103' },
      update: {},
      create: {
        nombre: 'María García',
        dpi: '3456789120103',
        telefono: '50298765432',
      },
    }),
  ])

  console.log(`✔ Clientes upsertados: ${clientes.length}`)

  const cobrosExistentes = await prisma.cobro.count({
    where: { referenciaExterna: { in: ['REF-001', 'REF-002', 'REF-003', 'REF-004'] } },
  })

  if (cobrosExistentes === 0) {
    await prisma.cobro.createMany({
      data: [
        {
          clienteId: clientes[0].id,
          monto: new Prisma.Decimal('500.00'),
          moneda: 'GTQ',
          referenciaExterna: 'REF-001',
        },
        {
          clienteId: clientes[0].id,
          monto: new Prisma.Decimal('1500.00'),
          moneda: 'GTQ',
          referenciaExterna: 'REF-002',
        },
        {
          clienteId: clientes[1].id,
          monto: new Prisma.Decimal('750.50'),
          moneda: 'GTQ',
          referenciaExterna: 'REF-003',
        },
        {
          clienteId: clientes[2].id,
          monto: new Prisma.Decimal('2000.00'),
          moneda: 'GTQ',
          referenciaExterna: 'REF-004',
        },
      ],
    })
    console.log('✔ Cobros de ejemplo creados')
  } else {
    console.log('ℹ Cobros de ejemplo ya existen, se omitieron')
  }
}

main()
  .then(() => {
    console.log('Seed completado exitosamente')
    return prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
