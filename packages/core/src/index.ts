import { AutoTracker, ElementTracker, EventDelegator } from "./tracker";
import { Transport } from "./transport";

/**
 * SDK Command type definition: [commandName, ...arguments]
 */
type Command = [string, ...unknown[]];
type Runner = (command: string, ...args: unknown[]) => void;

/**
 * Lifecycle management using Discriminated Unions.
 * Includes a config object to allow endpoint overrides from the HTML snippet.
 */
type MySDK = Runner &
	(
		| { _initialized: undefined; q?: Command[]; config?: { endpoint?: string } }
		| { _initialized: true }
	);

declare global {
	interface Window {
		MySDK?: MySDK;
	}
}

const SDK_NAME = "MySDK";
const PROD_ENDPOINT =
	"	https://webhook.site/cb436ffe-76c5-4b97-a287-f9cefc41bcc3";

/**
 * Core Initialization Function
 * Hardened with global error boundaries to ensure 3rd-party script stability.
 */
export const init = () => {
	try {
		const _window = typeof window === "undefined" ? ({} as Window) : window;
		const instance = _window[SDK_NAME];

		// Exit if the snippet is missing or SDK is already live
		if (!instance || instance._initialized) {
			return;
		}

		/**
		 * 1. Configuration & Transport Setup
		 * Prioritizes the testing endpoint (Webhook.site) if provided in the snippet.
		 */
		const endpoint = instance.config?.endpoint || PROD_ENDPOINT;
		const transport = new Transport(endpoint);
		transport.setupFinalFlush();

		// 2. Atomic Queue Extraction
		const queue = instance.q || [];
		instance.q = [];

		/**
		 * 3. Define the Live Runner
		 * Replaces the 'stub' function with the high-performance logic engine.
		 */
		const sdk: MySDK = (command, ...args) => {
			try {
				if (command === "track") {
					transport.enqueue({
						type: "manual",
						payload: args[0],
						timestamp: Date.now(),
					});
				}
			} catch (err) {
				console.error(`${SDK_NAME} command error:`, err);
			}
		};
		sdk._initialized = true;

		// 4. Namespace Hijacking (Swap before starting observers)
		_window[SDK_NAME] = sdk;

		/**
		 * 5. Tracking Subsystem Initialization
		 * Pattern: Dependency Injection (DI)
		 */
		const elementTracker = new ElementTracker();

		// The Ears: Global click delegation (O(1) memory complexity)
		const eventDelegator = new EventDelegator(elementTracker, transport);
		eventDelegator.start();

		// The Eyes: Mutation-based dynamic element discovery
		const autoTracker = new AutoTracker(elementTracker);
		autoTracker.start();

		// 6. Historic Event Replay
		if (queue.length > 0) {
			console.log(`${SDK_NAME}: Replaying ${queue.length} buffered events.`);
			for (const args of queue) {
				sdk(...args);
			}
		}
	} catch (criticalError) {
		// Fail-safe: Ensure Rakuten Ichiba/Travel doesn't crash if the SDK fails
		console.error(
			`${SDK_NAME} critical initialization failure:`,
			criticalError
		);
	}
};

init();
