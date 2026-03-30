/**
 * Represents a single tracking event in the pipeline.
 */
export interface TrackEvent {
	elementId?: string;
	payload?: unknown;
	timestamp: number;
	type: string;
}

/**
 * Transport handles the buffering and transmission of tracking data.
 * 💡 Architecture: We use a "Buffer & Batch" strategy to minimize HTTP overhead.
 * Sending 2B individual requests would be prohibitive; sending 400M batches is manageable.
 */
export class Transport {
	private readonly url: string;
	private queue: TrackEvent[] = [];

	// 💡 Optimization: Batching reduces the number of outgoing connections.
	private readonly MAX_BATCH_SIZE = 5;

	// 💡 Latency Trade-off: We ensure data is sent at least every 5 seconds.
	private readonly FLUSH_INTERVAL = 5000;

	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(url: string) {
		this.url = url;
	}

	/**
	 * Adds an event to the buffer.
	 * Logic: If the buffer is full, flush immediately. Otherwise, set a timer.
	 */
	enqueue(event: TrackEvent) {
		this.queue.push(event);

		if (this.queue.length >= this.MAX_BATCH_SIZE) {
			this.flush();
		} else {
			this.resetTimer();
		}
	}

	/**
	 * Transmits the buffered events to the ingestion server.
	 * 💡 Pattern: Atomic Clear. We copy and clear the queue before sending
	 * to remain thread-safe during asynchronous execution.
	 */
	flush() {
		if (this.queue.length === 0) {
			return;
		}

		const batch = [...this.queue];
		this.queue = [];
		this.clearTimer();

		/**
		 * 💡 Performance: We use 'text/plain' to avoid CORS Preflight (OPTIONS).
		 * This turns a "Complex Request" into a "Simple Request," reducing
		 * total network round-trips by half.
		 */
		// const blob = new Blob([JSON.stringify(batch)], { type: "application/json" });
		const blob = new Blob([JSON.stringify(batch)], { type: "text/plain" });

		/**
		 * 💡 Reliability: sendBeacon is used to ensure the data reaches the server
		 * even if the page is being closed or navigated away from.
		 */
		const success = navigator.sendBeacon(this.url, blob);

		if (success) {
			console.log(`[Transport] Successfully beaconed ${batch.length} events.`);
		} else {
			console.warn(
				"[Transport] Beacon failed (Queue full or payload too large?)"
			);
		}
	}

	/**
	 * 💡 Page Lifecycle Management:
	 * 'visibilitychange' (hidden) is the most reliable way to flush data
	 * before the browser kills the process, especially on mobile.
	 */
	setupFinalFlush() {
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") {
				console.log("[Transport] Page hidden. Forcing final flush...");
				this.flush();
			}
		});
	}

	/**
	 * Ensures data isn't held in the buffer indefinitely if traffic is low.
	 */
	private resetTimer() {
		if (this.timer) {
			return;
		}
		this.timer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
	}

	private clearTimer() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}
}
