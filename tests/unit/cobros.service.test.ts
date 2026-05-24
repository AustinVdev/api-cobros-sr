import { Prisma, EstadoCobro } from '../../src/generated/prisma/client'
import { AppError } from '../../src/utils/AppError'

// ---------------------------------------------------------------------------
// Mocks — las factories deben ser autocontenidas (jest.mock es hoisted)
// ---------------------------------------------------------------------------

jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    cliente: { findUnique: jest.fn(), create: jest.fn() },
    cobro: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    auditoria: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../src/modules/auditoria/auditoria.service', () => ({
  __esModule: true,
  AuditoriaService: { registrar: jest.fn() },
}))

// Acceso a los mocks después del hoisting
const { default: mockPrisma } = jest.requireMock('../../src/config/prisma') as {
  default: {
    cliente: { findUnique: jest.Mock; create: jest.Mock }
    cobro: {
      findUnique: jest.Mock
      create: jest.Mock
      findMany: jest.Mock
      update: jest.Mock
    }
    auditoria: { create: jest.Mock }
    $transaction: jest.Mock
  }
}

const mockTx = {
  cobro: { update: jest.fn() },
  auditoria: { create: jest.fn() },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCobro(monto: string, estado: EstadoCobro = EstadoCobro.PENDIENTE) {
  return {
    id: BigInt(1),
    clienteId: BigInt(1),
    monto: new Prisma.Decimal(monto),
    moneda: 'GTQ',
    estado,
    fechaCreacion: new Date(),
    fechaProceso: null,
    referenciaExterna: null,
  }
}

// ---------------------------------------------------------------------------
// Tests: CobrosService.procesar
// ---------------------------------------------------------------------------

describe('CobrosService.procesar', () => {
  let service: import('../../src/modules/cobros/cobros.service').CobrosService

  beforeEach(async () => {
    const { CobrosService } = await import('../../src/modules/cobros/cobros.service')
    service = new CobrosService()

    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    )
  })

  it('devuelve estado PROCESADO cuando monto <= 1000', async () => {
    const cobro = makeCobro('500.00')
    mockPrisma.cobro.findUnique.mockResolvedValue(cobro)
    mockTx.cobro.update.mockResolvedValue({ ...cobro, estado: EstadoCobro.PROCESADO })

    const result = await service.procesar(BigInt(1))

    expect(result.estado).toBe(EstadoCobro.PROCESADO)
    expect(mockTx.cobro.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: EstadoCobro.PROCESADO }),
      }),
    )
  })

  it('devuelve estado PROCESADO exactamente con monto = 1000 (límite inclusivo)', async () => {
    const cobro = makeCobro('1000.00')
    mockPrisma.cobro.findUnique.mockResolvedValue(cobro)
    mockTx.cobro.update.mockResolvedValue({ ...cobro, estado: EstadoCobro.PROCESADO })

    const result = await service.procesar(BigInt(1))

    expect(result.estado).toBe(EstadoCobro.PROCESADO)
  })

  it('devuelve estado FALLIDO cuando monto > 1000', async () => {
    const cobro = makeCobro('1500.00')
    mockPrisma.cobro.findUnique.mockResolvedValue(cobro)
    mockTx.cobro.update.mockResolvedValue({ ...cobro, estado: EstadoCobro.FALLIDO })

    const result = await service.procesar(BigInt(1))

    expect(result.estado).toBe(EstadoCobro.FALLIDO)
    expect(mockTx.cobro.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: EstadoCobro.FALLIDO }),
      }),
    )
  })

  it('lanza 404 si el cobro no existe', async () => {
    mockPrisma.cobro.findUnique.mockResolvedValue(null)

    await expect(service.procesar(BigInt(99))).rejects.toBeInstanceOf(AppError)
    await expect(service.procesar(BigInt(99))).rejects.toMatchObject({ statusCode: 404 })
  })

  it('lanza 409 si el cobro ya fue procesado (idempotencia individual)', async () => {
    const cobro = makeCobro('500.00', EstadoCobro.PROCESADO)
    mockPrisma.cobro.findUnique.mockResolvedValue(cobro)

    await expect(service.procesar(BigInt(1))).rejects.toBeInstanceOf(AppError)
    await expect(service.procesar(BigInt(1))).rejects.toMatchObject({ statusCode: 409 })
  })

  it('lanza 409 si el cobro tiene estado FALLIDO', async () => {
    const cobro = makeCobro('2000.00', EstadoCobro.FALLIDO)
    mockPrisma.cobro.findUnique.mockResolvedValue(cobro)

    await expect(service.procesar(BigInt(1))).rejects.toMatchObject({ statusCode: 409 })
  })
})

// ---------------------------------------------------------------------------
// Tests: CobrosService.procesarLote — idempotencia y regla de negocio
// ---------------------------------------------------------------------------

describe('CobrosService.procesarLote', () => {
  let service: import('../../src/modules/cobros/cobros.service').CobrosService

  beforeEach(async () => {
    const { CobrosService } = await import('../../src/modules/cobros/cobros.service')
    service = new CobrosService()
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    )
  })

  it('omite cobros que ya no están en PENDIENTE (idempotencia)', async () => {
    const cobros = [
      { ...makeCobro('500.00', EstadoCobro.PROCESADO), id: BigInt(1) },
      { ...makeCobro('1500.00', EstadoCobro.FALLIDO), id: BigInt(2) },
    ]
    mockPrisma.cobro.findMany.mockResolvedValue(cobros)

    const resultado = await service.procesarLote([1, 2])

    expect(resultado.omitidos).toBe(2)
    expect(resultado.procesados).toBe(0)
    expect(resultado.fallidos).toBe(0)
    expect(mockTx.cobro.update).not.toHaveBeenCalled()
  })

  it('procesa correctamente un lote mixto (PENDIENTE + ya procesados)', async () => {
    const cobros = [
      { ...makeCobro('500.00', EstadoCobro.PENDIENTE), id: BigInt(1) },
      { ...makeCobro('1500.00', EstadoCobro.PENDIENTE), id: BigInt(2) },
      { ...makeCobro('300.00', EstadoCobro.PROCESADO), id: BigInt(3) },
    ]
    mockPrisma.cobro.findMany.mockResolvedValue(cobros)
    mockTx.cobro.update.mockResolvedValue({})

    const resultado = await service.procesarLote([1, 2, 3])

    expect(resultado.total).toBe(3)
    expect(resultado.procesados).toBe(1) // monto 500 → PROCESADO
    expect(resultado.fallidos).toBe(1) // monto 1500 → FALLIDO
    expect(resultado.omitidos).toBe(1) // ya estaba PROCESADO
  })

  it('reporta como omitido un ID que no existe en BD', async () => {
    mockPrisma.cobro.findMany.mockResolvedValue([])

    const resultado = await service.procesarLote([999])

    expect(resultado.total).toBe(1)
    expect(resultado.omitidos).toBe(1)
    expect(resultado.detalle[0]).toMatchObject({
      id: 999,
      estado: 'NO_ENCONTRADO',
      accion: 'OMITIDO',
    })
  })

  it('no duplica entradas de auditoría para cobros ya procesados', async () => {
    const { AuditoriaService } = jest.requireMock(
      '../../src/modules/auditoria/auditoria.service',
    ) as { AuditoriaService: { registrar: jest.Mock } }
    AuditoriaService.registrar.mockClear()

    const cobros = [{ ...makeCobro('500.00', EstadoCobro.PROCESADO), id: BigInt(1) }]
    mockPrisma.cobro.findMany.mockResolvedValue(cobros)

    await service.procesarLote([1])

    expect(AuditoriaService.registrar).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Tests: Validación de schema createCobroSchema — monto > 0
// ---------------------------------------------------------------------------

describe('Validación de schema createCobroSchema', () => {
  const { createCobroSchema } = jest.requireActual(
    '../../src/modules/cobros/cobros.validators',
  ) as typeof import('../../src/modules/cobros/cobros.validators')

  it('rechaza monto igual a 0', () => {
    const result = createCobroSchema.safeParse({ clienteId: 1, monto: 0, moneda: 'GTQ' })
    expect(result.success).toBe(false)
  })

  it('rechaza monto negativo', () => {
    const result = createCobroSchema.safeParse({ clienteId: 1, monto: -100, moneda: 'GTQ' })
    expect(result.success).toBe(false)
  })

  it('acepta monto positivo', () => {
    const result = createCobroSchema.safeParse({ clienteId: 1, monto: 500, moneda: 'GTQ' })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests: Validación DPI único — ClientesService
// ---------------------------------------------------------------------------

describe('ClientesService.crear — DPI único', () => {
  it('lanza 409 cuando el DPI ya existe', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({ id: BigInt(1), dpi: '1234567890101' })

    const { ClientesService } = await import('../../src/modules/clientes/clientes.service')
    const svc = new ClientesService()

    await expect(svc.crear({ nombre: 'Test', dpi: '1234567890101' })).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('crea el cliente cuando el DPI no existe', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    mockPrisma.cliente.create.mockResolvedValue({
      id: BigInt(1),
      nombre: 'Test',
      dpi: '9999999999999',
      email: null,
      telefono: null,
      createdAt: new Date(),
    })

    const { ClientesService } = await import('../../src/modules/clientes/clientes.service')
    const svc = new ClientesService()
    const result = await svc.crear({ nombre: 'Test', dpi: '9999999999999' })

    expect(result.dpi).toBe('9999999999999')
    expect(mockPrisma.cliente.create).toHaveBeenCalled()
  })
})
