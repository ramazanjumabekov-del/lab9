import { defineConfig } from 'vite';

// Для GitHub Pages workflow задаёт BASE_PATH=/<имя-репозитория>/
export default defineConfig({ base: process.env.BASE_PATH ?? '/' });
