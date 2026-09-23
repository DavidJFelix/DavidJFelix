// Ambient declarations for the bundler-only specifiers the runtime modules
// import: wasm binaries as compiled modules (the Cloudflare Vite plugin's
// CompiledWasm rule, unwasm's ?module) and font files as a base64 data URL
// (Vite's ?inline) or as bytes (Nitro's raw:). The runtime modules reference
// this file with a triple-slash directive so an app compiling this package's
// source sees the declarations too.

declare module 'satori/yoga.wasm' {
  const module: WebAssembly.Module
  export default module
}

declare module 'satori/yoga.wasm?module' {
  const module: WebAssembly.Module
  export default module
}

declare module '@resvg/resvg-wasm/index_bg.wasm' {
  const module: WebAssembly.Module
  export default module
}

declare module '@resvg/resvg-wasm/index_bg.wasm?module' {
  const module: WebAssembly.Module
  export default module
}

declare module '@fontsource/inter/files/*.woff?inline' {
  const dataUrl: string
  export default dataUrl
}

declare module 'raw:@fontsource/inter/files/*.woff' {
  const bytes: Uint8Array
  export default bytes
}
