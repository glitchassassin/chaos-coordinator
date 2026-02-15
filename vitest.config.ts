import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/main/**/__tests__/**/*.test.ts'],
          globals: true
        }
      },
      {
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/__tests__/**/*.test.{ts,tsx}'],
          setupFiles: ['src/renderer/src/__tests__/setup.ts'],
          globals: true
        }
      }
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.d.ts',
        'src/renderer/src/env.d.ts',
        'src/renderer/src/main.tsx',
        // Type-only files
        'src/shared/types/**',
        'src/shared/config/types.ts',
        // Entry points (tested via E2E)
        'src/main/index.ts',
        'src/preload/index.ts',
        // Simple re-export index files
        'src/**/index.ts'
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80
      }
    }
  }
})
