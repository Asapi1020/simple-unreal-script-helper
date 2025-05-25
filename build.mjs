import { build } from "esbuild";

try {
	await build({
		entryPoints: ["src/extension.ts"],
		bundle: true,
		platform: "node",
		target: "node22",
		format: "cjs",
		outfile: "dist/extension.js",
		external: ["vscode"],
	});
} catch (error) {
	console.error("Build failed:", error);
	process.exit(1); // Exit with a non-zero status code to indicate failure
}
