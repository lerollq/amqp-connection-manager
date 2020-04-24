module.exports = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts', '!src/helpers.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.spec.ts'],
  coverageReporters: ['lcov'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 70,
      lines: 98,
      statements: 98,
    },
  },
}
