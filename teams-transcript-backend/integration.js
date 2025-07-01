import JiraService from "./jira-service.js";
import { processWithBedrock } from "./bedrock.js";

function isJiraPrompt(text) {
  const jiraKeywords = [
    "jira",
    "issue",
    "assign",
    "ticket",
    "kan-",
    "kan ",
    "bug",
    "story",
  ];
  return jiraKeywords.some((keyword) => text.toLowerCase().includes(keyword));
}

export async function handlePrompt(text) {
  const mode = isJiraPrompt(text) ? "jira" : "general";

  console.log(mode);

  if (mode === "general") {
    const summary = await processWithBedrock(text, "general");
    return { summary, mode };
  }

  // process with Bedrock for Jira-specific commands
  const raw = await processWithBedrock(text, "jira");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { summary: "Sorry, I couldn't understand the Jira command.", mode };
  }

  const { message, category = "issues", action, payload } = parsed;
  console.log(`[Jira] Action: ${category}.${action}`);

  try {
    const result = await JiraService.callJiraMethod(category, action, payload);

    // 🧠 Optionally summarize based on action
    let summary = `${message}`;
    if (action === "getIssue" && result?.fields?.summary) {
      summary += `\n\n📝 Summary: ${result.fields.summary}`;
    }
    if (action === "createIssue" && result?.key) {
      summary += `\n🔗 Issue created: ${result.key}`;
    }

    return { summary, mode };
  } catch (err) {
    return { summary: `⚠️ Jira error: ${err.message}`, mode };
  }
}
