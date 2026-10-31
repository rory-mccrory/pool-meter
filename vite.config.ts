/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Strict Content-Security-Policy for the production build. Only applied at build
 * time because the dev server injects inline styles for hot reload. frame-ancestors
 * is ignored in <meta>, so hosts also send it as a header (see vercel.json).
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'none'",
  "manifest-src 'self'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'pool-meter-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), cspPlugin()],
  base: process.env.BASE_PATH ?? '/',
  build: {
    // Keep everything inline-free and same-origin so the strict CSP holds.
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
