import { string, z } from "zod";
import axios from 'axios';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as crypto from 'crypto';
import { getAzureDevOpsConfig } from './configStore.js'; // Corrected import path
import { addItemToJIRA } from './jiraUtils.js'; // Import Jira functionality


// Helper function to format natural language steps into Azure DevOps XML
function formatStepsToAzdoXml(naturalLanguageSteps: string): string {
  function htmlEncode(str: string): string {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
  }

  const stepLines = naturalLanguageSteps.split('\n').filter(line => line.trim() !== '');
  let stepIdCounter = 1; 
  const stepXmls: string[] = [];
  let maxStepId = 0;

  for (const line of stepLines) {
    const currentStepId = stepIdCounter++;
    if (currentStepId > maxStepId) {
      maxStepId = currentStepId;
    }

    let stepXml = '';
    const encodedLine = htmlEncode(line);

    const validateKeywords = ["verify", "ensure", "check", "expected:"];
    const isValidateStep = validateKeywords.some(keyword => line.toLowerCase().includes(keyword));

    if (isValidateStep) {
      let actionPart = encodedLine;
      let expectedPart = htmlEncode("Result is as expected.");

      const expectedMarker = "expected:";
      const expectedIndex = line.toLowerCase().indexOf(expectedMarker);

      if (expectedIndex !== -1) {
        actionPart = htmlEncode(line.substring(0, expectedIndex).trim());
        expectedPart = htmlEncode(line.substring(expectedIndex + expectedMarker.length).trim());
      } else {
        actionPart = encodedLine;
      }
      
      if (!expectedPart.trim() && expectedIndex !== -1) {
        expectedPart = htmlEncode("Result is as expected.");
      }

      stepXml = 
`<step id="${currentStepId}" type="ValidateStep">
  <parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;${actionPart}&lt;/P&gt;&lt;/DIV&gt;</parameterizedString>
  <parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;${expectedPart}&lt;/P&gt;&lt;/DIV&gt;</parameterizedString>
  <description/>
</step>`;
    } else {
      stepXml = 
`<step id="${currentStepId}" type="ActionStep">
  <parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;${encodedLine}&lt;/P&gt;&lt;/DIV&gt;</parameterizedString>
  <parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;&lt;BR/&gt;&lt;/P&gt;&lt;/DIV&gt;</parameterizedString>
  <description/>
</step>`;
    }
    stepXmls.push(stepXml);
  }

  if (stepXmls.length === 0) {
    return "<steps id=\"0\" last=\"0\"></steps>";
  }

  const joinedStepXmls = stepXmls.join('\n  ');
  return `<steps id="0" last="${maxStepId}">\n  ${joinedStepXmls}\n</steps>`;
}

/**
 * Finds an existing static test suite by name under a parent suite or creates it if it doesn't exist.
 * @param options - The options for finding or creating the test suite.
 * @param options.planId - The ID of the Test Plan.
 * @param options.parentSuiteId - The ID of the parent Test Suite.
 * @param options.suiteName - The name of the suite to find or create.
 * @returns A Promise that resolves to the ID of the found or created test suite.
 * @throws An error if the suite cannot be found or created.
 */
async function getOrCreateStaticTestSuite(options: {
  planId: number;
  parentSuiteId: number;
  suiteName: string;
}): Promise<number> {
  const { planId, parentSuiteId, suiteName } = options;

  let configFromStore;
  try {
    configFromStore = await getAzureDevOpsConfig();
  } catch (err) {
    // Propagate error if config is not set
    throw new Error(`Azure DevOps configuration error: ${(err as Error).message}. Please ensure AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables are set.`);
  }
  const { organization, projectName, pat } = configFromStore; // Destructure pat here

  // const listSuitesUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/testplan/Plans/${planId}/Suites/${parentSuiteId}/suites?api-version=7.0`; // Corrected URL to list child suites

   try {
  //   // Attempt to find an existing suite with the same name under the parent
  //   const listResponse = await axios.get(listSuitesUrl, {
  //     headers: {
  //       'Authorization': `Bearer ${pat}`,
  //       'Content-Type': 'application/json'
  //     }
  //   });

  //   if (listResponse.data && listResponse.data.value) {
  //     const existingSuite = listResponse.data.value.find((suite: any) => suite.name === suiteName && suite.suiteType === "StaticTestSuite");
  //     if (existingSuite) {
  //       console.log(`Found existing static suite '${suiteName}' with ID: ${existingSuite.id} under parent ${parentSuiteId}.`);
  //       return existingSuite.id;
  //     }
  //   }

    // If not found, create a new suite
    const createSuiteUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/testplan/Plans/${planId}/suites?api-version=7.0`;
    const createSuiteBody = {
      suiteType: "StaticTestSuite", // Corrected: lowercase 's'
      name: suiteName,
      parentSuite: { // Added parentSuite for creating a child suite
        id: parentSuiteId
      },
      inheritDefaultConfigurations: true // Added as per documentation for new suites
    };

    const createResponse = await axios.post(createSuiteUrl, createSuiteBody, {
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json'
      }
    });

    if (createResponse.data && createResponse.data.id) {
      console.log(`Successfully created static suite '${suiteName}' with ID: ${createResponse.data.id}`);
      return createResponse.data.id;
    } else {
      throw new Error('Failed to create suite or extract ID from response.');
    }

  } catch (error) {
    // 2.5: Handle API responses and errors robustly
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Check if the error is from getAzureDevOpsConfig (already handled by the throw above, but good for general robustness)
    if (errorMessage.startsWith('Azure DevOps configuration error')) { // Updated error check
        throw error; // Re-throw the specific config error
    }
    console.error(`Error in getOrCreateStaticTestSuite for suite '${suiteName}' in project '${projectName}':`, error);
    const azdoError = (error as any).response?.data?.message || errorMessage;
    throw new Error(`Failed to find or create static suite '${suiteName}' under parent suite ${parentSuiteId}. Plan: ${planId}, Project: ${projectName}. Error: ${azdoError}`);
  }
}

/**
 * @description Updates an existing Azure DevOps Test Case work item with automated test details.
 * @param options The options for updating the test case.
 * @param options.testCaseId The ID of the Test Case work item to update.
 * @param options.automatedTestName The fully qualified name of the automated test method (e.g., 'Namespace.ClassName.MethodName').
 * @param options.automatedTestStorage The name of the test assembly or DLL (e.g., 'MyProject.Tests.dll').
 * @returns A promise that resolves to an object indicating success or failure, along with response data or error details.
 */
export async function updateAutomatedTest(options: {
  testCaseId: number;
  automatedTestName: string;
  automatedTestStorage: string;
}): Promise<{ success: boolean; message: string; data?: any; errorDetails?: any }> {
  const {
    testCaseId,
    automatedTestName,
    automatedTestStorage
  } = options;

  let config;
  try {
    config = await getAzureDevOpsConfig();
  } catch (err) {
    return { success: false, message: `Azure DevOps configuration error: ${(err as Error).message}. Please ensure AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables are set.` };
  }
  const { organization, projectName, pat } = config; // Destructure pat here

  const apiUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/${testCaseId}?api-version=7.1-preview.3`;

  const requestBody = [
    { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomatedTestName", "value": automatedTestName },
    { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomatedTestStorage", "value": automatedTestStorage }
  ];

  try {
    console.log(`Attempting to update test case ${testCaseId} with automation details. URL: ${apiUrl}`);
    const response = await axios.patch(apiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${pat}`, // Use pat from config
        'Content-Type': 'application/json-patch+json'
      }
    });

    if (response.status === 200) {
      console.log(`Test case ${testCaseId} updated successfully. Data:`, response.data);
      return { success: true, message: `Test case ${testCaseId} updated successfully with automation details.`, data: response.data };
    } else {
      // This case might not be hit if axios throws for non-2xx statuses.
      console.warn(`Update for test case ${testCaseId} returned status ${response.status}`, response.data);
      return { success: false, message: `Test case ${testCaseId} update returned status ${response.status}`, data: response.data };
    }
  } catch (error: any) {
    console.error(`Error updating test case ${testCaseId} with automation details:`, error.response?.data || error.message);
    // Check if the error is due to config issues from a deeper call, though getAzureDevOpsConfig should catch it earlier
    if ((error as Error).message.includes('Azure DevOps configuration error')) {
        return { success: false, message: (error as Error).message };
    }
    return {
      success: false,
      message: `Error updating test case ${testCaseId}: ${error.message}`,
      errorDetails: error.response?.data
    };
  }
}

// Schema for the update-automated-test tool
const UpdateAutomatedTestSchema = z.object({
  testCaseId: z.number().describe("The ID of the Test Case work item to update."),
  automatedTestName: z.string().describe("The fully qualified name of the automated test method (e.g., \'Namespace.ClassName.MethodName\')."),
  automatedTestStorage: z.string().describe("The name of the test assembly or DLL (e.g., \'MyProject.Tests.dll\')."),
});

/**
 * Registers a tool to create a static test suite in Azure DevOps.
 * This is an MCP wrapper around the getOrCreateStaticTestSuite function.
 */
export function createStaticTestSuiteTool(server: McpServer) { // Renamed function
  server.tool(
    "create-static-testsuite",
    "Creates a new Static Test Suite in Azure DevOps or finds an existing one with the same name. Requires AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables to be set.", // Updated description
    {
      planId: z.number().describe("The ID of the Test Plan."),
      parentSuiteId: z.number().describe("The ID of the parent Test Suite."),
      suiteName: z.string().describe("The name of the static test suite to create or find."),
    },
    async ({ planId, parentSuiteId, suiteName }) => {
      try {
        // Config (org, project, pat) is sourced within getOrCreateStaticTestSuite via getAzureDevOpsConfig
        const suiteId = await getOrCreateStaticTestSuite({
          planId,
          parentSuiteId,
          suiteName,
        });

        return {
          content: [{ 
            type: "text", 
            text: `Static test suite '${suiteName}' (ID: ${suiteId}) successfully created or found under parent suite ${parentSuiteId} in plan ${planId}.` 
          }]
        };
      } catch (error) {
        console.error('Error in create-static-testsuite tool:', error);
        return {
          content: [{
            type: "text",
            text: `Error creating or finding static test suite: ${error instanceof Error ? error.message : 'Unknown error'}. Ensure AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables are correctly set.` // Enhanced error message
          }]
        };
      }
    }
  );
}

/**
 * Helper function to add one or more test cases to a specified test suite via Azure DevOps API.
 * @param options - The options for adding test cases.
 * @param options.createCopy - When true, creates new copies of the test cases instead of references. Default is false.
 * @returns A promise that resolves to an object indicating success or failure and a message.
 */
async function addTestCasesToSuiteAPI(options: {
  organization: string;
  projectName: string;
  pat: string;
  planId: number;
  suiteId: number;
  testCaseIds: string; // Comma-separated string of test case IDs
  createCopy?: boolean; // Optional flag to create copies instead of references
}): Promise<{ success: boolean; message: string; data?: any; newTestCaseIds?: number[]; errorDetails?: any }> {
  const { organization, projectName, pat, planId, suiteId, testCaseIds, createCopy = false } = options;

  if (!testCaseIds || testCaseIds.length === 0) {
    return { success: true, message: "No test cases provided to add." };
  }

  // If createCopy is false, use the standard reference-based approach
  if (!createCopy) {
    // The API for bulk add to a suite expects POST to /_apis/testplan/Plans/{planId}/Suites/{suiteId}/testcases/{testCaseIds}
    // where {testCaseIds} is a comma-separated string of IDs in the URL path.
    const addTcToSuiteUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/test/Plans/${planId}/Suites/${suiteId}/testcases/${testCaseIds}?api-version=7.0`;

    try {
      // Corrected: Send null as the body, headers in the config (3rd argument)
      // The API takes test case IDs from the URL path, so no body is needed for this specific endpoint.
      const response = await axios.post(addTcToSuiteUrl, null, {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json' // This content type is standard, even if no body is sent.
        }
      });

      // Assuming success if axios doesn't throw for non-2xx statuses.
      // The response for this API call is usually an array of the test case references that were added.
      // Example: response.data.value might contain the added items.
      // Count can be derived from the input string as a fallback if response doesn't clearly state it.
      const count = response.data?.count || response.data?.value?.length || testCaseIds.split(',').length; 
      const message = `Successfully added ${count} test case reference(s) (${testCaseIds}) to suite ${suiteId} in plan ${planId}.`;
      console.log(message, response.data);
      return { success: true, message: message, data: response.data };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      const azdoErrorDetail = error.response?.data?.message || '';
      const fullErrorMessage = `Failed to add test case reference(s) (${testCaseIds}) to suite ${suiteId} in plan ${planId}: ${errorMessage}. ${azdoErrorDetail}`.trim();
      console.error(fullErrorMessage, error.response?.data);
      return {
        success: false,
        message: fullErrorMessage,
        errorDetails: error.response?.data
      };
    }
  } 
  // If createCopy is true, create copies of the test cases
  else {    const testCaseIdsArray = testCaseIds.split(',');
    const newTestCaseIds: number[] = [];
    const errors: string[] = [];
    
    console.log(`Creating ${testCaseIdsArray.length} new test case(s) as copies...`);
    
    // Process each test case sequentially to avoid overwhelming the API
    for (const sourceTestCaseId of testCaseIdsArray) {
      try {
        const result = await copyTestCaseAndAddToSuite({
          organization,
          projectName,
          pat,
          sourceTestCaseId,
          planId, 
          suiteId
        });
        
        if (result.success && result.newTestCaseId) {
          newTestCaseIds.push(result.newTestCaseId);
        } else {
          errors.push(`Failed to copy test case ${sourceTestCaseId}: ${result.message}`);
        }
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        errors.push(`Error copying test case ${sourceTestCaseId}: ${errorMessage}`);
      }
    }      // Generate response based on results
    if (newTestCaseIds.length > 0) {
      const successMessage = `Successfully created ${newTestCaseIds.length} new test case(s) as copies of (${testCaseIds}) and added them to suite ${suiteId} in plan ${planId}. New IDs: ${newTestCaseIds.join(', ')}.`;
      if (errors.length > 0) {
        return {
          success: true,
          message: `${successMessage} With some errors: ${errors.join('; ')}`,
          newTestCaseIds
        };
      } else {
        return {
          success: true,
          message: successMessage,
          newTestCaseIds
        };
      }
    } else {
      return {
        success: false,
        message: `Failed to create any test case copies. Errors: ${errors.join('; ')}`
      };
    }
  }
}

export function addTestCaseToTestSuiteTool(server: McpServer) {
  server.tool(
    "add-testcase-to-testsuite",
    "Adds an existing test case to a specified test suite in Azure DevOps and optionally links it to a JIRA issue. Requires AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables to be set.",    {
      testCaseIdString: z.string().describe("The comma-delim string of ID of the Test Case."),
      planId: z.number().describe("The ID of the Test Plan containing the suite."),
      suiteId: z.number().describe("The ID of the Test Suite to add the test case to."),
      jiraWorkItemId: z.string().optional().describe("Optional. The JIRA issue ID to link the test case(s) to."),
      createCopy: z.boolean().optional().default(true).describe("Optional. When true, creates new copies of the test cases instead of references.")
    },
    async ({ testCaseIdString, planId, suiteId, jiraWorkItemId, createCopy }) => {
      let config;
      try {
        config = await getAzureDevOpsConfig();
      } catch (err) {
        return { content: [{ type: "text", text: `Azure DevOps configuration error: ${(err as Error).message}. Please ensure AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables are set.` }] };
      }
      const { organization, projectName, pat } = config;
        
      const trimmedTestCaseIdString = testCaseIdString.trim();
      if (!trimmedTestCaseIdString) {
        return { content: [{ type: "text", text: "No valid test case IDs provided in the string." }] };
      }      // Log what mode we're using
      if (createCopy) {
        console.log(`Adding test case(s) to suite ${suiteId} as new copies`);
      } else {
        console.log(`Adding test case(s) to suite ${suiteId} as references`);
      }
      
      const result = await addTestCasesToSuiteAPI({
        organization,
        projectName,
        pat,
        planId,
        suiteId,
        testCaseIds: trimmedTestCaseIdString,
        createCopy
      });
      
      if (!result.success) {
        const errorMode = createCopy ? "copying test cases" : "adding test case references";
        return {
          content: [{ 
            type: "text", 
            text: `Error while ${errorMode}: ${result.message}` 
          }]
        };
      }

      // If JIRA work item ID is provided, add links to JIRA
      if (jiraWorkItemId) {
        const testCaseIds = trimmedTestCaseIdString.split(',');
        return handleJiraIntegrationForCopiedTestCases(
          jiraWorkItemId,
          testCaseIds,
          organization,
          projectName,
          pat,
          result.message // Pass the success message from addTestCasesToSuiteAPI
        );
      }

      return {
        content: [{ 
          type: "text", 
          text: result.message 
        }]
      };
    }
  );
}

export function registerTestCaseTool(server: McpServer) { // Renamed function
   server.tool(
    "create-testcase",
    "Creates a new Test Case work item in Azure DevOps and optionally links it to a JIRA issue. Requires AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables to be set.", // Updated description
    { 
      title: z.string().describe("The title of the test case."),
      areaPath: z.string().optional().default("Health").describe("The Area Path for the test case (e.g., 'MyProject\\Area\\Feature'). Defaults to the project name if not specified, but 'Health' is a common default."),
      iterationPath: z.string().optional().default("Health").describe("The Iteration Path for the test case (e.g., 'MyProject\\Sprint 1'). Defaults to the project name if not specified, but 'Health' is a common default."),
      steps: z.string().optional().default("").describe("Multi-line natural language string describing test steps. Each line can be an action or a validation. For validations, use 'Expected:' to denote the expected outcome."),
      priority: z.number().optional().default(2).describe("Priority of the test case (1=High, 2=Medium, 3=Low, 4=Very Low). Defaults to 2."),
      assignedTo: z.string().optional().describe("The unique name or email of the user to assign the test case to (e.g., 'user@example.com'). Optional."),
      state: z.string().optional().default("Design").describe("The initial state of the test case (e.g., 'Design', 'Ready'). Defaults to 'Design'."),
      reason: z.string().optional().default("New").describe("The reason for the initial state (e.g., 'New', 'Test Case created'). Defaults to 'New'."),
      automationStatus: z.string().optional().default("Not Automated").describe("The automation status of the test case (e.g., 'Not Automated', 'Automated', 'Planned'). Defaults to 'Not Automated'."),
      parentPlanId: z.number().optional().describe("Optional. The ID of the Test Plan. If provided with `parentSuiteId`, a new child test suite (named after the test case title) will be created under the specified `parentSuiteId`, and the test case will be added to this new child suite."),
      parentSuiteId: z.number().optional().describe("Optional. The ID of the parent Test Suite. If provided with `parentPlanId`, a new child test suite (named after the test case title) will be created under this suite, and the test case will be added to this new child suite."),
      jiraWorkItemId: z.string().optional().default("").describe("Optional. The JIRA issue ID to link the test case to."),
      createTestSuite: z.boolean().optional().default(true).describe("Optional. When false, the test case will be added directly to the parentSuiteId instead of creating a new child suite. Default is true.")
    },
        async ({ title, areaPath, iterationPath, steps, priority, assignedTo, state, reason, automationStatus, parentPlanId, parentSuiteId, jiraWorkItemId, createTestSuite }) => {
      let config;
      try {
        config = await getAzureDevOpsConfig(); // Get config (includes pat)
      } catch (err) {
        return { content: [{ type: "text", text: `Azure DevOps configuration error: ${(err as Error).message}. Please ensure AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables are set.` }] };
      }
      const { organization, projectName, pat } = config; // Destructure pat

      // Adjust default for areaPath and iterationPath if they are "Health" and projectName is available
      const effectiveAreaPath = (areaPath === "Health" && projectName) ? projectName : areaPath;
      const effectiveIterationPath = (iterationPath === "Health" && projectName) ? projectName : iterationPath;

      const apiUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/$Test%20Case?api-version=7.1-preview.3`;
        
      const formattedStepsXml = formatStepsToAzdoXml(steps);

      const requestBody: any[] = [
        {
          "op": "add",
          "path": "/fields/System.Title",
          "value": jiraWorkItemId.length > 0 ? `${jiraWorkItemId} - ${title}` : title
        },
        {
          "op": "add",
          "path": "/fields/System.AreaPath",
          "value": effectiveAreaPath // Use effectiveAreaPath
        },
        {
          "op": "add",
          "path": "/fields/System.IterationPath",
          "value": effectiveIterationPath // Use effectiveIterationPath
        },
        {
          "op": "add",
          "path": "/fields/Microsoft.VSTS.TCM.Steps",
          "value": formattedStepsXml
        },
        {
          "op": "add",
          "path": "/fields/Microsoft.VSTS.Common.Priority",
          "value": priority
        },
        {
          "op": "add",
          "path": "/fields/System.State",
          "value": state
        },
        {
          "op": "add",
          "path": "/fields/System.Reason",
          "value": reason
        },
        {
          "op": "add",
          "path": "/fields/Microsoft.VSTS.TCM.AutomationStatus",
          "value": automationStatus
        }
      ];

      if (assignedTo) {
        requestBody.push({
          "op": "add",
          "path": "/fields/System.AssignedTo",
          "value": assignedTo
        });
      }

      try {
        const response = await axios.post(apiUrl, requestBody, {
          headers: {
            'Authorization': `Bearer ${pat}`, // Use pat from config
            'Content-Type': 'application/json-patch+json'
          }
        });        const createdTestCaseId = response.data.id;
        let messageParts: string[] = [];

        messageParts.push(`Test Case ${createdTestCaseId} created successfully.`);
        const testCaseUrl = response.data._links?.html?.href;
        if (testCaseUrl) {
            messageParts.push(`View at: ${testCaseUrl}.`);
        }

        // If JIRA work item ID is provided, add link to JIRA and update test case description
        if (jiraWorkItemId && testCaseUrl) {
            try {
                // First update the test case description with a Jira link
                try {
                    const updateResult = await updateTestCase({ testCaseId: createdTestCaseId, jiraKey: jiraWorkItemId });
                    messageParts.push(updateResult.success ? 
                        `Successfully updated Test Case ${createdTestCaseId} description with link to JIRA issue ${jiraWorkItemId}.` : 
                        `Warning - Failed to update Test Case ${createdTestCaseId} description: ${updateResult.message}`);
                } catch (updateError) {
                    const updateErrorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
                    messageParts.push(`Warning - Error updating Test Case ${createdTestCaseId} description: ${updateErrorMessage}`);
                }
                
                // Then add the test case link to the JIRA item (original logic)
                const jiraResult = await addItemToJIRA(jiraWorkItemId, [{
                    text: title,
                    url: testCaseUrl
                }]);
                
                messageParts.push(jiraResult.success ? 
                    `Successfully added Test Case link to JIRA issue ${jiraWorkItemId}.` : 
                    `Warning - JIRA update failed: ${jiraResult.message}`);
            } catch (jiraError) {
                const jiraErrorMessage = jiraError instanceof Error ? jiraError.message : 'Unknown error';
                messageParts.push(`Warning - Failed to link with JIRA issue ${jiraWorkItemId}: ${jiraErrorMessage}`);
            }
        }        // Logic for handling test suite creation and adding the test case to the appropriate suite
        if (parentPlanId && parentPlanId !== 0 && parentSuiteId && parentSuiteId !== 0) {
          let suiteOperationMessage = "";
          
          // Check if we should create a child test suite or add directly to parent suite
          if (createTestSuite) {
            // Create a child suite and add the test case to it
            let newlyCreatedChildSuiteId: number | undefined;
            const childSuiteName = title; 

            try {
              newlyCreatedChildSuiteId = await getOrCreateStaticTestSuite({
                planId: parentPlanId,
                parentSuiteId: parentSuiteId, 
                suiteName: childSuiteName,
              });
              suiteOperationMessage = `Child suite '${childSuiteName}' (ID: ${newlyCreatedChildSuiteId}) ensured under parent suite ${parentSuiteId}.`;

              if (newlyCreatedChildSuiteId) {
                try {
                  // Add the created test case to the NEWLY CREATED CHILD suite
                  const addChildTcToSuiteUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/test/Plans/${parentPlanId}/Suites/${newlyCreatedChildSuiteId}/testcases/${createdTestCaseId}?api-version=7.0`;

                  const addChildTcToSuiteBody = [{ id: createdTestCaseId.toString() }];
                  await axios.post(addChildTcToSuiteUrl, addChildTcToSuiteBody, {
                    headers: {
                      'Authorization': `Bearer ${pat}`,
                      'Content-Type': 'application/json'
                    }
                  });
                  suiteOperationMessage += ` Test case ${createdTestCaseId} added to child suite ${newlyCreatedChildSuiteId}.`;
                } catch (addChildError) {
                  const addChildErrorMessage = addChildError instanceof Error ? addChildError.message : 'Unknown error';
                  suiteOperationMessage += ` Failed to add test case ${createdTestCaseId} to child suite ${newlyCreatedChildSuiteId}: ${addChildErrorMessage}.`;
                }
              }
            } catch (suiteError) {
              const suiteErrorMessage = suiteError instanceof Error ? suiteError.message : 'Unknown error';
              suiteOperationMessage = `Failed to create/retrieve child suite '${childSuiteName}' under parent suite ${parentSuiteId}: ${suiteErrorMessage}. Test case ${createdTestCaseId} not added to any new child suite.`;
            }
          } else {
            // Add the test case directly to the parent suite
            try {
              const addToParentSuiteUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/test/Plans/${parentPlanId}/Suites/${parentSuiteId}/testcases/${createdTestCaseId}?api-version=7.0`;
              
              const addToParentSuiteBody = [{ id: createdTestCaseId.toString() }];
              await axios.post(addToParentSuiteUrl, addToParentSuiteBody, {
                headers: {
                  'Authorization': `Bearer ${pat}`,
                  'Content-Type': 'application/json'
                }
              });
              suiteOperationMessage = `Test case ${createdTestCaseId} added directly to parent suite ${parentSuiteId}.`;
            } catch (addParentError) {
              const addParentErrorMessage = addParentError instanceof Error ? addParentError.message : 'Unknown error';
              suiteOperationMessage = `Failed to add test case ${createdTestCaseId} to parent suite ${parentSuiteId}: ${addParentErrorMessage}.`;
            }
          }
          
          if (suiteOperationMessage) {
            messageParts.push(suiteOperationMessage);
          }
        }
        
        return {
          content: [{ 
            type: "text", 
            text: messageParts.join(' ')
          }]
        };
      } catch (error) {
        console.error('Error creating test case in Azure DevOps:', error);
        // Check if the error is due to config issues from a deeper call
        if ((error as Error).message.includes('Azure DevOps configuration error') || (error as Error).message.includes('AZDO_PAT')) {
            return { content: [{ type: "text", text: (error as Error).message }] };
        }
        return {
          content: [{ 
            type: "text", 
            text: `Error creating test case: ${error instanceof Error ? error.message : 'Unknown error'}. Ensure AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables are correctly set.` // Enhanced error message
          }]
        };
      }
    }
);
}

/**
 * Registers the 'update-automated-test' tool with the MCP server.
 * This tool updates an existing Azure DevOps Test Case work item with automated test details.
 * Requires AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables to be set.
 */
export function updateAutomatedTestTool(server: McpServer) { // Renamed function
  server.tool(
    "update-automated-test",
    "Updates an Azure DevOps Test Case with automated test details (e.g., linking to an automated test method and assembly). Requires AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables to be set.", // Updated description
    UpdateAutomatedTestSchema.shape, 
    async (params: z.infer<typeof UpdateAutomatedTestSchema>) => { 
      try {
        // Config (org, project, pat) is sourced within updateAutomatedTest via getAzureDevOpsConfig
        const result = await updateAutomatedTest(params); 

        if (result.success) {
          let message = result.message;
          if (result.data?._links?.html?.href) {
            message += ` View at: ${result.data._links.html.href}`;
          }
          return { content: [{ type: "text", text: message }] };
        } else {
          return { content: [{ type: "text", text: `Error: ${result.message}${result.errorDetails ? ' Details: ' + JSON.stringify(result.errorDetails) : ''}` }] };
        }
      } catch (error) {
        console.error('Error in update-automated-test tool:', error);
        // Check if the error is due to config issues from a deeper call
        if ((error as Error).message.includes('Azure DevOps configuration error') || (error as Error).message.includes('AZDO_PAT')) {
            return { content: [{ type: "text", text: (error as Error).message }] };
        }
        return {
          content: [{ 
            type: "text", 
            text: `Unhandled error in update-automated-test tool: ${error instanceof Error ? error.message : 'Unknown error'}. Ensure AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables are correctly set.` // Enhanced error message
          }]
        };
      }
    }
  );
}

export function copyTestCasesToTestSuiteTool(server: McpServer) {
  server.tool(
    "copy-testcases-to-testsuite",
    "Copies all test cases from a specified source test suite to a new test suite (created with the same name as the source suite) under a specified destination test plan and parent suite. Requires AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables to be set.",
    {
      sourcePlanId: z.number().describe("ID of the source Test Plan containing the suite from which to copy test cases."),
      sourceSuiteId: z.number().describe("ID of the source Test Suite from which to copy test cases."),
      destinationPlanId: z.number().describe("ID of the destination Test Plan where the new suite will be created."),
      destinationSuiteId: z.number().describe("ID of the parent Test Suite in the destination plan under which the new suite (containing copied test cases) will be created."),
      jiraWorkItemId: z.string().optional().describe("Optional. The JIRA issue ID to link the copied test cases to."),
      createCopy: z.boolean().optional().default(true).describe("Optional. When true, creates new copies of the test cases instead of references."),
      createTestSuite: z.boolean().optional().default(true).describe("Optional. When false, the test case will be added directly to the parentSuiteId instead of creating a new child suite. Default is true.")
    },
    async ({ sourcePlanId, sourceSuiteId, destinationPlanId, destinationSuiteId, jiraWorkItemId, createCopy, createTestSuite }) => {
      try {
        // Validate JIRA ID format if provided
        // isValidJiraId is defined later in the file, this should be fine at runtime
        if (jiraWorkItemId && !isValidJiraId(jiraWorkItemId)) {
          return {
            content: [{ 
              type: "text", 
              text: `Invalid JIRA issue ID format: ${jiraWorkItemId}. Expected format is like PROJECT-123.`
            }]
          };
        }

        const { organization, projectName, pat } = await getAzureDevOpsConfig();
        
        let sourceTestCaseIds: string[] = [];

        // Fetch test cases from source suite
        try {
          const getTestCasesUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/test/Plans/${sourcePlanId}/Suites/${sourceSuiteId}/testcases?api-version=7.0`;
          console.log(`Fetching test cases from URL: ${getTestCasesUrl}`);

          const response = await axios.get(getTestCasesUrl, {
            headers: {
              'Authorization': `Bearer ${pat}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.data && response.data.value && response.data.value.length > 0) {
            sourceTestCaseIds = response.data.value.map((item: any) => item.testCase.id.toString());
            console.log(`Found ${sourceTestCaseIds.length} test case(s) in source suite ${sourceSuiteId}.`);
          } else {
            console.log(`No test cases found in source suite ${sourceSuiteId}.`);
            return {
              content: [{ type: "text", text: `No test cases found in source suite ${sourceSuiteId} (Plan: ${sourcePlanId}). No test cases will be copied.` }]
            };
          }
        } catch (error) {
          console.error(`Error fetching test cases from source suite ${sourceSuiteId}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const azdoErrorDetail = (error as any).response?.data?.message ? `Azure DevOps Error: ${(error as any).response.data.message}` : '';
          return { 
            content: [{ type: "text", text: `Error fetching test cases from source suite ${sourceSuiteId} (Plan: ${sourcePlanId}): ${errorMessage}. ${azdoErrorDetail}`.trim() }] 
          };
        }

        if (sourceTestCaseIds.length === 0) {
          return {
            content: [{ type: "text", text: `No test cases found in source suite ${sourceSuiteId} (Plan: ${sourcePlanId}). No test cases were copied.` }]
          };
        }

        // Fetch Source Suite Name
        let sourceSuiteName = '';
        try {
          const getSourceSuiteDetailsUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/testplan/Plans/${sourcePlanId}/Suites/${sourceSuiteId}?api-version=7.0`;
          console.log(`Fetching source suite details from URL: ${getSourceSuiteDetailsUrl}`);
          const suiteDetailsResponse = await axios.get(getSourceSuiteDetailsUrl, {
            headers: {
              'Authorization': `Bearer ${pat}`,
              'Content-Type': 'application/json'
            }
          });
          if (suiteDetailsResponse.data && suiteDetailsResponse.data.name) {
            sourceSuiteName = suiteDetailsResponse.data.name;
            console.log(`Source suite name: '${sourceSuiteName}'`);
          } else {
            throw new Error("Source suite name could not be retrieved from API response.");
          }
        } catch (error) {
          console.error(`Error fetching details for source suite ${sourceSuiteId}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const azdoErrorDetail = (error as any).response?.data?.message ? `Azure DevOps Error: ${(error as any).response.data.message}` : '';
          return {
            content: [{ type: "text", text: `Error fetching details for source suite ${sourceSuiteId} (Plan: ${sourcePlanId}): ${errorMessage}. ${azdoErrorDetail}`.trim() }]
          };
        }        // Determine target suite ID based on createTestSuite parameter
        let targetSuiteId: number;
        let suiteOperationMessage: string = '';
        
        if (createTestSuite) {
          // Create/Get Child Destination Test Suite with source suite name
          try {
            console.log(`Attempting to create/get destination suite with name '${sourceSuiteName}' under parent suite ${destinationSuiteId} in plan ${destinationPlanId}.`);
            targetSuiteId = await getOrCreateStaticTestSuite({
              planId: destinationPlanId,
              parentSuiteId: destinationSuiteId,
              suiteName: sourceSuiteName
            });
            console.log(`Ensured destination suite '${sourceSuiteName}' (ID: ${targetSuiteId}) exists.`);
            suiteOperationMessage = `New/existing suite '${sourceSuiteName}' (ID: ${targetSuiteId}) under parent ${destinationSuiteId}`;
          } catch (error) {
            console.error(`Error creating/finding destination suite '${sourceSuiteName}':`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
              content: [{ type: "text", text: `Error creating or finding destination suite '${sourceSuiteName}' under parent ${destinationSuiteId} in plan ${destinationPlanId}: ${errorMessage}` }]
            };
          }
        } else {
          // Use destination suite ID directly
          targetSuiteId = destinationSuiteId;
          console.log(`Using destination suite ${destinationSuiteId} directly as target (createTestSuite=false)`);
          suiteOperationMessage = `Parent suite (ID: ${targetSuiteId})`;
        }

        // Add Test Cases to Target Suite and handle JIRA integration
        try {
          const addResult = await addTestCasesToSuiteAPI({
            organization,
            projectName,
            pat,
            planId: destinationPlanId,
            suiteId: targetSuiteId,
            testCaseIds: sourceTestCaseIds.join(','),
            createCopy            
          });
            if (addResult.success) {
            const successMessage = `Successfully copied ${sourceTestCaseIds.length} test case(s) from source suite '${sourceSuiteName}' (ID: ${sourceSuiteId}, Plan: ${sourcePlanId}) to ${createTestSuite ? `new/existing suite '${sourceSuiteName}'` : `parent suite`} (ID: ${targetSuiteId}, Plan: ${destinationPlanId}). Test Case IDs: ${sourceTestCaseIds.join(', ')}. API Response: ${addResult.message}`;
            console.log(successMessage);

            // Handle JIRA integration if workItemId is provided
            if (jiraWorkItemId) {
              return handleJiraIntegrationForCopiedTestCases(
                jiraWorkItemId,
                sourceTestCaseIds,
                organization,
                projectName,
                pat,
                successMessage
              );
            }

            return { content: [{ type: "text", text: successMessage }] };
          } else {            return {
              content: [{ type: "text", text: `Error during copy operation after creating suite. Failed to add test cases to ${createTestSuite ? `destination suite '${sourceSuiteName}'` : `parent suite`} (ID: ${targetSuiteId}): ${addResult.message}` }]
            };
          }        } catch (error) {
          console.error(`Unexpected error in Step 5 when trying to add test cases to ${createTestSuite ? `destination suite` : `parent suite`} ${targetSuiteId}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            content: [{ type: "text", text: `Unexpected error adding test cases to ${createTestSuite ? `destination suite '${sourceSuiteName}'` : `parent suite`} (ID: ${targetSuiteId}): ${errorMessage}` }]
          };
        }

      } catch (err) {
        if (err instanceof Error && (err.message.includes('Azure DevOps configuration error') || err.message.includes('AZDO_ORG') || err.message.includes('AZDO_PROJECT') || err.message.includes('AZDO_PAT'))) {
          return { content: [{ type: "text", text: `Azure DevOps configuration error: ${err.message}` }] };
        }
        return { content: [{ type: "text", text: `An unexpected error occurred: ${(err as Error).message}` }] };
      }
    }
  );
}

/**
 * Creates a new copy of a test case based on an existing one and adds it to a test suite.
 * @param options - Configuration options for copying the test case
 * @returns A promise that resolves to the ID of the newly created test case
 */
async function copyTestCaseAndAddToSuite(options: {
  organization: string;
  projectName: string;
  pat: string;
  sourceTestCaseId: string | number;
  planId: number;
  suiteId: number;
}): Promise<{ success: boolean; newTestCaseId?: number; message: string; data?: any; errorDetails?: any }> {
  const { organization, projectName, pat, sourceTestCaseId, planId, suiteId } = options;

  try {
    // Step 1: Get source test case details
    console.log(`Fetching details for source test case ${sourceTestCaseId}...`);
    const sourceTestCaseDetails = await getTestCaseDetails(sourceTestCaseId, { organization, projectName, pat });
    
    if (!sourceTestCaseDetails || !sourceTestCaseDetails.fields) {
      return { 
        success: false, 
        message: `Failed to retrieve details for source test case ${sourceTestCaseId}.` 
      };
    }

    // Step 2: Create a new test case with the same field values
    const apiUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/$Test%20Case?api-version=7.2-preview.3`;
    
    const requestBody: any[] = [];
    
    // Add all relevant fields from the source test case
    const fields = sourceTestCaseDetails.fields;

    // Common fields to copy
    const fieldsToCopy = [
      'System.Title',
      'System.AreaPath',
      'System.IterationPath',
      'Microsoft.VSTS.TCM.Steps',
      'Microsoft.VSTS.Common.Priority',
      'Microsoft.VSTS.TCM.AutomationStatus',
      'Microsoft.VSTS.TCM.AutomatedTestName',
      'Microsoft.VSTS.TCM.AutomatedTestStorage',
      'Microsoft.VSTS.TCM.AutomatedTestId',
      'Microsoft.VSTS.TCM.AutomatedTestType',
      "System.Description"
    ];
    
    for (const field of fieldsToCopy) {
      if (fields[field]) {
        requestBody.push({
          "op": "add",
          "path": `/fields/${field}`,
          "value": fields[field]
        });
      }      
    }

    // Create the new test case
    console.log(`Creating new test case as a copy of ${sourceTestCaseId}...`);
    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json-patch+json'
      }
    });
    
    const newTestCaseId = response.data.id;
    
    if (!newTestCaseId) {
      return { 
        success: false,
        message: `Failed to create copy of test case ${sourceTestCaseId}.`,
        data: response.data
      };
    }
    
    // Step 3: Add the new test case to the specified suite
    console.log(`Adding newly created test case ${newTestCaseId} to suite ${suiteId}...`);
    const addToSuiteUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/test/Plans/${planId}/Suites/${suiteId}/testcases/${newTestCaseId}?api-version=7.2-preview.3`;
    
    const addToSuiteResponse = await axios.post(addToSuiteUrl, null, {
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json' 
      }
    });
    
    return {
      success: true,
      newTestCaseId,
      message: `Successfully created test case ${newTestCaseId} as a copy of ${sourceTestCaseId} and added it to suite ${suiteId}.`,
      data: { createResponse: response.data, addToSuiteResponse: addToSuiteResponse.data }
    };
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    const azdoErrorDetail = error.response?.data?.message || '';
    const fullErrorMessage = `Failed to copy test case ${sourceTestCaseId} and add to suite ${suiteId}: ${errorMessage}. ${azdoErrorDetail}`.trim();
    console.error(fullErrorMessage, error.response?.data);
    return {
      success: false,
      message: fullErrorMessage,
      errorDetails: error.response?.data
    };
  }
}

/**
 * Constructs the URL for an Azure DevOps test case.
 * The URL will include the test case title if provided for better readability.
 * @param testCaseId - The ID of the test case
 * @param testCaseTitle - Optional title of the test case for better formatted URLs
 * @returns The full URL to the test case in Azure DevOps web interface
 * @throws Error if Azure DevOps configuration is not available
 */
export async function constructAzDoTestCaseUrl(testCaseId: number | string, testCaseTitle?: string): Promise<string> {
  const config = await getAzureDevOpsConfig();
  const urlTitle = testCaseTitle 
    ? encodeURIComponent(testCaseTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    : '';
  
  // For test cases, use the _testCase endpoint for a better view
  return `https://dev.azure.com/${config.organization}/${config.projectName}/_testCase/${testCaseId}${urlTitle ? '?title=' + urlTitle : ''}`;
}

/**
 * Validates a JIRA issue ID/key format.
 * Valid formats: PROJECT-123, PROJ-1, ABC_DEF-789
 * @param jiraId - The JIRA issue ID or key to validate
 * @returns boolean indicating if the ID matches the expected format
 * @example
 * isValidJiraId("ABC-123") // returns true
 * isValidJiraId("ABC_DEF-789") // returns true
 * isValidJiraId("123-ABC") // returns false
 */
export function isValidJiraId(jiraId: string): boolean {
  if (!jiraId || typeof jiraId !== 'string') return false;
  
  // Match common JIRA ID patterns like "PROJECT-123", "ABC-1", "ABC_DEF-789"
  const jiraIdPattern = /^[A-Z][A-Z0-9_]*-[0-9]+$/;
  return jiraIdPattern.test(jiraId);
}

/**
 * Fetches test case details from Azure DevOps API
 * @param testCaseId - The ID of the test case to fetch
 * @param config - Azure DevOps configuration containing organization, project, and PAT
 * @returns Object containing test case details including title and URL
 */
async function getTestCaseDetails(testCaseId: string | number, config: { organization: string; projectName: string; pat: string }) {
  const testCaseDetailsUrl = `https://dev.azure.com/${config.organization}/${config.projectName}/_apis/wit/workitems/${testCaseId}?api-version=7.2-preview.3`;
  
  try {
    const response = await axios.get(testCaseDetailsUrl, {
      headers: {
        'Authorization': `Bearer ${config.pat}`,
        'Content-Type': 'application/json'
      }
    });

    const testCaseTitle = response.data.fields['System.Title'] || `Test Case ${testCaseId}`;
    const testCaseUrl = await constructAzDoTestCaseUrl(testCaseId, testCaseTitle);
    
    return {
      id: testCaseId,
      title: testCaseTitle,
      url: testCaseUrl,
      fields: response.data.fields
    };
  } catch (error) {
    console.warn(`Could not fetch details for test case ${testCaseId}, using ID as title`);
    const testCaseUrl = await constructAzDoTestCaseUrl(testCaseId);
    return {
      id: testCaseId,
      title: `Test Case ${testCaseId}`,
      url: testCaseUrl,
      fields: {}
    };
  }
}

/**
 * @description Updates an existing Azure DevOps Test Case work item's System.Description field with a link to a Jira issue.
 * @param options The options for updating the test case.
 * @param options.testCaseId The ID of the Test Case work item to update.
 * @param options.jiraKey The Jira issue key to link (e.g., 'CDH-123').
 * @returns A promise that resolves to an object indicating success or failure, along with response data or error details.
 */
export async function updateTestCase(options: {
  testCaseId: number;
  jiraKey: string;
}): Promise<{ success: boolean; message: string; data?: any; errorDetails?: any }> {
  const { testCaseId, jiraKey } = options;

  let config;
  try {
    config = await getAzureDevOpsConfig();
  } catch (err) {
    return { success: false, message: `Azure DevOps configuration error: ${(err as Error).message}. Please ensure AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables are set.` };
  }
  const { organization, projectName, pat } = config;

  const apiUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/${testCaseId}?api-version=7.1-preview.3`;

  // Create the description HTML with link to Jira
  const descriptionHtml = `<div><span style="font-size:17px;display:inline !important;"><a href="https://wexinc.atlassian.net/browse/${jiraKey}">https://wexinc.atlassian.net/browse/${jiraKey}</a></span><br> </div>`;

  const requestBody = [
    { "op": "add", "path": "/fields/System.Description", "value": descriptionHtml }
  ];

  try {
    console.log(`Attempting to update test case ${testCaseId} with Jira link to ${jiraKey}. URL: ${apiUrl}`);
    const response = await axios.patch(apiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${pat}`, // Use pat from config
        'Content-Type': 'application/json-patch+json'
      }
    });

    if (response.status === 200) {
      console.log(`Test case ${testCaseId} description updated successfully. Data:`, response.data);
      return { success: true, message: `Test case ${testCaseId} description updated successfully with link to JIRA issue ${jiraKey}.`, data: response.data };
    } else {
      // This case might not be hit if axios throws for non-2xx statuses.
      console.warn(`Update for test case ${testCaseId} returned status ${response.status}`, response.data);
      return { success: false, message: `Test case ${testCaseId} update returned status ${response.status}`, data: response.data };
    }
  } catch (error: any) {
    console.error(`Error updating test case ${testCaseId} with Jira link:`, error.response?.data || error.message);
    // Check if the error is due to config issues from a deeper call, though getAzureDevOpsConfig should catch it earlier
    if ((error as Error).message.includes('Azure DevOps configuration error')) {
        return { success: false, message: (error as Error).message };
    }
    return {
      success: false,
      message: `Error updating test case ${testCaseId}: ${error.message}`,
      errorDetails: error.response?.data
    };
  }
}

export function addTestcasesToJIRATool(server: McpServer) {
  server.tool(
    "add-testcase-jira",
    "Associate AZDO test cases to JIRA and update AZDO test cases description with JIRA workitem",
    {
      testCaseIdString: z.string().describe("Comma-separated string of AZDO Test Case IDs."),
      jiraWorkItemId: z.string().describe("The JIRA issue ID to link the test cases to."),
    },
    async ({ testCaseIdString, jiraWorkItemId }) => {
      let config;
      try {
        config = await getAzureDevOpsConfig();
      } catch (err) {
        return { content: [{ type: "text", text: `Azure DevOps configuration error: ${(err as Error).message}. Please ensure AZDO_ORG, AZDO_PROJECT, and AZDO_PAT environment variables are set.` }] };
      }
      const { organization, projectName, pat } = config;

      if (!isValidJiraId(jiraWorkItemId)) {
        return {
          content: [{ 
            type: "text", 
            text: `Invalid JIRA issue ID format: ${jiraWorkItemId}. Expected format is like PROJECT-123.`
          }]
        };
      }

      const trimmedTestCaseIdString = testCaseIdString.trim();
      if (!trimmedTestCaseIdString) {
        return { content: [{ type: "text", text: "No valid test case IDs provided in the string." }] };
      }
      const testCaseIds = trimmedTestCaseIdString.split(',');

      // Use the existing helper function for JIRA integration
      // Provide an initial message for the context of this specific tool
      const initialMessage = `Attempting to associate Test Case(s) ${testCaseIds.join(", ")} with JIRA issue ${jiraWorkItemId} and update their descriptions.`;
      return handleJiraIntegrationForCopiedTestCases(
        jiraWorkItemId,
        testCaseIds,
        organization,
        projectName,
        pat,
        initialMessage
      );
    }
  );
}

/**
 * Handles JIRA integration for copied test cases.
 * Updates test case descriptions with JIRA links and adds links to the JIRA issue.
 */
async function handleJiraIntegrationForCopiedTestCases(
  jiraWorkItemId: string,
  sourceTestCaseIds: string[],
  organization: string,
  projectName: string,
  pat: string,
  successMessage: string
): Promise<{ content: { type: "text"; text: string }[] }> {
  // First update each test case description with a Jira link
  let updateMessages: string[] = [];
  for (const tcId of sourceTestCaseIds) {
    const numericTcId = parseInt(tcId, 10);
    if (isNaN(numericTcId)) {
      updateMessages.push(`Warning - Invalid Test Case ID format: ${tcId}. Skipping JIRA link in description.`);
      continue;
    }
    try {
      const updateResult = await updateTestCase({ testCaseId: numericTcId, jiraKey: jiraWorkItemId });
      if (!updateResult.success) {
        updateMessages.push(`Warning - Failed to update Test Case ${tcId} description: ${updateResult.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateMessages.push(`Warning - Error updating Test Case ${tcId} description: ${errorMessage}`);
    }
  }

  // Then fetch test case details and add links to JIRA (original logic)
  try {
    // Create JIRALinks for each test case using the helper function
    const testCaseLinks = await Promise.all(sourceTestCaseIds.map(async (tcId) => {
      const details = await getTestCaseDetails(tcId, { organization, projectName, pat });
      return {
        text: details.title,
        url: details.url
      };
    }));

    const jiraResult = await addItemToJIRA(jiraWorkItemId, testCaseLinks);
    
    return {
      content: [{
        type: "text",
        text: `${successMessage} ${updateMessages.join(' ')} ${jiraResult.success ? jiraResult.message : `Warning - JIRA update failed: ${jiraResult.message}`}`
      }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{
        type: "text",
        text: `${successMessage} ${updateMessages.join(' ')} Warning - Failed to add links to JIRA issue ${jiraWorkItemId}: ${errorMessage}`
      }]
    };
  }
}
