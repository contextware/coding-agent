/**
 * Better Agents Guidance Utilities
 *
 * Provides guidance text for coding agents to help users set up
 * projects with the @contextware/better-agents CLI.
 */

export interface BetterAgentsConfig {
  /** Enable Better Agents initialization */
  enabled?: boolean
  /** Pre-configured goal (if provided by user) */
  goal?: string
  /** Pre-configured skills (if provided by user) */
  skills?: string
  /** LangWatch endpoint URL */
  langwatchEndpoint?: string
}

/**
 * Generates guidance text for the coding agent about Better Agents setup.
 * This guidance instructs the agent to ask the user for configuration details
 * and use the better-agents CLI to initialize the project properly.
 */
export function generateBetterAgentsGuidance(config: BetterAgentsConfig = {}): string {
  const guidance = `
## Better Agents Project Setup

You have access to the \`@contextware/better-agents\` CLI tool for initializing production-ready agent projects with proper observability and testing infrastructure.

### When to Use Better Agents

Use the better-agents CLI when the user wants to:
- Build a new AI agent or LLM-powered application
- Add observability/instrumentation to an existing project
- Set up proper testing infrastructure for agents
- Create a project with LangWatch integration

### Running the CLI (Non-Interactive Mode)

IMPORTANT: The CLI runs in interactive mode by default which will hang in automated environments. You MUST provide ALL required flags for non-interactive execution.

Required flags for non-interactive mode:
- --language: python or typescript
- --framework: agno, mastra, langgraph-py, langgraph-ts, google-adk, or vercel-ai
- --llm-provider: openai, anthropic, gemini, bedrock, openrouter, or grok
- --coding-assistant: claude-code, cursor, gemini-cli, or none
- --goal: Description of what the agent should do

Optional flags:
- --skills: Comma-separated list of skills (e.g., hubspot,slack,incident-management)

Example command (use sensible defaults based on the user request):

\`\`\`bash
better-agents init . \\
  --language typescript \\
  --framework mastra \\
  --llm-provider openrouter \\
  --coding-assistant claude-code \\
  --goal "Build a customer support chatbot"${
    config.skills
      ? ` \\
  --skills ${config.skills}`
      : ''
  }
\`\`\`

### Default Values to Use

Unless the user specifies otherwise, use these defaults:
- language: typescript (for web projects) or python (for data/ML projects)
- framework: mastra (TypeScript) or agno (Python)
- llm-provider: openrouter (already configured in this environment)
- coding-assistant: claude-code

${config.goal ? `User-provided goal: "${config.goal}"` : 'Ask the user: "What is the main goal of your agent?"'}
${config.skills ? `User-provided skills: "${config.skills}"` : ''}

### What the CLI Creates

- AGENTS.md - Development guidelines with LangWatch instrumentation
- prompts/ - Versioned prompt files
- tests/scenarios/ - End-to-end scenario tests
- tests/evaluations/ - Evaluation notebooks
- .mcp.json - MCP server configuration

After initialization, follow the guidelines in the generated AGENTS.md file.
`

  return guidance.trim()
}

/**
 * Appends Better Agents guidance to a user prompt when enabled.
 */
export function enhancePromptWithBetterAgentsGuidance(prompt: string, config: BetterAgentsConfig): string {
  if (!config.enabled) {
    return prompt
  }

  const guidance = generateBetterAgentsGuidance(config)

  return `${prompt}

---

${guidance}`
}
