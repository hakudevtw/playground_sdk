type Command = [string, ...unknown[]];

type Runner = (command: string, ...args: unknown[]) => void;

type MySDK = Runner &
	(
		| {
				_initialized: undefined;
				q?: Command[];
		  }
		| {
				_initialized: true;
		  }
	);

declare global {
	interface Window {
		MySDK?: MySDK;
	}
}

const SDK_NAME = "MySDK";

export const init = () => {
	// 1. Capture the pre-existing SDK instance immediately
	const _window = typeof window === "undefined" ? ({} as Window) : window;
	const instance = _window[SDK_NAME];

	if (!instance) {
		return;
	}

	// 2. If the SDK is already initialized, we don't want to init twice
	if (instance._initialized) {
		console.log("SDK: Already initialized");
		return;
	}

	// 3. Get the queue or empty array
	const queue = instance.q || [];
	instance.q = []; // Clear the queue to avoid replay of the same commands

	// 4. Create the SDK instance
	const sdk: MySDK = (command, ...args) => {
		console.log(`[SDK Live] Executing: ${command}`, args);
	};
	sdk._initialized = true;

	// 5. Replace the existing instance with the new one
	_window[SDK_NAME] = sdk;

	// 6. Replay the queue
	console.log("SDK: Starting Replay of", queue.length, "items");
	for (const args of queue) {
		sdk(...args);
	}
};

init();
