/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Your Supabase project URL, e.g. https://abcdefgh.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Your Supabase project's public "anon" key (Project Settings > API). */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
