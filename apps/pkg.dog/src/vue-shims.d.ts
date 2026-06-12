// tsgo cannot type-check .vue SFCs; this shim types their default export so
// importing .ts files still check. Revisit when vue-tsc supports TS 7.
declare module '*.vue' {
  import type {DefineComponent} from 'vue'

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
