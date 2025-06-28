import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

export async function processWithBedrock(text) {
  const modelId = "anthropic.claude-3-sonnet-20240229-v1:0";

  const body = {
    anthropic_version: "bedrock-2023-05-31",
    messages: [
      {
        role: "user",
        content: `Reply in brief:\n\n${text}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.7,
  };

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body),
  });

  const response = await client.send(command);
  const responseBody = await response.body.transformToString();
  const parsed = JSON.parse(responseBody);

  return parsed.content?.[0]?.text || "No summary generated.";
}
