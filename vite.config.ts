import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Inline the font too, so the build can be packed into one self-contained page.
  build: { assetsInlineLimit: 200 * 1024 },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
