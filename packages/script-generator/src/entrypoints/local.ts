import { handler } from "../workflow-runner";

const genre = process.argv[2] ?? "テクノロジー";

console.log(`Starting workflow with genre: ${genre}`);

const result = await handler({ genre });

result.match(
  (script) => console.log(JSON.stringify(script, null, 2)),
  (error) => {
    console.error(`[${error.type}] ${error.message}`);
    process.exit(1);
  },
);
