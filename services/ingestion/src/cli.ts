const [command, mode] = process.argv.slice(2);

if (command !== "retention" || !["--dry-run", "--execute"].includes(mode ?? "")) {
  console.error("Usage: node dist/cli.js retention --dry-run|--execute");
  process.exitCode = 2;
} else {
  const selectedMode = mode === "--dry-run" ? "--dry-run" : "--execute";
  process.argv = [process.argv[0] ?? "node", process.argv[1] ?? "cli", selectedMode];
  await import("./jobs/retention.js");
}
