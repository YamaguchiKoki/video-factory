import { fromPromise } from "neverthrow";
import { run } from "./docker-runner.js";

fromPromise(run(), (error) => {
  console.error("Unhandled error:", error);
  return error;
}).mapErr(() => process.exit(1));
