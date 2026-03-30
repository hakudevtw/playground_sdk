import type { Transport } from "./transport";

/**
 * Metadata structure for tracked DOM elements.
 * @interface TrackingMetadata
 * @property {number} clickCount - Total interactions in the current session.
 * @property {string} [customId] - ID of the element (usually the HTML id).
 * @property {number} [lastClickedAt] - Unix timestamp of the last interaction.
 */
interface TrackingMetadata {
	clickCount: number;
	customId?: string;
	lastClickedAt?: number;
}

/**
 * Manages element-level state using a memory-safe approach.
 * 💡 Architecture: We use a WeakMap to ensure that when a React/Vue component
 * is unmounted and removed from the DOM, the tracking data is automatically
 * garbage collected, preventing memory leaks in long-running SPAs.
 */
export class ElementTracker {
	private readonly metadataMap: WeakMap<HTMLElement, TrackingMetadata>;

	constructor() {
		this.metadataMap = new WeakMap();
	}

	/**
	 * Registers an element for tracking.
	 * @param {HTMLElement} element - The target DOM node.
	 * @param {Partial<TrackingMetadata>} initialData - Seed data for the tracker.
	 */
	track(element: HTMLElement, initialData: Partial<TrackingMetadata>) {
		const metadata = this.ensureMetadata(element);
		Object.assign(metadata, initialData);
	}

	/**
	 * Retrieves metadata. Returns undefined if the element isn't being tracked.
	 */
	getMetadata(element: HTMLElement): TrackingMetadata | undefined {
		return this.metadataMap.get(element);
	}

	/**
	 * Increments the interaction count for a specific element.
	 * Mutates the reference stored in the WeakMap directly for O(1) performance.
	 */
	incrementClick(element: HTMLElement) {
		const metadata = this.ensureMetadata(element);
		metadata.clickCount++;
		metadata.lastClickedAt = Date.now();
	}

	/**
	 * 🛡️ Lazy Initialization Pattern:
	 * Ensures we always have a valid object to work with without pre-allocating
	 * memory for every element on the page.
	 */
	private ensureMetadata(element: HTMLElement): TrackingMetadata {
		const existing = this.metadataMap.get(element);
		if (existing) {
			return existing;
		}

		const initial: TrackingMetadata = { clickCount: 0 };
		this.metadataMap.set(element, initial);
		return initial;
	}
}

/**
 * Automates element discovery using MutationObserver.
 * 💡 Scale Logic: Instead of re-scanning the whole DOM on every change,
 * we only scan newly added nodes (addedNodes) to keep CPU overhead low.
 */
export class AutoTracker {
	private readonly observer: MutationObserver;
	private readonly elementTracker: ElementTracker;

	constructor(elementTracker: ElementTracker) {
		this.elementTracker = elementTracker;
		this.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "childList") {
					for (const node of mutation.addedNodes) {
						// We only care about HTMLElements (skipping text/comment nodes)
						if (node instanceof HTMLElement) {
							this.searchAndTrack(node);
						}
					}
				}
			}
		});
	}

	/**
	 * Performs an initial scan and starts the real-time observer.
	 */
	start() {
		this.searchAndTrack(document.body);

		this.observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		console.log("[SDK] AutoTracker started.");
	}

	stop() {
		this.observer.disconnect();
	}

	/**
	 * Recursively identifies elements with the [data-track] attribute.
	 */
	private searchAndTrack(root: HTMLElement) {
		// Check if the root node of the mutation is the target
		if (root.hasAttribute("data-track")) {
			this.elementTracker.track(root, { customId: root.id });
		}

		// Query for all children matching our selector
		const targets = root.querySelectorAll<HTMLElement>("[data-track]");
		for (const target of targets) {
			this.elementTracker.track(target, { customId: target.id });
		}
	}
}

/**
 * Implements Global Event Delegation.
 * 💡 Rakuten Scale: Attaching 1,000 listeners to 1,000 buttons is inefficient.
 * We use a single 'Window' listener to handle all clicks via event bubbling.
 */
export class EventDelegator {
	private readonly elementTracker: ElementTracker;
	private readonly transport: Transport;

	constructor(elementTracker: ElementTracker, transport: Transport) {
		this.elementTracker = elementTracker;
		this.transport = transport;
	}

	start() {
		/**
		 * 💡 Senior Tip:
		 * - 'capture: true' ensures we see the event even if another script
		 * calls stopPropagation() later.
		 * - 'passive: true' ensures we don't block the browser's UI thread.
		 */
		window.addEventListener("click", this.handleClick.bind(this), {
			passive: true,
			capture: true,
		});
	}

	private handleClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target) {
			return;
		}

		/**
		 * 💡 Traversal: .closest() finds the nearest parent with tracking enabled.
		 * This handles cases where a user clicks an icon or text inside a button.
		 */
		const trackedElement = target.closest<HTMLElement>("[data-track]");

		if (trackedElement) {
			this.elementTracker.incrementClick(trackedElement);
			const metadata = this.elementTracker.getMetadata(trackedElement);

			// Report to the buffered transport layer
			this.transport.enqueue({
				type: "click",
				elementId: trackedElement.id,
				timestamp: Date.now(),
				payload: { clicks: metadata?.clickCount ?? 0 },
			});
		}
	}
}
