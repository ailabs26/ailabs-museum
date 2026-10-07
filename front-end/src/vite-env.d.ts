/// <reference types="vite/client" />
/// <reference types="@types/webxr" />

interface ImportMetaEnv { readonly VITE_API_BASE_URL: string }
interface ImportMeta { readonly env: ImportMetaEnv }
