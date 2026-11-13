// Ambient declarations for the bundler-only specifiers that the runtime modules
// import. The wasm binary arrives as a compiled module (the CompiledWasm rule of
// the Cloudflare Vite plugin, or unwasm's ?module). A font file arrives as a
// base64 data URL (Vite's ?inline) or as bytes (Nitro's raw:). Only this
// package's own tsc reads these; apps get ./vite.d.ts and ./nitro.d.ts.

// The package types this subpath as the exports of a wasm instance (the ESM
// integration form), which no bundler here gives. TypeScript reads an ambient
// declaration before the package's own types, so this one applies.
declare module '@takumi-rs/wasm/takumi_wasm_bg.wasm' {
  const module: WebAssembly.Module
  export default module
}

declare module '@takumi-rs/wasm/takumi_wasm_bg.wasm?module' {
  const module: WebAssembly.Module
  export default module
}

declare module '@fontsource/inter/files/*.woff2?inline' {
  const dataUrl: string
  export default dataUrl
}

declare module 'raw:@fontsource/inter/files/*.woff2' {
  const bytes: Uint8Array
  export default bytes
}
