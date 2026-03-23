import { run } from "../cli.js";

run().catch((error: unknown) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
