# My SDK Practice Journey

## Phase 1: Foundation & Infrastructure

### 📦 Part A: Bundling & Monorepo Strategy

To ensure the SDK runs seamlessly across various customer environments (React, Next.js, legacy HTML), we use **Bun Workspaces** and `tsup` to generate three distinct formats:

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
- **The UMD Rescue**: Standard UMD bundlers often overwrite `window.MySDK` when they load. We manually "rescue" the pre-existing instance (and its `q` array) inside `init()` before replacing the namespace with our live `Runner`.
- **Atomic Replay**: We process backlogged events in a First-In-First-Out (FIFO) order and immediately clear the queue **before** starting the loop to prevent "Double Replay" bugs.

### 🏷️ Part C: Type-Safe Lifecycle Management

Using TypeScript **Discriminated Unions** ensures internal stability and prevents "Double Initialization" bugs.

- **Union States**:
  1. **Pre-init**: Function state with a `q: Command[]` property.
  2. **Post-init**: Function state with an `_initialized: true` flag.
- **Idempotency**: The `init` function exits early if `_initialized` is true, ensuring the SDK remains a single-instance "Good Citizen" on the page.

---

## Phase 2: Memory Management & DOM Tracking

### Phase 2.1: Memory-Safe DOM Tracking (WeakMap)

- **The Problem**: Storing metadata in a standard `Map` prevents Garbage Collection (GC) of deleted DOM nodes, leading to memory leaks in SPAs.
- **The WeakMap Solution**: `WeakMap<HTMLElement, TrackingMetadata>` allows the GC to reclaim elements automatically when they are removed from the DOM.
- **Mutation by Reference**: Since WeakMap stores object references, we retrieve the metadata object once and mutate its properties (e.g., `metadata.clickCount++`) directly. This is highly performant as it avoids repeated `.set()` calls and minimizes object allocation overhead.

### Phase 2.2: Automated Tracking & DOM Observation

- **Initial Scan**: Upon initialization, the SDK performs a one-time traversal of the existing DOM (`document.body`) to register all elements currently matching the `[data-track]` selector.
- **Dynamic Observation**: We utilize `MutationObserver` (asynchronous and microtask-based) to watch for `childList` changes.
- **Performance**: The browser batches multiple DOM changes into a single callback, preventing "Jank" and Layout Thrashing.

### Phase 2.3: High-Scale Event Delegation (The Ears)

- **The "One Listener" Strategy**: Attaching 1,000 listeners is "Memory Suicide." We attach exactly **one** listener to the `window` object.
- **The .closest() Pattern**: Traverses up the DOM tree from the click target to find the nearest tracked parent, capturing clicks on icons or text inside a button accurately.
- **Passive & Capture**: We use `{ passive: true }` to ensure zero scroll lag and `{ capture: true }` to ensure we see the event even if other scripts call `stopPropagation()`.

---

## Phase 3: Reliability & Data Transport

### Phase 3.1: Centralized Transport & Batching

- **Centralized Strategy**: We implement a **Centralized Transport** strategy by injecting a unique instance (DI) into all components, ensuring all events share a single buffer and flush timer.
- **Batching**: We use a **5 events or 5 seconds** rule to balance server load versus data freshness.

### Phase 3.2: Reliability & The "Final Flush"

- **navigator.sendBeacon()**: This API allows the browser to send data asynchronously in the background. It is guaranteed by the browser to finish even if the page is closed.
- **Visibility API (Final Flush)**: We flush the buffer when `document.visibilityState === 'hidden'`. This is more reliable than `unload` and respects the **bfcache** (Back-Forward Cache).

### ⚡ Senior Refinement: Bypassing CORS Preflight

- **The Challenge**: Sending `application/json` triggers an **OPTIONS (Preflight)** request. At 2B events/day, this doubles infrastructure costs.
- **The Optimization**: By wrapping JSON in a `Blob` with `type: 'text/plain'`, the browser treats the beacon as a **"Simple Request."** This eliminates the Preflight overhead while the server still receives the valid JSON string.

---

### 🛠 Refactored Global Safety (The "Do No Harm" Rule)

In high-scale environments like Rakuten Ichiba, the SDK must be a guest that never breaks the host.

- **Global Try-Catch**: The entire `init()` function is wrapped in a try-catch block to ensure that an SDK failure never crashes the host site's critical business logic (like checkout).
- **Namespace Hijacking Order**: We swap the global `window.MySDK` **before** starting observers, ensuring the system is ready to handle events the moment we start "watching."

# Phase 4: Hardening & Enterprise Testing (Vitest)

In this phase, we moved from **Building** to **Hardening**. At Rakuten scale, we cannot manually verify data flow; we need automated proofs that our logic holds up under network stress and time-sensitive triggers.

## Part A: Environmental Simulation (JSDOM vs. Reality)

We discovered that testing an SDK in a terminal (Node/Bun) creates a "Simulation Gap."

- **The Problem**: Node.js does not have a `document`, `window`, or `navigator`.
- **The Solution**: We integrated **JSDOM** to simulate the browser environment. However, we learned that JSDOM only simulates the **DOM**, not the **Network**. We had to manually mock `navigator.sendBeacon` using `vi.fn()` to track outgoing calls.

## Part B: Deterministic "Time Travel" Testing

Testing a 5-second batching rule shouldn't take 5 seconds of real time.

- **Fake Timers**: Using `vi.useFakeTimers()`, we "froze" the global clock.
- **Clock Manipulation**: We used `vi.advanceTimersByTime(5000)` to fast-forward the SDK's internal `setTimeout` logic.
- **Sequential Integrity**: We used `vi.setSystemTime()` to prove that the SDK captures unique, sequential timestamps even when events happen milliseconds apart.

## Part C: Data Integrity & Payload Verification

An SDK is essentially a "Data Translator." If the translation is wrong, the backend receives garbage.

- **Blob Cracking**: Since `sendBeacon` transmits a `Blob`, we used `await blob.text()` inside our tests to "crack open" the payload.
- **Deep Assertion**: We verified not just that a request was sent, but that the internal JSON structure matched our batching contract (an Array of Objects).

## Part D: Simulation (JSDOM) vs. Browser Testing

We analyzed when to use "Fake" browsers versus "Real" ones for SDK verification.

| Feature       | Simulation (JSDOM)                        | Browser Testing (@vitest/browser)       |
| :------------ | :---------------------------------------- | :-------------------------------------- |
| **Execution** | Runs in Node.js (Terminal)                | Runs in a real Chrome/Safari instance   |
| **Speed**     | Ultra-Fast (ms)                           | Slower (seconds to launch)              |
| **Accuracy**  | ~80% (Missing complex Web APIs)           | 100% (Real browser behavior)            |
| **Mocks**     | Heavily used (e.g., Mocking `sendBeacon`) | Less needed (uses real APIs)            |
| **Best For**  | Testing internal **Logic**                | Testing **Cross-browser Compatibility** |

---

## 💡 Key Discussion Points (Senior Interview Focus)

- **Why Mock instead of Real Testing?**: "Speed and Determinism. Mocks allow us to test the **SDK Logic** (e.g., 'Does it batch 5 items?') without the 'flakiness' of real network latency or the cost of hitting production servers."
- **Unit Testing vs. Browser Testing**: "Unit tests (JSDOM) are for rapid logic verification (O(seconds)). Browser tests (@vitest/browser) are for cross-browser compatibility (O(minutes)). For a core data pipeline, both are required."
- **Cleanup (Idempotency)**: "Always use `afterEach` to reset `vi.useRealTimers()`. If you don't 'clean up' the fake clock, it will leak into other tests, causing mysterious failures."
- **The "Final Flush" Test**: To simulate a user closing a tab, we learned to manually dispatch a `visibilitychange` event and use `Object.defineProperty` to toggle the `document.visibilityState` to 'hidden'.

## FAQ (Developer Experience & Strategy)

1. Why use a "Dynamic Loader" snippet instead of a manual `<script>` tag?

Most professional SDKs use a small inline "Loader" that programmatically appends the `<script>` tag to the DOM.

- **Asynchronous Execution**: It ensures the SDK is loaded with `async` or `defer`, preventing the tracking script from blocking the "Critical Rendering Path" of the host site.
- **Resiliency**: If the script fails to load (e.g., ad-blockers or network issues), the "Stub" remains in memory, safely capturing events in a queue without crashing the application.
- **Version Control**: It allows the SDK provider to dynamically inject versioning or environment-specific parameters (e.g., `sdk.js?v=2.0`) directly into the URL based on the user's configuration.

2. If we use `data-track`, is the SDK actually "Auto"?

In enterprise analytics, **"Auto-tracking"** refers to the **Decoupling of Tracking Logic**.

- **The Decoupling**: Instead of a developer writing JavaScript (`MySDK('track', ...)`), they simply decorate HTML with attributes. The SDK's `MutationObserver` then **automatically** reacts to these changes.
- **Noise Reduction**: At the scale of 2B+ events (Rakuten AMD scale), tracking "every single click" creates massive data noise and high CPU overhead.
- **The Contract**: `data-track` acts as a clear contract between the Marketing/Product teams (who define what is important via HTML/CMS) and the Engineering team (who provide the infrastructure to capture it).
