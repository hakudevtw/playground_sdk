import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Transport } from "./transport";

/**
 * 🧪 Mocking the Global Navigator
 * Since JSDOM is a DOM simulator, it lacks Network APIs like sendBeacon.
 * We provide a 'Spy' (vi.fn) to verify if and how the SDK tries to send data.
 */
const sendBeaconMock = vi.fn(() => true);

beforeEach(() => {
	// Setup the mock on the global object
	Object.defineProperty(navigator, "sendBeacon", {
		value: sendBeaconMock,
		writable: true,
		configurable: true,
	});

	// 💡 Time Travel: Freeze the clock so we can control it precisely
	vi.useFakeTimers();

	// Clear mock state between tests to avoid 'leaking' call counts
	sendBeaconMock.mockClear();
});

afterEach(() => {
	// 💡 Cleanup: Always restore real time to prevent side effects in other tests
	vi.useRealTimers();

	// Reset document state (important for visibility tests)
	Object.defineProperty(document, "visibilityState", {
		value: "visible",
		configurable: true,
	});
});

test("should flush after 5 seconds when the queue has only 1 item", () => {
	const transport = new Transport("https://webhook.site/test");

	transport.enqueue({
		type: "click",
		timestamp: Date.now(),
	});

	// Verify no data is sent yet (waiting for timer)
	expect(sendBeaconMock).not.toHaveBeenCalled();

	// 💡 Advance time manually by 5s
	vi.advanceTimersByTime(5000);

	expect(sendBeaconMock).toHaveBeenCalledTimes(1);
});

test("should capture unique, sequential timestamps for rapid events", async () => {
	const transport = new Transport("https://webhook.site/test");

	// 💡 Deterministic Testing: Set a specific start time
	const startTime = 1000;
	vi.setSystemTime(startTime);

	transport.enqueue({ type: "click_1", timestamp: Date.now() });

	// Move the clock 50ms forward
	vi.advanceTimersByTime(50);

	transport.enqueue({ type: "click_2", timestamp: Date.now() });

	transport.flush();

	const [_url, blob] = sendBeaconMock.mock.calls[0] as unknown as [
		string,
		Blob,
	];
	const events = JSON.parse(await blob.text());

	// Prove that 'frozen' time was advanced correctly
	expect(events[0].timestamp).toBe(1000);
	expect(events[1].timestamp).toBe(1050);
});

test("should flush immediately when the queue reaches the batch limit (5)", () => {
	const transport = new Transport("https://webhook.site/test");

	// 💡 Batching Logic: No timer should be needed if we hit the limit
	for (let i = 0; i < 5; i++) {
		transport.enqueue({ type: "batch_event", timestamp: Date.now() });
	}

	expect(sendBeaconMock).toHaveBeenCalledTimes(1);
});

test("should send the correct JSON structure (Data Integrity)", async () => {
	const transport = new Transport("https://webhook.site/test");
	const testTimestamp = 123_456_789;

	transport.enqueue({
		type: "click",
		timestamp: testTimestamp,
		payload: { buttonId: "submit" },
	});

	transport.flush();

	// Extract and 'Crack Open' the Blob
	const [url, blob] = sendBeaconMock.mock.calls[0] as unknown as [string, Blob];
	const data = JSON.parse(await blob.text());

	// 💡 Verification: Ensure the 'Translator' didn't corrupt the object
	expect(url).toBe("https://webhook.site/test");
	expect(data).toBeInstanceOf(Array);
	expect(data[0]).toEqual({
		type: "click",
		timestamp: testTimestamp,
		payload: { buttonId: "submit" },
	});
});

test("should flush on VisibilityChange (Final Flush)", () => {
	const transport = new Transport("https://webhook.site/test");

	// 💡 Wiring: The instance must be listening to the document
	transport.setupFinalFlush();

	transport.enqueue({ type: "exit_event", timestamp: Date.now() });

	// Simulate user closing the tab/hiding the app
	Object.defineProperty(document, "visibilityState", {
		value: "hidden",
		configurable: true,
	});

	document.dispatchEvent(new Event("visibilitychange"));

	expect(sendBeaconMock).toHaveBeenCalled();
});
