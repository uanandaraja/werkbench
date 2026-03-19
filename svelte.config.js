import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      "@/*": "./src/lib/*",
    },
    experimental: {
      remoteFunctions: true,
    },
  },
  vitePlugin: {
    dynamicCompileOptions: ({ filename }) =>
      filename.includes('node_modules') ? undefined : { runes: true },
  },
};

export default config;
