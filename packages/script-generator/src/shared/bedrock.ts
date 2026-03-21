import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

export const bedrock = createAmazonBedrock({
  region: "us-east-1",
  credentialProvider: fromNodeProviderChain(),
});
