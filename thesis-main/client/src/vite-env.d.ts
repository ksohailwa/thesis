/// <reference types="vite/client" />

// Optional: declare known VITE_ env keys for better intellisense
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_I18N_DEFAULT_LANG?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

