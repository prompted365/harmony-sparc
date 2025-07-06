// Test environment setup

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3001'; // Use test port
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Extend timeout for integration tests
jest.setTimeout(30000);

// Mock external dependencies if needed
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    splat: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));