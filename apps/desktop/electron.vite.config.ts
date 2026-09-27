import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

const internalPackages = [
  "@welz/shared",
  "@welz/database",
  "@welz/platform-core",
  "@welz/automation",
  "@welz/scheduler",
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: internalPackages })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: internalPackages })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: "renderer",
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "renderer/index.html"),
        },
      },
    },
    plugins: [react()],
  },
});
