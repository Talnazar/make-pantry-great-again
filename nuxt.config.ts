// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: true,

  features: {
    inlineStyles: false,
  },

  runtimeConfig: {
    public: {
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'Pantry',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://pantry-doodoo.web.app',
      siteEmail: process.env.NUXT_PUBLIC_SITE_EMAIL || 'notArnold@pantry.com',
      siteAndroidAppUrl:
        process.env.NUXT_PUBLIC_SITE_ANDROID_APP_URL ||
        'https://play.google.com/store/apps/details?id=com.pantry.twa',
      githubLink:
        process.env.NUXT_PUBLIC_GITHUB_LINK ||
        'https://github.com/Talnazar/make-pantry-great-again',
      commitHash: process.env.NUXT_PUBLIC_COMMIT_HASH || process.env.CF_PAGES_COMMIT_SHA || '',
    },
  },

  css: ['~/assets/styles/global.scss'],

  modules: [
    'vuetify-nuxt-module',
    '@pinia/nuxt',
    '@nuxtjs/seo',
    '@nuxtjs/i18n',
    '@vite-pwa/nuxt',
    '@nuxt/fonts',
    '@nuxt/eslint',
  ],

  eslint: {
    config: {
      typescript: true,
    },
  },

  fonts: {
    families: [
      {
        name: 'Inter',
        provider: 'google',
        weights: [300, 400, 500, 600, 700],
      },
    ],
  },

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
      titleTemplate: '%s - Pantry',
      link: [
        {
          rel: 'apple-touch-icon',
          sizes: '152x152',
          href: '/img/icons/apple-touch-icon-152x152.png',
        },
        { rel: 'mask-icon', href: '/img/icons/safari-pinned-tab.svg', color: '#C6FF00' },
      ],
      meta: [
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Pantry' },
        // Status/network bar color: black in dark mode, lime in light mode.
        { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#000000' },
        { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#C6FF00' },
      ],
    },
  },

  vuetify: {
    moduleOptions: {
      prefixComposables: true,
      ssrClientHints: {
        reloadOnFirstRequest: false,
        viewportSize: true,
      },
      styles: {
        configFile: 'assets/styles/vuetify-settings.scss',
      },
    },
    vuetifyOptions: {
      theme: {
        defaultTheme: 'dark',
        themes: {
          light: {
            colors: {
              primary: '#5F7800',
              secondary: '#C2185B',
              background: '#fafafa',
            },
          },
          dark: {
            colors: {
              primary: '#C6FF00',
              secondary: '#FF80AB',
            },
          },
        },
      },
      icons: {
        defaultSet: 'mdi-svg',
      },
      defaults: {
        global: {
          font: {
            family: 'Inter',
          },
        },
      },
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: [{ code: 'en', name: 'English', language: 'en-US', file: 'en.json' }],
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
    baseUrl: 'https://pantry-doodoo.web.app',
    compilation: {
      strictMessage: false,
    },
  },

  pwa: {
    registerType: 'prompt',
    manifest: {
      name: 'Pantry - Shopping List',
      short_name: 'Pantry',
      description:
        'Pantry is a simple, offline-first shopping list app that keeps your lists in sync across all your devices.',
      lang: 'en',
      theme_color: '#C6FF00',
      background_color: '#121212',
      id: 'com.pantry.twa',
      start_url: '/lists',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      categories: ['productivity', 'shopping', 'lifestyle'],
      icons: [
        {
          src: '/img/icons/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/img/icons/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/img/icons/android-chrome-maskable-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/img/icons/android-chrome-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
      navigateFallback: undefined,
      navigateFallbackDenylist: [/^\/api\//, /^\/\.well-known\//],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.destination === 'image',
          handler: 'CacheFirst',
          options: {
            cacheName: 'images',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ request }) =>
            request.destination === 'font' || request.destination === 'style',
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'assets',
            expiration: {
              maxEntries: 60,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
      ],
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 3600,
    },
    devOptions: {
      enabled: false,
      suppressWarnings: true,
      type: 'module',
    },
  },

  routeRules: {
    '/': { prerender: true },
    '/lists/**': { ssr: false },
    '/manage/**': { ssr: false },
    '/settings': { ssr: false },
  },

  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://pantry-doodoo.web.app',
    name: process.env.NUXT_PUBLIC_APP_NAME || 'Pantry',
    description:
      'Pantry is a simple, offline-first shopping list app that keeps your lists in sync across all your devices.',
  },

  sitemap: {
    exclude: ['/lists', '/lists/**', '/manage/**', '/settings'],
  },

  robots: {
    disallow: ['/lists', '/lists/**', '/manage/**', '/settings'],
  },

  ogImage: {
    enabled: false,
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'Pantry',
      url: 'https://pantry-doodoo.web.app',
      logo: 'https://pantry-doodoo.web.app/img/icons/android-chrome-512x512.png',
    },
  },

  vite: {
    optimizeDeps: {
      include: ['@mdi/js', '@unhead/schema-org/vue', 'firebase/app', 'firebase/firestore'],
    },
  },

  sourcemap: {
    client: 'hidden',
  },
})
