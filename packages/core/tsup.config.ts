import { umdWrapper } from "esbuild-plugin-umd-wrapper";
import { defineConfig, type Format, type Options } from "tsup";

export default defineConfig(() => {
	const format = ["esm", "cjs", "umd"] as Options["format"];

	return {
		entry: ["src/index.ts"],
		outDir: "dist",
		dts: true, // generate .d.ts files
		sourcemap: true, // generate sourcemap files
		clean: true, // clean the dist directory before building
		format, // output format
		treeshake: true, // enable tree shaking (https://tsup.egoist.dev/#tree-shaking)

		// https://tsup.egoist.dev/#custom-esbuild-plugin-and-options
		// https://github.com/inqnuam/esbuild-plugin-umd-wrapper#readme
		esbuildPlugins: [umdWrapper({ libraryName: "core" })],
		globalName: "MySDK_Internal", // specify the global variable name for the UMD build
		outExtension: ({ format }) => {
			const extended = format as Format | "umd";
			switch (extended) {
				case "esm":
					return { js: ".mjs" };
				case "cjs":
					return { js: ".cjs" };
				case "umd":
					return { js: ".global.js" };
				default:
					return { js: ".js" };
			}
		},
	};
});
