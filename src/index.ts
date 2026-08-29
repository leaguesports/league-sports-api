import { createApp } from "./app";
import { getConfig } from "./config";

async function main() {
  const config = getConfig();
  const app = await createApp(config);

  app.listen(config.PORT, () => {
    console.log(`Server is running on port ${config.PORT}`);
  });
}

function handleError(error: unknown) {
  console.error(error);
  process.exit(1);
}

main().catch(handleError);
