module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/performance.test.ts'],
  transform: {
    '^.+\.ts$': ['ts-jest', {
      isolatedModules: true,
      tsconfig: {
        noUnusedLocals: false,
        noUnusedParameters: false
      }
    }]
  },
  testTimeout: 60000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: 1
};