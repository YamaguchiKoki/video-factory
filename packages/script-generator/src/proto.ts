import { Agent } from "@strands-agents/sdk";

const main = async () => {
  const agent = new Agent({});

  // Invoke
  const result = await agent.invoke("What is the square root of 1764?");
  console.log(result);
};

main();
