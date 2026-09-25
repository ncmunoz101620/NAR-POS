import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({plugins:[laravel({input:['src/main.jsx'],refresh:true}),react()],resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}}});
