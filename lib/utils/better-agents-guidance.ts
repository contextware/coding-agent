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

### How to Initialize

Before running the CLI, ask the user for the following information if not already provided:

1. **Project Goal**: What is the agent supposed to do? (e.g., "customer support chatbot", "code review assistant")
${config.goal ? `   - Already provided: "${config.goal}"` : '   - Ask: "What is the main goal of your agent?"'}

2. **Programming Language**: TypeScript or Python?
   - Ask: "Which language would you prefer - TypeScript or Python?"

3. **Agent Framework** (optional): Which framework to use?
   - Options: Agno, Mastra, LangGraph, LangChain, or none
   - Ask: "Do you have a preferred agent framework? (Agno, Mastra, LangGraph, LangChain, or none)"

4. **Skills** (optional): Any specific integrations needed?
${config.skills ? `   - Already provided: "${config.skills}"` : '   - Ask: "Do you need any specific integrations? (e.g., hubspot, slack, incident-management)"'}

5. **LangWatch API Key** (optional): For observability
   - Ask: "Do you have a LangWatch API key for observability? (Get one at https://app.langwatch.ai/authorize)"

### Running the CLI

Once you have the information, run:

\`\`\`bash
# Install the CLI if not already installed
npm install -g @contextware/better-agents

# Initialize the project
better-agents init . --goal "<goal>" --skills <skills>
\`\`\`

The CLI will create:
- \`AGENTS.md\` - Development guidelines with LangWatch instrumentation
- \`prompts/\` - Versioned prompt files
- \`tests/scenarios/\` - End-to-end scenario tests
- \`tests/evaluations/\` - Evaluation notebooks
- \`.mcp.json\` - MCP server configuration

### Important

- Always ask for the required information before running the CLI
- If the user provides partial information, ask for the missing pieces
- After initialization, follow the guidelines in the generated AGENTS.md
`

  return guidance.trim()
}

/**
 * Appends Better Agents guidance to a user prompt when enabled.
 */
export function enhancePromptWithBetterAgentsGuidance(
  prompt: string,
  config: BetterAgentsConfig
): string {
  if (!config.enabled) {
    return prompt
  }

  const guidance = generateBetterAgentsGuidance(config)

  return `${prompt}

---

${guidance}`
}
