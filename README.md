# API de Cobros Automáticos Simulados

API REST para gestión de cobros automáticos simulados con procesamiento individual y por lotes, trazabilidad de eventos y autenticación por token.

---

## Requisitos previos

- **Node.js** 24 LTS
- **Docker** y **Docker Compose** (para MySQL)
- **npm** 10+

---

## Levantar MySQL con Docker Compose

```bash
docker-compose up -d
```

El contenedor ejecuta `init.sql` automáticamente la primera vez que se crea el volumen, creando las tablas `clientes`, `cobros` y `auditoria` e insertando datos de ejemplo.

Para detenerlo:

```bash
docker-compose down          # conserva el volumen (datos)
docker-compose down -v       # elimina el volumen (datos perdidos)
```

---

## Instalación de dependencias

```bash
npm install
```

---

## Configuración del entorno

```bash
cp .env.example .env
```

Edita `.env` y ajusta `API_TOKEN` (y opcionalmente `PORT`, `LOG_LEVEL`). El valor de `DATABASE_URL` ya coincide con el `docker-compose.yml`.

> **Nota sobre Prisma 7**: Prisma 7 no carga `.env` automáticamente en el CLI.  
> `prisma.config.ts` importa `dotenv/config` para que comandos como `prisma generate` y `prisma studio` puedan leer las variables. En la aplicación, `src/server.ts` hace `import 'dotenv/config'` como primera instrucción.

---

## Generar el cliente de Prisma

```bash
npm run prisma:generate
```

> El `schema.prisma` está alineado con las tablas creadas por `init.sql`. No se ejecutan migraciones destructivas; Prisma sólo genera el cliente TypeScript.

---

## Arrancar la API

### Modo desarrollo (con hot-reload)

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

La API queda disponible en `http://localhost:3000` (o el puerto configurado en `PORT`).

---

## Autenticación

Todos los endpoints (excepto `GET /health`) requieren el header:

```
Authorization: Bearer <API_TOKEN>
```

El token debe coincidir exactamente con la variable de entorno `API_TOKEN`. Si falta o es inválido se devuelve `401`.

---

## Endpoints

### `GET /health`

Comprueba que el servidor está activo. No requiere autenticación.

```bash
curl http://localhost:3000/health
```

---

### `POST /clientes`

Crea un nuevo cliente. Devuelve `409` si el DPI ya existe.

```bash
curl -X POST http://localhost:3000/clientes \
  -H "Authorization: Bearer mi-token" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Ana Pérez",
    "dpi": "1234567890101",
    "email": "ana@example.com",
    "telefono": "50212345678"
  }'
```

**Respuesta 201:**

```json
{
  "data": {
    "id": 1,
    "nombre": "Ana Pérez",
    "dpi": "1234567890101",
    "email": "ana@example.com",
    "telefono": "50212345678",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### `POST /cobros`

Registra un cobro en estado `PENDIENTE`. Devuelve `404` si el cliente no existe.

```bash
curl -X POST http://localhost:3000/cobros \
  -H "Authorization: Bearer mi-token" \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": 1,
    "monto": 750.50,
    "moneda": "GTQ",
    "referenciaExterna": "REF-XYZ"
  }'
```

**Respuesta 201:**

```json
{
  "data": {
    "id": 5,
    "clienteId": 1,
    "monto": "750.5",
    "moneda": "GTQ",
    "estado": "PENDIENTE",
    "fechaCreacion": "2024-01-15T10:05:00.000Z",
    "fechaProceso": null,
    "referenciaExterna": "REF-XYZ"
  }
}
```

---

### `POST /cobros/:id/procesar`

Procesa un cobro individual aplicando la regla de simulación:

- `monto <= 1000` → `PROCESADO`
- `monto > 1000` → `FALLIDO`

Si el cobro ya no está en `PENDIENTE`, devuelve `409` (no reprocesa).  
Registra el evento en la tabla `auditoria`.

```bash
curl -X POST http://localhost:3000/cobros/1/procesar \
  -H "Authorization: Bearer mi-token"
```

**Respuesta 200:**

```json
{
  "data": {
    "id": 1,
    "estado": "PROCESADO",
    "fechaProceso": "2024-01-15T10:10:00.000Z"
  }
}
```

---

### `POST /cobros/lotes/procesar`

Procesa un lote de cobros. Es **idempotente**: los cobros que ya tienen estado distinto de `PENDIENTE` se contabilizan como `omitidos` sin modificarlos ni duplicar registros de auditoría.

```bash
curl -X POST http://localhost:3000/cobros/lotes/procesar \
  -H "Authorization: Bearer mi-token" \
  -H "Content-Type: application/json" \
  -d '{ "ids": [1, 2, 3, 4] }'
```

**Respuesta 200:**

```json
{
  "data": {
    "total": 4,
    "procesados": 2,
    "fallidos": 1,
    "omitidos": 1,
    "detalle": [
      { "id": 1, "estado": "PROCESADO", "accion": "PROCESADO" },
      { "id": 2, "estado": "FALLIDO",   "accion": "PROCESADO" },
      { "id": 3, "estado": "PROCESADO", "accion": "OMITIDO", "motivo": "Ya tiene estado PROCESADO" },
      { "id": 4, "estado": "NO_ENCONTRADO", "accion": "OMITIDO", "motivo": "Cobro no encontrado" }
    ]
  }
}
```

---

### `GET /clientes/:id/cobros`

Lista los cobros de un cliente con filtros opcionales. Devuelve `404` si el cliente no existe.

**Query params opcionales:**

| Parámetro | Tipo   | Ejemplo                      |
|-----------|--------|------------------------------|
| `estado`  | enum   | `PENDIENTE`, `PROCESADO`, `FALLIDO` |
| `desde`   | ISO 8601 | `2024-01-01T00:00:00Z`     |
| `hasta`   | ISO 8601 | `2024-12-31T23:59:59Z`     |

```bash
curl "http://localhost:3000/clientes/1/cobros?estado=PENDIENTE&desde=2024-01-01T00:00:00Z" \
  -H "Authorization: Bearer mi-token"
```

**Respuesta 200:**

```json
{
  "data": [
    {
      "id": 1,
      "clienteId": 1,
      "monto": "500",
      "moneda": "GTQ",
      "estado": "PENDIENTE",
      "fechaCreacion": "2024-01-15T10:00:00.000Z",
      "fechaProceso": null,
      "referenciaExterna": "REF-001"
    }
  ]
}
```

---

## Formato de errores

Todos los errores siguen la estructura:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Cliente 99 no encontrado",
    "details": []
  }
}
```

| HTTP | `code`                 | Cuándo                                      |
|------|------------------------|---------------------------------------------|
| 400  | `VALIDATION_ERROR`     | Parámetros de ruta inválidos                |
| 401  | `UNAUTHORIZED`         | Token ausente o incorrecto                  |
| 404  | `NOT_FOUND`            | Recurso no encontrado                       |
| 409  | `CONFLICT`             | DPI duplicado / cobro ya procesado          |
| 422  | `UNPROCESSABLE_ENTITY` | Validación Zod fallida (detalle de campos)  |
| 500  | `INTERNAL_ERROR`       | Error inesperado                            |

---

## Correr los tests

```bash
npm test                 # ejecuta todos los tests
npm run test:coverage    # con reporte de cobertura
```

Los tests **no requieren** MySQL en ejecución: el cliente Prisma está mockeado.

---

## Seed opcional

Si quieres poblar la base usando Prisma (en lugar de `init.sql`):

```bash
npm run db:seed
```

El seed usa `upsert` para ser idempotente. Como `init.sql` ya inserta los mismos datos de ejemplo, ejecutar el seed sobre una base recién creada no producirá duplicados.

---

## Decisiones técnicas y trade-offs

### Por qué Prisma ORM

Prisma genera un cliente completamente tipado a partir del schema, lo que elimina errores de columnas/tipos en tiempo de desarrollo. La alternativa (Knex, Drizzle) ofrece mayor control de SQL pero requiere más boilerplate para mantener los tipos sincronizados con la base. Para una API CRUD de este tamaño, Prisma es el punto justo entre productividad y seguridad de tipos.

### Por qué arquitectura en capas (controller → service → Prisma)

Separa la responsabilidad de HTTP (parsing, serialización) de la lógica de negocio (reglas de cobro, idempotencia) y del acceso a datos. Esto permite testear el service de forma unitaria mockeando sólo Prisma, sin levantar un servidor HTTP. Los controllers son deliberadamente finos: validan con Zod, llaman al service y responden.

### Cómo se resolvió la idempotencia del lote

Cada cobro en el lote se verifica antes de procesarlo: si `estado !== PENDIENTE` se contabiliza como `omitido` y **no** se escribe nada en la base ni en auditoría. Esto garantiza que llamar al endpoint con los mismos IDs múltiples veces produce el mismo resultado sin efectos secundarios adicionales. La verificación ocurre dentro del loop (no en una transacción global) para que el fallo de un ítem no revierta los demás.

### Por qué no una sola transacción para todo el lote

Una transacción que englobe todos los ítems del lote es atómica pero amplía la ventana de bloqueo. Con una transacción por ítem (cobro + auditoría), el fallo de uno no afecta los demás y los bloqueos son mínimos. La idempotencia se logra por lógica de negocio, no por atomicidad de transacción.

### Qué quedaría fuera de scope

- **Paginación** en `GET /clientes/:id/cobros` (necesaria en producción con volúmenes grandes).
- **Rate limiting** y throttling por token.
- **Webhooks / notificaciones** al completar un cobro.
- **Reintentos automáticos** para cobros FALLIDOS.
- **Autenticación real** (JWT, OAuth2) en lugar del token estático.
- **Tests de contrato** para la API (Pact u OpenAPI validation).
- **Migrations de Prisma** gestionadas con CI/CD.
