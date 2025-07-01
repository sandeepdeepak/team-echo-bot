import { Version3Client } from "jira.js";
import dotenv from "dotenv";
dotenv.config();

const client = new Version3Client({
  host: process.env.JIRA_HOST,
  authentication: {
    basic: {
      email: "sandeepdeepak001@gmail.com",
      apiToken: process.env.JIRA_API_TOKEN,
    },
  },
});

const transitions = await client.issues.getTransitions({
  issueIdOrKey: "KAN-2",
});
console.log(transitions.transitions);

await client.issues.doTransition({
  issueIdOrKey: issueKey,
  transition: { id: transitionId },
});

// async function createIssue() {
//   const newIssue = await client.issues.createIssue({
//     fields: {
//       summary: "Hello from jira.js!",
//       issuetype: { name: "Task" },
//       project: { key: "KAN" },
//       description: "Need to check working of integration of teams",
//     },
//   });
//   console.log(`Created issue: ${newIssue.key}`);
// }

// createIssue();
