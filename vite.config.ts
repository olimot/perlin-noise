import { defineConfig } from "vite";

export default defineConfig({
  base: "/perlin-noise/",
  root: "src",
  build: {
    target: 'esnext',
    outDir: "../dist",
    emptyOutDir: true,
  },
});
