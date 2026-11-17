import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// O frontend corre na 5173 e o backend na 3000.
// Sem este proxy, os pedidos a /api batem no servidor do Vite (404, body vazio)
// e o frontend rebenta com "Unexpected end of JSON input".
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
