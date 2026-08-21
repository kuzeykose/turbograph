# @workspace/graph-wasm

Rust core for the dependency/import graph renderer: layered layout, hit-testing,
viewport culling, and WebGL vertex-buffer generation.

The module owns the graph in linear memory and hands JavaScript typed-array
views over it, so a rendered frame costs no allocation and no marshalling beyond
a few scalars. Node identity is an index; strings stay on the JS side.

Built without `wasm-bindgen` — every export is plain `extern "C"` over numbers
and pointers. That keeps the artifact ~37KB and removes per-call glue from the
drag path.

## Building

```sh
rustup target add wasm32-unknown-unknown   # once
pnpm --filter @workspace/graph-wasm build
```

`build` compiles and copies the result to `apps/dashboard/public/graph.wasm`,
which is **committed**. The dashboard loads it with `fetch("/graph.wasm")` rather
than through the bundler, because Turbopack does not compile wasm/worker entry
points reliably, and a committed artifact means Vercel needs no Rust toolchain.

Rebuild and commit `apps/dashboard/public/graph.wasm` whenever `src/` changes.

## Layout parity

`src/layout.rs` is a port of `packages/graph/src/layout.ts` and must stay
positionally identical to it — `apps/dashboard/test/lib/graph-wasm.test.ts`
asserts that on several fixtures, including a cyclic graph.
