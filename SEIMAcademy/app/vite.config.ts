import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// `base: './'` keeps the built bundle path-relative, so it works from a project page
// (github.io/<repo>/) as well as a domain root. Decision 1 defers the hosting target;
// this costs nothing and keeps both options open.
export default defineConfig({
  plugins: [preact()],
  base: './',
  build: { outDir: 'dist', sourcemap: true },
});
