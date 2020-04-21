module.exports = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.spec.ts'],
  coverageReporters: ['lcov'],
  // coverageThreshold: {
  //   global: {
  //     branches: 100,
  //     functions: 100,
  //     lines: 100,
  //     statements: 100,
  //   },
  // },
}
