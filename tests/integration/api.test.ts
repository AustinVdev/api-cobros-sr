import { Prisma, EstadoCobro } from '../../src/generated/prisma/client'

// ---------------------------------------------------------------------------
// Mocks deben declararse ANTES de importar app (jest.mock es hoisted)
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

import request from 'supertest'
import app from '../../src/app'

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

const VALID_TOKEN = 'test-token-123'
const AUTH_HEADER = `Bearer ${VALID_TOKEN}`

beforeEach(() => {
  mockPrisma.$transaction.mockImplementation(
    (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  )
})

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

describe('Auth middleware', () => {
  it('401 sin header Authorization', async () => {
    const res = await request(app).post('/clientes').send({})
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('401 con token incorrecto', async () => {
    const res = await request(app)
      .post('/clientes')
      .set('Authorization', 'Bearer token-incorrecto')
      .send({})
    expect(res.status).toBe(401)
  })

  it('no aplica auth a /health', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

// ---------------------------------------------------------------------------
// POST /clientes
// ---------------------------------------------------------------------------

describe('POST /clientes', () => {
  it('201 al crear cliente válido', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    mockPrisma.cliente.create.mockResolvedValue({
      id: BigInt(1),
      nombre: 'Ana Pérez',
      dpi: '1234567890101',
      email: 'ana@example.com',
      telefono: null,
      createdAt: new Date(),
    })

    const res = await request(app)
      .post('/clientes')
      .set('Authorization', AUTH_HEADER)
      .send({ nombre: 'Ana Pérez', dpi: '1234567890101', email: 'ana@example.com' })

    expect(res.status).toBe(201)
    expect(res.body.data.dpi).toBe('1234567890101')
  })

  it('409 cuando el DPI ya existe', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({ id: BigInt(1), dpi: '1234567890101' })

    const res = await request(app)
      .post('/clientes')
      .set('Authorization', AUTH_HEADER)
      .send({ nombre: 'Otro', dpi: '1234567890101' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
  })

  it('422 con DPI que contiene letras', async () => {
    const res = await request(app)
      .post('/clientes')
      .set('Authorization', AUTH_HEADER)
      .send({ nombre: 'Test', dpi: 'ABC123' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY')
  })

  it('422 sin nombre', async () => {
    const res = await request(app)
      .post('/clientes')
      .set('Authorization', AUTH_HEADER)
      .send({ dpi: '1234567890101' })

    expect(res.status).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// POST /cobros
// ---------------------------------------------------------------------------

describe('POST /cobros', () => {
  it('201 al crear cobro válido', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({ id: BigInt(1) })
    mockPrisma.cobro.create.mockResolvedValue({
      id: BigInt(1),
      clienteId: BigInt(1),
      monto: new Prisma.Decimal('500.00'),
      moneda: 'GTQ',
      estado: EstadoCobro.PENDIENTE,
      fechaCreacion: new Date(),
      fechaProceso: null,
      referenciaExterna: 'REF-001',
    })

    const res = await request(app)
      .post('/cobros')
      .set('Authorization', AUTH_HEADER)
      .send({ clienteId: 1, monto: 500, moneda: 'GTQ', referenciaExterna: 'REF-001' })

    expect(res.status).toBe(201)
    expect(res.body.data.estado).toBe('PENDIENTE')
  })

  it('404 cuando el cliente no existe', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/cobros')
      .set('Authorization', AUTH_HEADER)
      .send({ clienteId: 999, monto: 500 })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('422 con monto <= 0', async () => {
    const res = await request(app)
      .post('/cobros')
      .set('Authorization', AUTH_HEADER)
      .send({ clienteId: 1, monto: -10 })

    expect(res.status).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// POST /cobros/:id/procesar
// ---------------------------------------------------------------------------

describe('POST /cobros/:id/procesar', () => {
  it('200 procesa cobro PENDIENTE con monto <= 1000 → PROCESADO', async () => {
    const cobro = {
      id: BigInt(1),
      clienteId: BigInt(1),
      monto: new Prisma.Decimal('500.00'),
      moneda: 'GTQ',
      estado: EstadoCobro.PENDIENTE,
      fechaCreacion: new Date(),
      fechaProceso: null,
      referenciaExterna: null,
    }
    mockPrisma.cobro.findUnique.mockResolvedValue(cobro)
    mockTx.cobro.update.mockResolvedValue({ ...cobro, estado: EstadoCobro.PROCESADO })

    const res = await request(app)
      .post('/cobros/1/procesar')
      .set('Authorization', AUTH_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.data.estado).toBe('PROCESADO')
  })

  it('409 al intentar reprocesar un cobro ya PROCESADO', async () => {
    mockPrisma.cobro.findUnique.mockResolvedValue({
      id: BigInt(1),
      estado: EstadoCobro.PROCESADO,
      monto: new Prisma.Decimal('500.00'),
    })

    const res = await request(app)
      .post('/cobros/1/procesar')
      .set('Authorization', AUTH_HEADER)

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
  })
})

// ---------------------------------------------------------------------------
// POST /cobros/lotes/procesar
// ---------------------------------------------------------------------------

describe('POST /cobros/lotes/procesar', () => {
  it('200 procesa lote y devuelve resumen', async () => {
    const cobros = [
      {
        id: BigInt(1),
        monto: new Prisma.Decimal('500.00'),
        moneda: 'GTQ',
        estado: EstadoCobro.PENDIENTE,
      },
      {
        id: BigInt(2),
        monto: new Prisma.Decimal('1500.00'),
        moneda: 'GTQ',
        estado: EstadoCobro.PENDIENTE,
      },
    ]
    mockPrisma.cobro.findMany.mockResolvedValue(cobros)
    mockTx.cobro.update.mockResolvedValue({})

    const res = await request(app)
      .post('/cobros/lotes/procesar')
      .set('Authorization', AUTH_HEADER)
      .send({ ids: [1, 2] })

    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(2)
    expect(res.body.data.procesados).toBe(1)
    expect(res.body.data.fallidos).toBe(1)
    expect(res.body.data.omitidos).toBe(0)
  })

  it('es idempotente: omite cobros ya procesados sin duplicar auditoría', async () => {
    const { AuditoriaService } = jest.requireMock(
      '../../src/modules/auditoria/auditoria.service',
    ) as { AuditoriaService: { registrar: jest.Mock } }
    AuditoriaService.registrar.mockClear()

    mockPrisma.cobro.findMany.mockResolvedValue([
      {
        id: BigInt(1),
        monto: new Prisma.Decimal('500.00'),
        moneda: 'GTQ',
        estado: EstadoCobro.PROCESADO,
      },
    ])

    const res = await request(app)
      .post('/cobros/lotes/procesar')
      .set('Authorization', AUTH_HEADER)
      .send({ ids: [1] })

    expect(res.status).toBe(200)
    expect(res.body.data.omitidos).toBe(1)
    expect(AuditoriaService.registrar).not.toHaveBeenCalled()
  })

  it('422 con ids vacío', async () => {
    const res = await request(app)
      .post('/cobros/lotes/procesar')
      .set('Authorization', AUTH_HEADER)
      .send({ ids: [] })

    expect(res.status).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// GET /clientes/:id/cobros
// ---------------------------------------------------------------------------

describe('GET /clientes/:id/cobros', () => {
  it('200 lista cobros del cliente', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({ id: BigInt(1) })
    mockPrisma.cobro.findMany.mockResolvedValue([
      {
        id: BigInt(1),
        clienteId: BigInt(1),
        monto: new Prisma.Decimal('500.00'),
        moneda: 'GTQ',
        estado: EstadoCobro.PROCESADO,
        fechaCreacion: new Date(),
        fechaProceso: new Date(),
        referenciaExterna: 'REF-001',
      },
    ])

    const res = await request(app)
      .get('/clientes/1/cobros')
      .set('Authorization', AUTH_HEADER)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data).toHaveLength(1)
  })

  it('404 si el cliente no existe', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .get('/clientes/999/cobros')
      .set('Authorization', AUTH_HEADER)

    expect(res.status).toBe(404)
  })

  it('422 con fecha "desde" en formato inválido', async () => {
    const res = await request(app)
      .get('/clientes/1/cobros?desde=no-es-fecha')
      .set('Authorization', AUTH_HEADER)

    expect(res.status).toBe(422)
  })
})
