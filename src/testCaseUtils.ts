import { z } from "zod";
import axios from 'axios';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as crypto from 'crypto';
import { getAzureDevOpsConfig } from './configStore.js'; // Corrected import path

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

export function registerCreateTestCaseTool(server: McpServer) {
  server.tool(
    "create-test-case",
    "Creates a new Test Case work item in Azure DevOps. The test case is created in the 'Health' project.",
    { 
      title: z.string().describe("The title of the test case."),
      areaPath: z.string().optional().default("Health").describe("The Area Path for the test case (e.g., 'MyProject\\\\\\\\Area\\\\\\\\Feature')."),
      iterationPath: z.string().optional().default("Health").describe("The Iteration Path for the test case (e.g., 'MyProject\\\\\\\\Sprint 1')."),
      steps: z.string().optional().default("").describe("Multi-line natural language string describing test steps. Each line can be an action or a validation. For validations, use 'Expected:' to denote the expected outcome."),
      priority: z.number().optional().default(2).describe("Priority of the test case (1=High, 2=Medium, 3=Low, 4=Very Low). Defaults to 2."),
      assignedTo: z.string().optional().describe("The unique name or email of the user to assign the test case to (e.g., 'user@example.com'). Optional."),
      state: z.string().optional().default("Design").describe("The initial state of the test case (e.g., 'Design', 'Ready'). Defaults to 'Design'."),
      reason: z.string().optional().default("New").describe("The reason for the initial state (e.g., 'New', 'Test Case created'). Defaults to 'New'."),
      automationStatus: z.string().optional().default("Not Automated").describe("The automation status of the test case (e.g., 'Not Automated', 'Automated', 'Planned'). Defaults to 'Not Automated'."),
      parentPlanId: z.number().optional().describe("Optional. The ID of the Test Plan containing the parent suite. If provided with parentSuiteId, the test case will be added to this suite."),
      parentSuiteId: z.number().optional().describe("Optional. The ID of the parent Test Suite under which the test case will be added. Requires parentPlanId to be specified.")
    },
    async ({ title, areaPath, iterationPath, steps, priority, assignedTo, state, reason, automationStatus, parentPlanId, parentSuiteId }) => {
      try {
        const { organization, projectName } = await getAzureDevOpsConfig(); // Get config
        const apiUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/$Test%20Case?api-version=7.1-preview.3`;
        
        const pat = process.env.AZDO_PAT;
        if (!pat) {
          throw new Error('Azure DevOps Personal Access Token not found in .env file');
        }    
        
        const formattedStepsXml = formatStepsToAzdoXml(steps);

        const requestBody: any[] = [
          {
            "op": "add",
            "path": "/fields/System.Title",
            "value": title
          },
          {
            "op": "add",
            "path": "/fields/System.AreaPath",
            "value": areaPath
          },
          {
            "op": "add",
            "path": "/fields/System.IterationPath",
            "value": iterationPath
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

        const response = await axios.post(apiUrl, requestBody, {
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json-patch+json'
          }
        });

        const createdTestCaseId = response.data.id;
        let messageParts: string[] = [];

        messageParts.push(`Test Case ${createdTestCaseId} created successfully.`);
        if (response.data._links?.html?.href) {
            messageParts.push(`View at: ${response.data._links.html.href}.`);
        }

        // Simplified logic: if parentPlanId and parentSuiteId are provided, add test case to that suite.
        if (parentPlanId && parentPlanId !== 0 && parentSuiteId && parentSuiteId !== 0) {
          try {
            const addTcToSuiteUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/testplan/Plans/${parentPlanId}/Suites/${parentSuiteId}/testcases?api-version=7.0`;
            const addTcToSuiteBody = [{ id: createdTestCaseId.toString() }]; 
            await axios.post(addTcToSuiteUrl, addTcToSuiteBody, {
              headers: {
                'Authorization': `Bearer ${pat}`,
                'Content-Type': 'application/json'
              }
            });
            messageParts.push(`Test case added to suite ${parentSuiteId} in plan ${parentPlanId}.`);
          } catch (addError) {
            const addErrorMessage = addError instanceof Error ? addError.message : 'Unknown error';
            messageParts.push(`Failed to add test case to suite ${parentSuiteId} in plan ${parentPlanId}: ${addErrorMessage}.`);
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
        
        return {
          content: [{ 
            type: "text", 
            text: `Error creating test case: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );
}

/**
 * Finds an existing static test suite by name under a parent suite or creates it if it doesn't exist.
 * @param options - The options for finding or creating the test suite.
 * @param options.planId - The ID of the Test Plan.
 * @param options.parentSuiteId - The ID of the parent Test Suite.
 * @param options.suiteName - The name of the suite to find or create.
 * @param options.pat - The Personal Access Token for Azure DevOps.
 * @returns A Promise that resolves to the ID of the found or created test suite.
 * @throws An error if the suite cannot be found or created.
 */
async function getOrCreateStaticTestSuite(options: {
  planId: number;
  parentSuiteId: number;
  suiteName: string;
  pat: string;
}): Promise<number> {
  const { planId, parentSuiteId, suiteName, pat } = options;

  let configFromStore;
  try {
    configFromStore = await getAzureDevOpsConfig();
  } catch (err) {
    // Propagate error if config is not set, or handle as appropriate for this utility
    // This ensures that if config is missing, the function fails early and clearly.
    throw new Error(`Azure DevOps configuration not set. Please run 'register-azure-project'. Details: ${(err as Error).message}`);
  }
  const { organization, projectName } = configFromStore;

  const listSuitesUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/testplan/Plans/${planId}/Suites/${parentSuiteId}/suites?api-version=7.0`;

  try {
    // 2.3: Implement logic to find existing suite
    const listResponse = await axios.get(listSuitesUrl, {
      headers: { 'Authorization': `Bearer ${pat}` }
    });

    if (listResponse.data && listResponse.data.value) {
      const suites = listResponse.data.value;
      for (const suite of suites) {
        if (suite.name === suiteName && suite.suiteType === "StaticTestSuite") {
          console.log(`Found existing static suite '${suiteName}' with ID: ${suite.id}`);
          return suite.id;
        }
      }
    }

    // 2.4: Implement logic to create new suite if not found
    console.log(`Static suite '${suiteName}' not found under parent suite ${parentSuiteId}. Creating new suite in project '${projectName}'.`);
    const createSuiteUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/testplan/Plans/${planId}/Suites/${parentSuiteId}/suites?api-version=7.0`;
    const createSuiteBody = {
      suiteType: "StaticTestSuite",
      name: suiteName
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
    if (errorMessage.startsWith('Azure DevOps configuration not set')) {
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
 * @param options.pat The Personal Access Token for Azure DevOps.
 * @param options.automatedTestId Optional. A unique ID for the automated test. If not provided, a new GUID will be generated.
 * @param options.automatedTestType Optional. The type of the automated test. Defaults to 'Unit Test'.
 * @returns A promise that resolves to an object indicating success or failure, along with response data or error details.
 */
export async function updateAutomatedTest(options: {
  testCaseId: number;
  automatedTestName: string;
  automatedTestStorage: string;
  pat: string;
  automatedTestId?: string;
  automatedTestType?: string;
}): Promise<{ success: boolean; message: string; data?: any; errorDetails?: any }> {
  const {
    testCaseId,
    automatedTestName,
    automatedTestStorage,
    pat,
    automatedTestId,
    automatedTestType = "Unit Test",
  } = options;

  let config;
  try {
    config = await getAzureDevOpsConfig();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  const { organization, projectName } = config;

  if (!pat) {
    // This check is more for robustness, assuming pat is usually validated by the caller or a tool wrapper.
    return { success: false, message: 'Azure DevOps Personal Access Token not found.' };
  }

  const apiUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/${testCaseId}?api-version=7.1-preview.3`;

  const localAutomatedTestId = automatedTestId || crypto.randomUUID();

  const requestBody = [
    { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomatedTestName", "value": automatedTestName },
    { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomatedTestStorage", "value": automatedTestStorage },
    { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomatedTestType", "value": automatedTestType },
    { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomationStatus", "value": "Automated" },
    { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomatedTestId", "value": localAutomatedTestId }
  ];

  try {
    console.log(`Attempting to update test case ${testCaseId} with automation details. URL: ${apiUrl}`);
    const response = await axios.patch(apiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${pat}`,
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
  pat: z.string().optional().describe("The Personal Access Token for Azure DevOps. If not provided, it will attempt to use AZDO_PAT environment variable."),
  automatedTestId: z.string().optional().describe("Optional. A unique ID for the automated test. If not provided, a new GUID will be generated."),
  automatedTestType: z.string().optional().default("Unit Test").describe("Optional. The type of the automated test. Defaults to \'Unit Test\'.")
});

/**
 * Registers the 'update-automated-test' tool with the MCP server.
 * This tool updates an existing Azure DevOps Test Case work item with automated test details.
 */
export function registerUpdateAutomatedTestTool(server: McpServer) {
  server.tool(
    "update-automated-test",
    "Updates an Azure DevOps Test Case with automated test details (e.g., linking to an automated test method and assembly).",
    UpdateAutomatedTestSchema.shape, // Use .shape for the schema definition
    async (params: z.infer<typeof UpdateAutomatedTestSchema>) => { // Explicitly type params
      try {
        // Ensure PAT is available, either from params or environment
        const effectivePat = params.pat || process.env.AZDO_PAT;
        if (!effectivePat) {
          return {
            content: [{ type: "text", text: "Error: Azure DevOps Personal Access Token not provided (either in parameters or AZDO_PAT environment variable)." }]
          };
        }

        // Construct the options for updateAutomatedTest, ensuring all required fields are present
        const optionsForUpdate = {
          testCaseId: params.testCaseId,
          automatedTestName: params.automatedTestName,
          automatedTestStorage: params.automatedTestStorage,
          pat: effectivePat, // Use the resolved PAT
          automatedTestId: params.automatedTestId,
          automatedTestType: params.automatedTestType,
        };

        const result = await updateAutomatedTest(optionsForUpdate);

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
        return {
          content: [{ 
            type: "text", 
            text: `Unhandled error in update-automated-test tool: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );
}
