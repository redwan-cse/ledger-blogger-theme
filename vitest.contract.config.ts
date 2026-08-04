import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/contract/**/*.test.ts'],
    setupFiles: ['tests/contract/no-network.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true
  }
});
