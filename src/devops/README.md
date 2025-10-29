# Azure DevOps Story Creation from GitHub PRs

## Overview

This feature automatically generates Azure DevOps stories from GitHub Pull Request URLs for feature flags and pipeline operations. It uses AI (OpenAI) to intelligently extract information from PRs and creates properly formatted Azure DevOps work items.

## Architecture

```
User Request → Request Parser → GitHub PR Analysis → Story Builder → Azure DevOps API
                    ↓                    ↓                ↓
                OpenAI API          OpenAI API      Work Item Created
```

### Flow Diagram

1. **Request Parsing**: Natural language request is parsed to determine mode (CreateFF/RemoveFF/Pipeline) and extract PR URL
2. **PR Analysis**: GitHub PR is fetched and analyzed to extract feature flag name, deployment dates, and app name
3. **Date Mapping**: Production deployment version is mapped to UAT deploy date
4. **Story Building**: DevOps story fields are constructed based on mode
5. **Work Item Creation**: Story is created in Azure DevOps via REST API

## Files and Responsibilities

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript interfaces and types |
| `requestParser.ts` | Parses natural language user requests using OpenAI |
| `dateMapper.ts` | Maps production deployment versions to UAT dates |
| `azureDevOpsClient.ts` | Azure DevOps REST API client |
| `pipelineService.ts` | Retrieves pipeline information from Azure DevOps |
| `storyBuilders.ts` | Builds DevOps story fields for each mode |
| `create-devops.ts` | Main orchestrator that ties everything together |
| `mappingDates.json` | Date mapping configuration |

## Usage Examples

### Create Feature Flag Story

```
create ff https://github.com/WEXHealthTech/health-cdh-authservice/pull/123
```

### Remove Feature Flag Story

```
remove ff https://github.com/WEXHealthTech/health-cdh-authservice/pull/456
```

### Run Pipeline Story

```
run pipeline https://github.com/WEXHealthTech/health-cdh-authservice/pull/789
```

## Environment Setup

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AZDO_PAT` | Azure DevOps Personal Access Token | `your-pat-token` |
| `AZDO_ORG` | Azure DevOps organization name | `WexHealthTech` |
| `AZDO_PROJECT` | Azure DevOps project name | `Health` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `OPENAI_API_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` |
| `GITHUB_TOKEN` | GitHub Personal Access Token | `ghp_...` |

### Setup Instructions

1. **Azure DevOps PAT**: 
   - Go to Azure DevOps → User Settings → Personal Access Tokens
   - Create new token with Work Items (Read & Write) permissions
   - Set as `AZDO_PAT` environment variable

2. **GitHub Token**:
   - Go to GitHub → Settings → Developer Settings → Personal Access Tokens
   - Create new token with `repo` scope
   - Set as `GITHUB_TOKEN` environment variable

3. **OpenAI API**:
   - Obtain API key from OpenAI
   - Set `OPENAI_API_KEY` and `OPENAI_API_BASE_URL`

## Common Troubleshooting Scenarios

### Error: "Feature flag name not found in PR"

**Cause**: The PR description doesn't contain recognizable feature flag information.

**Solution**: Ensure the PR contains text like:
- "Feature Flag 1: CDH500-EnableNewUI"
- "Feature Flag: YOUR_FLAG_NAME"

### Error: "Deployment information not found in PR"

**Cause**: The PR doesn't contain deployment schedule information.

**Solution**: Ensure the PR contains text like:
- "Feature Deployment: 2026.Feb (Feb)"
- "Deployment: 2026.03"

### Error: "Pipeline not found"

**Cause**: The pipeline name doesn't match any pipelines in Azure DevOps.

**Solution**: 
- Check that the pipeline exists in Azure DevOps
- Verify the pipeline naming convention (usually `app-name-api-az-cd`)
- Check the logs for what pipeline name was searched

### Error: "Azure DevOps authentication failed"

**Cause**: Invalid or expired PAT token.

**Solution**:
- Verify `AZDO_PAT` environment variable is set
- Check that the PAT token has not expired
- Ensure the PAT has Work Items (Read & Write) permissions

## Story Field Mapping

### CreateFF Mode

| Field | Value |
|-------|-------|
| System.Title | `[Month] Add {FFName} FF` |
| System.Description | Context: FeatureFlags, Scope: {AppName}, Name: {FFName}, Value: true |
| System.Tags | `FeatureFlags; Scope:{AppName}; yContext:FeatureFlags; zKey:{FFName}` |
| Custom.DesiredDate | UAT deploy date from mapping |
| Custom.ProdDeployment | Production deployment version |

### RemoveFF Mode

| Field | Value |
|-------|-------|
| System.Title | `[Month] Remove {FFName} FF` |
| System.Description | Context: Remove FeatureFlags, Scope: {AppName}, Name: {FFName} |
| System.Tags | `FeatureFlags; Scope:{AppName}; yContext:FeatureFlags; zKey:{FFName}` |

### Pipeline Mode

| Field | Value |
|-------|-------|
| System.Title | `[Month] {AppName} Run Pipeline` |
| System.Description | Context: Run pipeline, Pipeline Name: {Name}, Pipeline URL: {URL} |
| System.Tags | `Pipeline` |

## Date Mapping

The `mappingDates.json` file maps production deployment versions to UAT deploy dates:

```json
{
  "2026.Feb": "2/10/2026",
  "2026.03": "3/10/2026",
  ...
}
```

This mapping is used to set the `Custom.DesiredDate` field on DevOps stories.

## Error Handling

The system includes comprehensive error handling:
- **OpenAI failures**: Graceful fallbacks with descriptive errors
- **GitHub API errors**: Handles rate limits, 404s, and authentication issues
- **Azure DevOps API errors**: Provides specific error messages based on status codes
- **Validation errors**: Clear messages about missing or invalid data

## Logging

All major operations are logged with emoji indicators:
- 🚀 Starting operations
- 📝 Processing steps
- ✅ Success messages
- ⚠️  Warnings
- ❌ Errors

Logs include:
- User requests
- API responses
- Extracted data
- Work item IDs
- Error details

## AI Integration

The feature uses OpenAI (GPT-4o-mini) for:

1. **Request Parsing**: Extracting mode and PR URL from natural language
2. **PR Analysis**: Extracting feature flag names and deployment information from PR text
3. **Pipeline Name Extraction**: Inferring pipeline names when standard patterns don't match

All OpenAI calls use:
- Temperature: 0.1 (for consistent, deterministic output)
- JSON-only output format
- Fallback logic for robustness

