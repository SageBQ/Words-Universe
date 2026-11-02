import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root:'backup',
  publicDir:'../public',
  plugins:[react()],
  build:{outDir:'../backup-dist',emptyOutDir:true},
});
