export function validateEnvironmentVariables(
  selectedAgent: string = 'claude',
  githubToken?: string | null,
  apiKeys?: {
    OPENAI_API_KEY?: string
    GEMINI_API_KEY?: string
    CURSOR_API_KEY?: string
    ANTHROPIC_API_KEY?: string
    OPENROUTER_API_KEY?: string
  },
) {
  const errors: string[] = []

  // Check for required API keys based on selected agent
  // Each agent has different API key requirements

  if (selectedAgent === 'claude') {
    // Claude uses OpenRouter as an Anthropic-compatible API
    const hasOpenRouter = apiKeys?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
    if (!hasOpenRouter) {
      errors.push('OPENROUTER_API_KEY is required for Claude CLI. Please add your API key in your profile.')
    }
  }

  if (selectedAgent === 'codex') {
    // Codex uses OpenRouter
    const hasOpenRouter = apiKeys?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
    if (!hasOpenRouter) {
      errors.push('OPENROUTER_API_KEY is required for Codex CLI. Please add your API key in your profile.')
    }
  }

  if (selectedAgent === 'gemini') {
    // Gemini CLI requires native GEMINI_API_KEY (does not work with OpenRouter)
    const hasGemini = apiKeys?.GEMINI_API_KEY || process.env.GEMINI_API_KEY
    if (!hasGemini) {
      errors.push('GEMINI_API_KEY is required for Gemini CLI. Please add your API key in your profile.')
    }
  }

  if (selectedAgent === 'cursor') {
    // Cursor requires its own API key
    const hasCursor = apiKeys?.CURSOR_API_KEY || process.env.CURSOR_API_KEY
    if (!hasCursor) {
      errors.push('CURSOR_API_KEY is required for Cursor CLI. Please add your API key in your profile.')
    }
  }

  if (selectedAgent === 'opencode') {
    // OpenCode can use either OpenRouter (for GPT/Claude models) or Anthropic directly
    const hasOpenRouter = apiKeys?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
    const hasAnthropic = apiKeys?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!hasOpenRouter && !hasAnthropic) {
      errors.push(
        'Either OPENROUTER_API_KEY or ANTHROPIC_API_KEY is required for OpenCode CLI. Please add at least one API key in your profile.',
      )
    }
  }

  // Note: Copilot uses GitHub token for authentication, no separate API key needed

  // Check for GitHub token for private repositories
  // Use user's token if provided
  if (!githubToken) {
    errors.push('GitHub is required for repository access. Please connect your GitHub account.')
  }

  // Check for Vercel sandbox environment variables
  if (!process.env.VERCEL_TEAM_ID) {
    errors.push('VERCEL_TEAM_ID is required for sandbox creation')
  }

  if (!process.env.VERCEL_PROJECT_ID) {
    errors.push('VERCEL_PROJECT_ID is required for sandbox creation')
  }

  if (!process.env.VERCEL_TOKEN) {
    errors.push('VERCEL_TOKEN is required for sandbox creation')
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join(', ') : undefined,
  }
}

export function createAuthenticatedRepoUrl(repoUrl: string, githubToken?: string | null): string {
  if (!githubToken) {
    return repoUrl
  }

  try {
    const url = new URL(repoUrl)
    if (url.hostname === 'github.com') {
      // Add GitHub token for authentication
      url.username = githubToken
      url.password = 'x-oauth-basic'
    }
    return url.toString()
  } catch {
    // Failed to parse repository URL
    return repoUrl
  }
}

export function createSandboxConfiguration(config: {
  repoUrl: string
  timeout?: string
  ports?: number[]
  runtime?: string
  resources?: { vcpus?: number }
  branchName?: string
}) {
  return {
    template: 'node',
    git: {
      url: config.repoUrl,
      branch: config.branchName || 'main',
    },
    timeout: config.timeout || '20m',
    ports: config.ports || [3000],
    runtime: config.runtime || 'node22',
    resources: config.resources || { vcpus: 4 },
  }
}
