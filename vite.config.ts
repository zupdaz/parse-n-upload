
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Base path for assets, can be set via environment variable for different deployments
  // For IIS in a subdirectory, you would set this to '/your-subdirectory/'
  base: process.env.BASE_PATH || '/',
  
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Generate sourcemaps for easier debugging in production
    sourcemap: true,
    // Ensure that Vite correctly handles file paths
    assetsDir: 'assets',
    // Adjust output directory if needed
    outDir: 'dist',
  }
}));
