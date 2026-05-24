import express from 'express'
import { httpLogger } from './middlewares/httpLogger'
import { authMiddleware } from './middlewares/auth'
import { errorHandler } from './middlewares/errorHandler'
import { clientesRouter } from './modules/clientes/clientes.routes'
import { cobrosRouter } from './modules/cobros/cobros.routes'

const app = express()

// BigInt serialization: convert to number for JSON responses
// (IDs in this domain are safely representable as Number)
app.set('json replacer', (_key: string, value: unknown) => {
  if (typeof value === 'bigint') return Number(value)
  return value
})

app.use(express.json())
app.use(httpLogger)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/clientes', authMiddleware, clientesRouter)
app.use('/cobros', authMiddleware, cobrosRouter)

app.use(errorHandler)

export default app
