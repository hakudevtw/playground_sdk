/**
 * Internal metadata structure for tracked DOM elements.
 * Using an interface allows for easy extension (e.g., adding scroll depth or hover duration).
 */
interface TrackingMetadata {
	clickCount: number;
	customId?: string;
	lastClickedAt?: number;
}

/**
 * ElementTracker manages the association between DOM elements and tracking data.
 * 💡 Senior Design Choice: We use a WeakMap to prevent memory leaks.
 * Since the Map's keys are HTMLElements, using a standard Map would prevent
 * Garbage Collection (GC) of elements removed from the DOM. WeakMap allows
 * the GC to reclaim memory automatically when the element is destroyed.
 */
export class ElementTracker {
	private readonly metadataMap: WeakMap<HTMLElement, TrackingMetadata>;

	constructor() {
		this.metadataMap = new WeakMap();
	}

	/**
	 * Registers or updates an element for tracking.
	 * Uses Object.assign to merge initialData without wiping out existing state.
	 */
	track(element: HTMLElement, initialData: Partial<TrackingMetadata>) {
		const metadata = this.ensureMetadata(element);
		Object.assign(metadata, initialData);
	}

	/**
	 * Retrieves the current tracking state for an element.
	 * Returns a default state if the element hasn't been tracked yet.
	 */
	getMetadata(element: HTMLElement): TrackingMetadata | undefined {
		return this.metadataMap.get(element);
	}

	/**
	 * Specialized method to update click-related metrics.
	 * Mutating the reference directly is safe and efficient within a WeakMap.
	 */
	incrementClick(element: HTMLElement) {
		const metadata = this.ensureMetadata(element);
		metadata.clickCount++;
		metadata.lastClickedAt = Date.now();
	}

	/**
	 * 🛡️ Lazy Initialization Pattern:
	 * Ensures that we always work with a valid object reference.
	 * This reduces null-checks throughout the rest of the class.
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

export class AutoTracker {
	// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
	private readonly observer: MutationObserver;
	private readonly elementTracker: ElementTracker;

	constructor(elementTracker: ElementTracker) {
		this.elementTracker = elementTracker;
		this.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "childList") {
					for (const node of mutation.addedNodes) {
						if (node instanceof HTMLElement) {
							this.searchAndTrack(node);
						}
					}
				}
			}
		});
	}

	start() {
		// Initial scan for elements already on the page
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

	private searchAndTrack(root: HTMLElement) {
		if (root.hasAttribute("data-track")) {
			this.elementTracker.track(root, { customId: root.id });
		}

		const targets = root.querySelectorAll<HTMLElement>("[data-track]");
		for (const target of targets) {
			this.elementTracker.track(target, { customId: target.id });
		}
	}
}
