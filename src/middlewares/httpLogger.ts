import pinoHttp from 'pino-http'
import { randomUUID } from 'node:crypto'
import { logger } from '../config/logger'

export const httpLogger = pinoHttp({
  logger,
  genReqId: () => randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
      }
    },
    res(res) {
      return { statusCode: res.statusCode }
    },
  },
})
