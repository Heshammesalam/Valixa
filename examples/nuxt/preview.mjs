process.env.NODE_ENV = 'production';
process.env.NITRO_HOST = '127.0.0.1';
process.env.NITRO_PORT = '4176';
console.log('Nuxt fixture Node:', process.version);
await import('./.output/server/index.mjs');
