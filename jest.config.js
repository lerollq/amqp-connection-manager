module.exports = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.spec.ts'],
  coverageReporters: ['lcov'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 70,
      lines: 95,
      statements: 90,
    },
  },
}
