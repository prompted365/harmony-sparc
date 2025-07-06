module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/api', '<rootDir>/core', '<rootDir>/adapters'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/tests/**',
    '!**/coverage/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@agentflow/(.*)$': '<rootDir>/$1',
    '^@api/(.*)$': '<rootDir>/api/$1',
    '^@core/(.*)$': '<rootDir>/core/$1',
    '^@adapters/(.*)$': '<rootDir>/adapters/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};