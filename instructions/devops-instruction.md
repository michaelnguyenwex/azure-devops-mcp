Objective: so I need your help to create a MCP function called `create-devops` stored in `src/devops/create-devops.ts` to create Azure devops story.
Input params: userRequest: string
Ex: "create ff https://github.com/wexinc/health-cdh-employerportal/pull/192"
"remove ff https://github.com/wexinc/health-cdh-employerportal/pull/192"
"run pipeline https://github.com/wexinc/health-cdh-employerportal/pull/192"

Process:
0. Use openai api (getOpenAIConfig with model:azure-gpt-4o-mini) to parse userRequest to generate the json output:
    {
        "mode":"",
        "pr":""
    }
    For ex: "create ff https://github.com/wexinc/health-cdh-employerportal/pull/192", the output is:
    {
        "mode":"CreateFF",
        "pr":"https://github.com/wexinc/health-cdh-employerportal/pull/192"
    }
    mode can be: "CreateFF"|"RemoveFF"|"Pipeline"
1. Read the pull request url using func `getPullRequestDetails` code src\triage\githubService.ts  
2. Run `getAppNameFromPR` to get the app name 
3. Add extra logic to func `getPullRequestDetails` code src\triage\githubService.ts  to return additional data: 
    - Use openai api to pull 
        3.1 The feature flag name from the PR description or title ("Feature Flag 1: CDH500CheckNavSegmentBeforeCallApi => return CDH500CheckNavSegmentBeforeCallApi)
        3.2 The value of "Feature Deployment" (for ex "Feature Deployment: 2026.Feb (Feb)") => return {"month: "Feb", "target": "2026.Feb (Feb)", "prodDeploy": "2026.Feb"}
        3.3 Use openai to find the target date by referencing the `target` key value from 3.2 against `C:\Users\W514918\source\repos\azure-devops-mcp\src\devops\mappingDates.json` to find the date    
4. If mode = "CreateFF"    
    -  Make a POST request to Azure api (check out func `registerTestCaseTool` reference from `C:\Users\W514918\source\repos\azure-devops-mcp\src\testCaseUtils.ts`)
    - {{AppName}}: replace by output from step 2
    - {{FFName}}: replace by output from step 3.1    
    - {{Title}}: "[{Month}] Add {{FFName}} FF" - Month is from sectino 3.2
    - {{target}}: use the value from 3.3
    - {{prodDeploy}}: value of prodDeploy from 3.2
    - Here's the fields you need to fill out:

    json ```
    "System.AreaPath": "Health",
    "System.TeamProject": "Health",
    "System.IterationPath": "Health",
    "System.WorkItemType": "DevOps Story",
    "System.State": "New",
    "System.Reason": "Moved to state New",
    "System.Title": "{{Title}}",
    
    "Custom.DesiredDate": "{{target}}",
    "Custom.ImpactedEnvironments": "UAT; PROD; TRN;",
    "Custom.ProdDeployment": "{{prodDeploy}}",
    
    "System.Description": "<div><div style=\"box-sizing:border-box;display:inline !important;\">Context:&nbsp;FeatureFlags<br style=\"box-sizing:border-box;\"> </div><div style=\"box-sizing:border-box;display:inline !important;\"> </div><div style=\"box-sizing:border-box;display:inline !important;\"> </div><div style=\"box-sizing:border-box;\">Scope:&nbsp;{{AppName}} </div><div style=\"box-sizing:border-box;\">Name:<span style=\"box-sizing:border-box;\">&nbsp;</span><span style=\"box-sizing:border-box;display:inline !important;\">{{FFName}} </span> </div><div style=\"box-sizing:border-box;\"><span style=\"box-sizing:border-box;\">Value: true</span> </div> </div>",

    "System.Tags": "FeatureFlags; Scope:{{AppName}}; yContext:FeatureFlags; zKey:{{FFName}}"
    ```
5. If mode = "RemoveFF"
    -  Make a POST request to Azure api (check out func `registerTestCaseTool` reference from `C:\Users\W514918\source\repos\azure-devops-mcp\src\testCaseUtils.ts`)
    - {{AppName}}: replace by output from step 2
    - {{FFName}}: replace by output from step 3.1    
    - {{Title}}: "[{Month}] Remove {{FFName}} FF" - Month is from sectino 3.2
    - {{target}}: use the value from 3.3
    - {{prodDeploy}}: value of prodDeploy from 3.2
    - Here's the fields you need to fill out:

    json ```
    "System.AreaPath": "Health",
    "System.TeamProject": "Health",
    "System.IterationPath": "Health",
    "System.WorkItemType": "DevOps Story",
    "System.State": "New",
    "System.Reason": "Moved to state New",
    "System.Title": "{{Title}}",
    
    "Custom.DesiredDate": "{{target}}",
    "Custom.ImpactedEnvironments": "UAT; PROD; TRN;",
    "Custom.ProdDeployment": "{{prodDeploy}}",
    
    "System.Description": "<div><div style=\"box-sizing:border-box;display:inline !important;\">Context:&nbsp;Remove FeatureFlags<br style=\"box-sizing:border-box;\"> </div><div style=\"box-sizing:border-box;display:inline !important;\"> </div><div style=\"box-sizing:border-box;display:inline !important;\"> </div><div style=\"box-sizing:border-box;\">Scope:&nbsp;{{AppName}} </div><div style=\"box-sizing:border-box;\">Name:<span style=\"box-sizing:border-box;\">&nbsp;</span><span style=\"box-sizing:border-box;display:inline !important;\">{{FFName}} </span> </div></div>",

    "System.Tags": "FeatureFlags; Scope:{{AppName}}; yContext:FeatureFlags; zKey:{{FFName}}"
    ```
6. If mode = "Pipeline"
    
        -  Make a POST request to Azure api (check out func `registerTestCaseTool` reference from `C:\Users\W514918\source\repos\azure-devops-mcp\src\testCaseUtils.ts`)
    - {{AppName}}: replace by output from step 2   
    - {{Title}}: "[{Month}] [AppName] Run Pipeline" - 
        - Month is from sectino 3.2
        - AppName
    - {{target}}: use the value from 3.3
    - {{prodDeploy}}: value of prodDeploy from 3.2
    - {{pipelineName}}: pipelineName from step 2
    - {{pipelineUrl}}: return value from step 7
    - Here's the fields you need to fill out:

    json ```
    "System.AreaPath": "Health",
    "System.TeamProject": "Health",
    "System.IterationPath": "Health",
    "System.WorkItemType": "DevOps Story",
    "System.State": "New",
    "System.Reason": "Moved to state New",
    "System.Title": "{{Title}}",
    
    "Custom.DesiredDate": "{{target}}",
    "Custom.ImpactedEnvironments": "UAT; PROD; TRN;",
    "Custom.ProdDeployment": "{{prodDeploy}}",
    
    "System.Description": "<div><div style=\"box-sizing:border-box;display:inline !important;\">Context:&nbsp;Run pipeline:<br style=\"box-sizing:border-box;\"> </div><div style=\"box-sizing:border-box;display:inline !important;\">Pipeline Name: {{pipelineName}}<br style=\"box-sizing:border-box;\"> </div><div style=\"box-sizing:border-box;display:inline !important;\">Pipeline URL: {{pipelineUrl}}<br style=\"box-sizing:border-box;\"> </div></div>",

    "System.Tags": "Pipeline"
    ```
7. Get pipeline info
    - Create a func called `getPipelineInfo` in `src/devops/create-devops.ts`
        - Objective: retrieve the pipeline link 
    - Process
        - Input: pipelineName: string
        - Make a Azure GET request to https://dev.azure.com/WexHealthTech/Health/_apis/pipelines?api-version=7.2-preview.1 (check out reference from `C:\Users\W514918\source\repos\azure-devops-mcp\src\testCaseUtils.ts`)
            - It returns a list of pipeline. Here's an example: 
            ```
            {
      "_links": {
        "self": {
          "href": "https://dev.azure.com/WEXHealthTech/e1adee3b-675e-472e-bd2e-9b4d2b9f53af/_apis/pipelines/2893?revision=3"
        },
        "web": {
          "href": "https://dev.azure.com/WEXHealthTech/e1adee3b-675e-472e-bd2e-9b4d2b9f53af/_build/definition?definitionId=2893"
        }
      },
      "url": "https://dev.azure.com/WEXHealthTech/e1adee3b-675e-472e-bd2e-9b4d2b9f53af/_apis/pipelines/2893?revision=3",
      "id": 2893,
      "revision": 3,
      "name": "cdh-investmentorchestration-api-az-cd",
      "folder": "\\Azure\\CDH\\cdh-investmentorchestration-api"
    },
            ```

        - You need to extract the pipeline id from href (in this case 2893) 
        - Return a string "https://dev.azure.com/WEXHealthTech/Health/_build?definitionId=" + pipeline ID
Note:
1. Refactor the func to create DevOps 