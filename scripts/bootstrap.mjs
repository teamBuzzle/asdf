#!/usr/bin/env node
// Installs the toolchain goldeye needs, then the project dependencies.
// Node is the only prerequisite: run `node scripts/bootstrap.mjs` on a fresh machine.
import { execFileSync, spawnSync } from "node:child_process";
import { platform } from "node:process";

const isWindows = platform === "win32";

const has = (cmd) =>
	spawnSync(cmd, ["--version"], { stdio: "ignore", shell: isWindows }).status === 0;

const run = (cmd, args, hint) => {
	console.log(`\n$ ${cmd} ${args.join(" ")}`);
	const { status } = spawnSync(cmd, args, { stdio: "inherit", shell: isWindows });
	if (status !== 0) {
		console.error(`\nFailed: ${cmd} ${args.join(" ")}`);
		if (hint) console.error(hint);
		process.exit(status ?? 1);
	}
};

const winget = (id, override) =>
	run("winget", [
		"install",
		"-e",
		"--id",
		id,
		"--accept-package-agreements",
		"--accept-source-agreements",
		...(override ? ["--override", override] : []),
	]);

// Rust on Windows compiles against the MSVC toolchain, which ships with the
// Visual Studio Build Tools rather than with rustup.
const hasMsvc = () => {
	const vswhere =
		"C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe";
	try {
		return (
			execFileSync(vswhere, [
				"-products",
				"*",
				"-requires",
				"Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
				"-property",
				"displayName",
			])
				.toString()
				.trim().length > 0
		);
	} catch {
		return false;
	}
};

if (isWindows && !hasMsvc()) {
	console.log("MSVC build tools missing — installing (several GB, takes a while).");
	winget(
		"Microsoft.VisualStudio.2022.BuildTools",
		"--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended",
	);
}

if (has("cargo")) {
	console.log("cargo: already installed");
} else if (isWindows) {
	winget("Rustlang.Rustup");
	run("rustup", ["default", "stable"]);
} else {
	run("sh", [
		"-c",
		"curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
	]);
}

run("rustup", ["component", "add", "clippy", "rustfmt"]);

if (has("pnpm")) {
	console.log("pnpm: already installed");
} else if (isWindows) {
	winget("pnpm.pnpm");
} else {
	run("npm", ["install", "-g", "pnpm"]);
}

run(
	"pnpm",
	["install"],
	"If this failed on ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION, the lockfile pins\n" +
		"packages published less than a day ago, which pnpm blocks by default. Either\n" +
		"wait until they age past the cutoff, or decide as a team whether to relax\n" +
		"minimumReleaseAge in pnpm-workspace.yaml.",
);

console.log(
	"\nDone. Open a new terminal so the updated PATH applies, then run: pnpm tauri dev",
);
