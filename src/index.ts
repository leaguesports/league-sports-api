import { createApp } from "./app";
import { getConfig } from "./config";

async function main() {
  const config = getConfig();
  createApp(config);
}

function handleError(error: unknown) {
  console.error(error);
  process.exit(1);
}

main().catch(handleError);
