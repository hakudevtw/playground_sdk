# My SDK Practice Journey

## Phase 1: Foundation & Infrastructure

### 📦 Part A: Bundling & Monorepo Strategy

To ensure the SDK runs seamlessly across various customer environments (React, Next.js, legacy HTML), we use a **Bun Workspace** and `tsup` to generate three distinct formats:

| Format  | Extension    | Target                             | Key Features                                                                                              |
| :------ | :----------- | :--------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **ESM** | `.mjs`       | Vite, Webpack 5, Modern React Apps | Supports **Tree-shaking**. Bundles only the code actually used by the consumer to optimize size.          |
| **CJS** | `.js`        | Node.js, Older Tools, SSR          | Ensures the SDK doesn't crash in Server-Side Rendering environments (e.g., Next.js Server Components).    |
| **UMD** | `.global.js` | Direct `<script>` Injection        | Automatically attaches to the `window` global object. Required for legacy support and 3rd-party snippets. |

- **Zero Dependency Policy**: A core SDK rule. Every byte added to the SDK is a byte added to the customer's **LCP (Largest Contentful Paint)**.
- **Protocol**: Using the `workspace:*` protocol allows `@repo/react` to consume `@repo/core` changes instantly without re-publishing.

### 🥷 Part B: Hijacking & Command Queue Logic

We solve the race condition where a user calls the SDK before the script finishes downloading using a **Function-to-Function Hijacking** pattern.

- **The Stub (Snippet)**: A tiny inline function in the HTML `<head>` that acts as a proxy, capturing all function calls into a `q` (queue) array.
- **Overcoming UMD Collisions**: Bundlers often overwrite `window.MySDK`. We manually "rescue" the pre-existing instance inside `init()` before replacing the namespace with our live `Runner`.
- **Atomic Replay**: We process backlogged events in a First-In-First-Out (FIFO) order and immediately clear the queue to prevent "Double Replay" bugs.

### 🏷️ Part C: Type-Safe Lifecycle Management

Using TypeScript **Discriminated Unions** ensures internal stability and prevents "Double Initialization" bugs.

- **Union States**:
  1. **Pre-init**: Function state with a `q: Command[]` property.
  2. **Post-init**: Function state with an `_initialized: true` flag.
- **Idempotency**: The `init` function exits early if `_initialized` is true, ensuring the SDK remains a single-instance "Good Citizen" on the page.

---

### 💡 Key Discussion Points (Knowledge Base)

- **Why UMD in 2026?**: Enterprise customers and Tag Managers (GTM) still expect a global variable. UMD is our "compatibility floor."
- **Comparison to `dataLayer` (GA)**: While `dataLayer` is a passive array, our SDK uses a **Live Proxy**. The user calls `MySDK(...)` the same way regardless of whether the SDK is loaded or not (Superior DX).
- **Namespace Citizenship**: By using an IIFE and manual hijacking, we avoid leaking internal build variables (like `MySDK_Internal`) into the customer's global scope.

### 🔗 Reference Links & Resources

- [tsup Documentation](https://tsup.egoist.dev/)
- [Zenn: tsup UMD Build Tips](https://zenn.dev/monakamon/articles/tsup-umd-build-tips)
- [esbuild-plugin-umd-wrapper](https://github.com/inqnuam/esbuild-plugin-umd-wrapper)

## Phase 2: Memory Management & DOM Tracking

In this phase, we move from the "How to load" to the "How to watch." Specifically, we are going to build a tracker that observes elements on a page without causing the browser to lag or leak memory.

### Phase 2.1: Memory-Safe DOM Tracking (WeakMap)

#### 🧠 The Memory Leak Problem in SDKs

In massive ecosystems like Rakuten, users navigate through complex Single Page Applications (SPAs). DOM nodes are created and destroyed constantly. If an SDK stores metadata for these nodes in a standard Map or Object, the nodes will remain in memory even after being removed from the DOM, causing a Memory Leak. For a high-traffic site, this can eventually crash the user's browser tab.

#### 🛠 The WeakMap Solution

We implement the ElementTracker using a WeakMap<HTMLElement, TrackingMetadata>.

Weak References: The WeakMap does not prevent the Garbage Collector (GC) from reclaiming an element. If the element is deleted from the DOM and no other code references it, the entry in the WeakMap is automatically removed.

Lazy Initialization: By using a private ensureMetadata helper, we ensure the SDK handles "unseen" elements gracefully without redundant null-checks or pre-allocation.

#### 💡 Discussion: Mutation by Reference

Since WeakMap stores object references, we can retrieve the metadata object once and mutate its properties (e.g., metadata.clickCount++) directly. This is highly performant as it avoids repeated .set() calls and minimizes object allocation overhead—crucial for maintaining a 60fps user experience.

---

#### 💡 Key Discussion Points (Rakuten Interview Focus)

Standard Map vs. WeakMap: A standard Map holds "Strong" references. A WeakMap holds "Weak" references to its keys. In the context of DOM tracking, WeakMap is the industry standard for preventing memory leaks in 3rd-party scripts.

Garbage Collection (GC): While we cannot manually trigger GC, we write "GC-friendly" code. In a large-scale SDK, "cleaning up after yourself" should be automatic, not manual.

## Questions to Confirm Later

1. Why I see many sdks instead of simple stub function, it also appends the script tag? instead of needing user to manually append the script tag? Maybe to control when to load?
