import { z } from "zod";
import axios from 'axios';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
      projectName: z.string().optional().default("Health").describe("The name of the Azure DevOps project. Defaults to 'Health'."),
      areaPath: z.string().optional().default("Health").describe("The Area Path for the test case (e.g., 'MyProject\\Area\\Feature')."),
      iterationPath: z.string().optional().default("Health").describe("The Iteration Path for the test case (e.g., 'MyProject\\Sprint 1')."),
      steps: z.string().optional().default("").describe("Multi-line natural language string describing test steps. Each line can be an action or a validation. For validations, use 'Expected:' to denote the expected outcome."),
      priority: z.number().optional().default(2).describe("Priority of the test case (1=High, 2=Medium, 3=Low, 4=Very Low). Defaults to 2."),
      assignedTo: z.string().optional().describe("The unique name or email of the user to assign the test case to (e.g., 'user@example.com'). Optional."),
      state: z.string().optional().default("Design").describe("The initial state of the test case (e.g., 'Design', 'Ready'). Defaults to 'Design'."),
      reason: z.string().optional().default("New").describe("The reason for the initial state (e.g., 'New', 'Test Case created'). Defaults to 'New'."),
      automationStatus: z.string().optional().default("Not Automated").describe("The automation status of the test case (e.g., 'Not Automated', 'Automated', 'Planned'). Defaults to 'Not Automated'.")
    },
    async ({ title, projectName, areaPath, iterationPath, steps, priority, assignedTo, state, reason, automationStatus }) => {
      try {
        const apiUrl = `https://dev.azure.com/WexHealthTech/${projectName}/_apis/wit/workitems/$Test%20Case?api-version=7.1-preview.3`;
        
        const pat = process.env.AZDO_PAT;
        if (!pat) {
          throw new Error('Azure DevOps Personal Access Token not found in .env file');
        }    
        
        const formattedStepsXml = formatStepsToAzdoXml(steps);

        const requestBody = [
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
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(response.data, null, 2)
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
