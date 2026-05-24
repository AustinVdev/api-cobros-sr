-- =====================================================================
-- Script de inicialización de la base de datos: cobros_db
-- Motor: MySQL 8.4
-- Prueba Técnica - API de Cobros Automáticos Simulados
-- =====================================================================
-- Este script se ejecuta automáticamente al levantar el contenedor
-- (ver docker-compose.yml -> volumen /docker-entrypoint-initdb.d).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS cobros_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cobros_db;

-- ---------------------------------------------------------------------
-- Tabla: clientes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(255)    NOT NULL,
  dpi         VARCHAR(20)     NOT NULL,
  email       VARCHAR(255)    NULL,
  telefono    VARCHAR(20)     NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_clientes_dpi (dpi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tabla: cobros
-- estado: PENDIENTE | PROCESADO | FALLIDO  (default PENDIENTE)
-- monto:  DECIMAL para evitar errores de punto flotante en dinero
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cobros (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id          BIGINT UNSIGNED NOT NULL,
  monto               DECIMAL(14,2)   NOT NULL,
  moneda              VARCHAR(3)      NOT NULL DEFAULT 'GTQ',
  estado              ENUM('PENDIENTE','PROCESADO','FALLIDO')
                        NOT NULL DEFAULT 'PENDIENTE',
  fecha_creacion      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_proceso       DATETIME(3)     NULL,
  referencia_externa  VARCHAR(100)    NULL,
  PRIMARY KEY (id),
  KEY idx_cobros_cliente_id (cliente_id),
  KEY idx_cobros_estado (estado),
  KEY idx_cobros_fecha_creacion (fecha_creacion),
  KEY idx_cobros_cliente_estado_fecha (cliente_id, estado, fecha_creacion),
  CONSTRAINT fk_cobros_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT chk_cobros_monto_positivo CHECK (monto > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tabla: auditoria
-- Trazabilidad de eventos del sistema (procesamiento de cobros, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  evento           VARCHAR(100)    NOT NULL,
  resumen_payload  JSON            NULL,
  fecha            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  usuario_sistema  VARCHAR(100)    NOT NULL DEFAULT 'sistema',
  PRIMARY KEY (id),
  KEY idx_auditoria_evento (evento),
  KEY idx_auditoria_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Datos de ejemplo (seed mínimo, opcional)
-- ---------------------------------------------------------------------
INSERT INTO clientes (nombre, dpi, email, telefono) VALUES
  ('Ana Pérez',     '1234567890101', 'ana.perez@example.com',  '50212345678'),
  ('Carlos López',  '2345678910102', 'carlos.lopez@example.com', NULL),
  ('María García',  '3456789120103', NULL,                       '50298765432');

INSERT INTO cobros (cliente_id, monto, moneda, estado, referencia_externa) VALUES
  (1,  500.00, 'GTQ', 'PENDIENTE', 'REF-001'),
  (1, 1500.00, 'GTQ', 'PENDIENTE', 'REF-002'),
  (2,  750.50, 'GTQ', 'PENDIENTE', 'REF-003'),
  (3, 2000.00, 'GTQ', 'PENDIENTE', 'REF-004');
