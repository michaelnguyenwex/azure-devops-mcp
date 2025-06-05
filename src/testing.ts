// Important: Make sure to import dotenv first to load environment variables
import * as dotenv from 'dotenv';
dotenv.config();
import { createJIRAsubtasks} from './jiraUtils.js'; // Import Jira functionality

// Create an async function to run the test
async function runTest() {
  console.log("Testing mode - Running create-jira-subtasks");
  console.log("Parameters:");
  console.log("- parentJiraId: CDH-342");
  console.log("- subtaskSummaries: ['Create Test Case', 'Execute Test Case']");
  // Make sure environment variables are loaded
  console.log("Environment check:");
  console.log("- JIRA_API_BASE_URL:", process.env.JIRA_API_BASE_URL || "Missing");
  console.log("- JIRA_PAT:", process.env.JIRA_PAT ? "Set" : "Missing");

  try {
    console.log("Starting createJIRAsubtasks...");
    // Use a recent, existing JIRA issue for testing
    const parentJiraId = "CDH-342";
    const subtasks = [
      "Create Test Case",
      "Execute Test Case"
    ];
    
    console.log(`Testing with parent ID: ${parentJiraId}`);
    console.log(`Subtasks: ${JSON.stringify(subtasks, null, 2)}`);
    
    const results = await createJIRAsubtasks(parentJiraId, subtasks);
    console.log("\nRESULTS:", JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("\nERROR:", error);
    console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  }

  // Ensure we don't exit immediately
  console.log("Test complete.");
}

// Run the test
runTest();
