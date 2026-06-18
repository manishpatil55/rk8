// In Next, `import "server-only"` throws outside a Server Component. Under
// vitest there's no bundler to enforce that, and the package's default export
// throws — so we alias `server-only` to this no-op for tests (see vitest.config).
export {};
