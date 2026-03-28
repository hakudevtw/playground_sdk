# My SDK Practice Journey

## ## Phase 1: Foundation & Infrastructure

### ### 📦 Part A: Bundling & Monorepo Strategy

To ensure the SDK runs seamlessly across various customer environments (React, Next.js, legacy HTML), we use a **Bun Workspace** and `tsup` to generate three distinct formats:

| Format  | Extension    | Target                             | Key Features                                                                                              |
| :------ | :----------- | :--------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **ESM** | `.mjs`       | Vite, Webpack 5, Modern React Apps | Supports **Tree-shaking**. Bundles only the code actually used by the consumer to optimize size.          |
| **CJS** | `.js`        | Node.js, Older Tools, SSR          | Ensures the SDK doesn't crash in Server-Side Rendering environments (e.g., Next.js Server Components).    |
| **UMD** | `.global.js` | Direct `<script>` Injection        | Automatically attaches to the `window` global object. Required for legacy support and 3rd-party snippets. |

- **Zero Dependency Policy**: A core SDK rule. Every byte added to the SDK is a byte added to the customer's **LCP (Largest Contentful Paint)**.
- **Protocol**: Using the `workspace:*` protocol allows `@repo/react` to consume `@repo/core` changes instantly without re-publishing.

### ### 🥷 Part B: Hijacking & Command Queue Logic

We solve the race condition where a user calls the SDK before the script finishes downloading using a **Function-to-Function Hijacking** pattern.

- **The Stub (Snippet)**: A tiny inline function in the HTML `<head>` that acts as a proxy, capturing all function calls into a `q` (queue) array.
- **Overcoming UMD Collisions**: Bundlers often overwrite `window.MySDK`. We manually "rescue" the pre-existing instance inside `init()` before replacing the namespace with our live `Runner`.
- **Atomic Replay**: We process backlogged events in a First-In-First-Out (FIFO) order and immediately clear the queue to prevent "Double Replay" bugs.

### ### 🏷️ Part C: Type-Safe Lifecycle Management

Using TypeScript **Discriminated Unions** ensures internal stability and prevents "Double Initialization" bugs.

- **Union States**:
  1. **Pre-init**: Function state with a `q: Command[]` property.
  2. **Post-init**: Function state with an `_initialized: true` flag.
- **Idempotency**: The `init` function exits early if `_initialized` is true, ensuring the SDK remains a single-instance "Good Citizen" on the page.

---

### ### 💡 Key Discussion Points (Knowledge Base)

- **Why UMD in 2026?**: Enterprise customers and Tag Managers (GTM) still expect a global variable. UMD is our "compatibility floor."
- **Comparison to `dataLayer` (GA)**: While `dataLayer` is a passive array, our SDK uses a **Live Proxy**. The user calls `MySDK(...)` the same way regardless of whether the SDK is loaded or not (Superior DX).
- **Namespace Citizenship**: By using an IIFE and manual hijacking, we avoid leaking internal build variables (like `MySDK_Internal`) into the customer's global scope.

### ### 🔗 Reference Links & Resources

- [tsup Documentation](https://tsup.egoist.dev/)
- [Zenn: tsup UMD Build Tips](https://zenn.dev/monakamon/articles/tsup-umd-build-tips)
- [esbuild-plugin-umd-wrapper](https://github.com/inqnuam/esbuild-plugin-umd-wrapper)
