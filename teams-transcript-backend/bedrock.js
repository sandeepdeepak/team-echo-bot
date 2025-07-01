import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

export async function processWithBedrock(text, mode = "general") {
  const modelId = "anthropic.claude-3-sonnet-20240229-v1:0";

  let prompt = "";
  if (mode === "jira") {
    prompt = `
You are a Jira assistant.

When the user sends a Jira-related request, respond with a JSON object describing the intended action AND include a short acknowledgement message in natural language.

If summary is not provided, try to derive it from the description (e.g. use the first sentence as a fallback).
If projectKey is missing, {"key": "KAN"}.
use jira.js npm package to make the payload accordingly.

transitions = [
  { id: '11', name: 'To Do' },
  { id: '21', name: 'In Progress' },
  { id: '31', name: 'Done' }
] -> make use while performing update transistions

the reponse should be in JSON format so that it will be called in below method to access jira

JSON format be like { actualText: 'should be taken from text', category,  action, payload, message: 'If jira action is done, acknowledgement method'}
Make sure once again using jira.js documentation on category,  action, payload

async callJiraMethod(category, action, payload) {
    const service = client[category]; // e.g., client.issues
    return await service[action](payload);
  },

issue.key - you should generate similar to KAN-1, KAN-23, etc depending on text input

Examples : 

// 📝 Fetch the newly created issue (replace 'KAN-3' with the actual issue key)
const issue = await client.issues.getIssue({ issueIdOrKey: 'KAN-3' });

// 🔄 Get all available workflow transitions for the fetched issue
const { transitions } = await client.issues.getTransitions({ issueIdOrKey: issue.key });

// 🔁 Apply the first available transition (by its ID) to change the issue’s status
await client.issues.transitionIssue({
  issueIdOrKey: issue.key,
  transition: { id: transitions[0].id }
});

// 👤 Assign the issue to a user with the specified Atlassian account ID
await client.issues.assign({
  issueIdOrKey: issue.key,
  accountId: '5f...abc123'
});

// 🗑️ Delete the issue without deleting any subtasks
await client.issues.deleteIssue({
  issueIdOrKey: issue.key,
  deleteSubtasks: false
});

//Changing task or bug status come under transistions category and follow this pattern
await client.issues.doTransition({
  issueIdOrKey: issueKey,
  transition: { id: transitionId },
});

ONLY respond with a JSON object. Now handle: ${text}
`.trim();
  } else {
    prompt = `Reply in brief:\n\n${text}`;
  }

  const body = {
    anthropic_version: "bedrock-2023-05-31",
    messages: [{ role: "user", content: prompt }],
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

  try {
    const parsed = JSON.parse(responseBody);
    console.log(parsed);
    return parsed.content?.[0]?.text;
  } catch (err) {
    console.error("Failed to parse Bedrock response:", responseBody);
    return null;
  }
}
