// jiraService.mjs
import { Version3Client } from "jira.js";
import dotenv from "dotenv";
dotenv.config();

// 🔐 Jira client configuration
const client = new Version3Client({
  host: "https://innovation-sprint.atlassian.net",
  authentication: {
    basic: {
      email: "sandeepdeepak001@gmail.com",
      apiToken: process.env.JIRA_API_TOKEN,
    },
  },
});

// ✅ Exposed service functions
const JiraService = {
  /**
   * Dynamically call Jira client function
   * @param {string} category - e.g., 'issues', 'issueComments'
   * @param {string} action - e.g., 'createIssue', 'getIssue'
   * @param {object} payload - payload to pass to the method
   */
  async callJiraMethod(category, action, payload) {
    const service = client[category]; // e.g., client.issues
    if (!service || typeof service[action] !== "function") {
      throw new Error(`Invalid Jira method: ${category}.${action}`);
    }

    return await service[action](payload);
  },
};

export default JiraService;
