export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.test.mjs'],
  collectCoverageFrom: ['server/**/*.js'],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
};
