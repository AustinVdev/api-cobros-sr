// Set required environment variables before any module is loaded
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test_db'
process.env.API_TOKEN = 'test-token-123'
process.env.PORT = '3000'
process.env.LOG_LEVEL = 'error'
process.env.NODE_ENV = 'test'
