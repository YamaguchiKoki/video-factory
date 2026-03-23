import { handler } from "../handler";

const genre = process.argv[2] ?? "テクノロジー";

console.log(`Starting workflow with genre: ${genre}`);

const script = await handler({ genre });

console.log(JSON.stringify(script, null, 2));
