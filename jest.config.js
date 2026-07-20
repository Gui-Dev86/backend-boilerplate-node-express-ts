module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setupEnv.ts"],
  testMatch: ["**/tests/**/*.test.ts"],
  clearMocks: true,
  testTimeout: 15000,
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.jest.json",
    },
  },
};
