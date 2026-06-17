import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/adonis_lab_sales_dashboard/",
  plugins: [
    tsconfigPaths(),
    TanStackRouterVite(),
    react(),
    tailwindcss(),
  ],
});
