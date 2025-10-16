# GitHub Token Setup Guide

## Option 1: Environment Variable (Recommended)
```bash
# Windows PowerShell
$env:GITHUB_TOKEN = "your_github_personal_access_token_here"

# Windows CMD
set GITHUB_TOKEN=your_github_personal_access_token_here

# Linux/Mac
export GITHUB_TOKEN=your_github_personal_access_token_here
```

## Option 2: .env File
Create a `.env` file in the project root:
```env
GITHUB_TOKEN=your_github_personal_access_token_here
```

## Creating a GitHub Personal Access Token

1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Set expiration and select scopes:
   - For **public repositories**: Select `public_repo`
   - For **private repositories**: Select `repo` (full control)
4. Click "Generate token"
5. Copy the token (you won't see it again!)

## Test the Fix
```bash
# Verify token is set
echo $GITHUB_TOKEN  # Linux/Mac
echo $env:GITHUB_TOKEN  # Windows PowerShell

# Run test with token
npm run test:triage-simple
```

You should see:
```
✅ Retrieved X commits from GitHub
✅ Identified X suspected commits
```
