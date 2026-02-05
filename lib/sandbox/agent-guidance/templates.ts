/**
 * Agent Guidance Templates
 *
 * This module provides comprehensive guidance templates for coding agents
 * that include LangWatch instrumentation, Better Agents structure,
 * and framework-specific SDK setup instructions.
 */

export interface AgentGuidanceConfig {
  /** Whether to include LangWatch instrumentation guidance */
  includeLangWatch?: boolean
  /** Whether to include Better Agents structure guidance */
  includeBetterAgentsStructure?: boolean
  /** Detected or specified programming language */
  language?: 'typescript' | 'python' | 'javascript'
  /** Detected or specified framework */
  framework?: 'nextjs' | 'express' | 'fastapi' | 'agno' | 'mastra' | 'langgraph' | 'langchain' | 'generic'
  /** User's project goal if provided */
  projectGoal?: string
  /** LangWatch API key environment variable name */
  langwatchApiKeyEnvVar?: string
}

/**
 * LangWatch instrumentation code snippets for different languages/frameworks
 */
export const langWatchInstrumentation = {
  typescript: {
    installation: `npm install langwatch`,
    envSetup: `# Add to .env
LANGWATCH_API_KEY=your-api-key`,
    basicSetup: `// Initialize LangWatch at the entry point of your app
import { LangWatch } from 'langwatch';

const langwatch = new LangWatch();

// Auto-instrument your LLM calls
langwatch.autoInstrument();`,
    nextjsSetup: `// app/api/chat/route.ts or similar API route
import { LangWatch } from 'langwatch';
import { NextResponse } from 'next/server';

const langwatch = new LangWatch();

export async function POST(request: Request) {
  const { messages } = await request.json();

  // Create a trace for this request
  const trace = langwatch.getTrace({
    metadata: { userId: 'user-123' }
  });

  // Your LLM call is automatically traced
  const response = await yourLLMCall(messages);

  return NextResponse.json(response);
}`,
    expressSetup: `// Express middleware setup
import express from 'express';
import { LangWatch } from 'langwatch';

const app = express();
const langwatch = new LangWatch();

// Use LangWatch middleware
app.use(langwatch.expressMiddleware());

// Your LLM routes are now traced
app.post('/chat', async (req, res) => {
  const response = await yourLLMCall(req.body.messages);
  res.json(response);
});`,
  },
  python: {
    installation: `pip install langwatch`,
    envSetup: `# Add to .env
LANGWATCH_API_KEY=your-api-key`,
    basicSetup: `# Initialize LangWatch
import langwatch

langwatch.init()

# Your LLM calls are now automatically traced
@langwatch.trace()
def my_agent_function():
    # Agent logic here
    pass`,
    fastApiSetup: `# FastAPI with LangWatch
from fastapi import FastAPI
import langwatch

app = FastAPI()
langwatch.init()

@app.post("/chat")
@langwatch.trace()
async def chat(messages: list):
    response = await your_llm_call(messages)
    return response`,
    langchainSetup: `# LangChain integration
import langwatch
from langchain.chat_models import ChatOpenAI

langwatch.init()

# LangWatch automatically instruments LangChain
llm = ChatOpenAI()
response = llm.predict("Hello, world!")`,
    langgraphSetup: `# LangGraph integration
import langwatch
from langgraph.graph import StateGraph

langwatch.init()

# Define your graph
graph = StateGraph(AgentState)

# LangWatch traces all graph executions
@langwatch.trace()
def run_agent(input_data):
    return graph.invoke(input_data)`,
  },
}

/**
 * Better Agents project structure guidance
 */
export const betterAgentsStructure = `## Better Agents Project Structure

When building agent applications, follow this structure for production-readiness:

\`\`\`
my-agent-project/
├── app/ (or src/)           # The actual agent code
├── tests/
│   ├── evaluations/         # Jupyter notebooks for evaluations
│   │   └── example_eval.ipynb
│   └── scenarios/           # End-to-end scenario tests
│       └── example_scenario.test.{py,ts}
├── prompts/                 # Versioned prompt files
│   └── sample_prompt.yaml
├── prompts.json             # Prompt registry
├── .mcp.json                # MCP server configuration
├── AGENTS.md                # Development guidelines
├── .env                     # Environment variables
└── .gitignore
\`\`\`

### Key Principles

1. **Scenario Tests**: Write scenario tests for every feature to ensure agent behavior
   - Use @langwatch/scenario for TypeScript
   - Use scenario-testing for Python

2. **Prompt Versioning**: Store prompts in \`prompts/\` as YAML files
   - Version control your prompts
   - Use prompts.json as a registry

3. **Evaluations**: Create evaluation notebooks in \`tests/evaluations/\`
   - Measure specific prompt performance
   - Track metrics over time

4. **Observability**: Instrument your agent with LangWatch
   - Full visibility into agent behavior
   - Track costs, latency, and quality
`

/**
 * Framework-specific SDK setup instructions
 */
export const frameworkGuidance = {
  agno: `## Agno Agent Framework

When building with Agno:

\`\`\`python
from agno import Agent, Tool
import langwatch

langwatch.init()

# Define tools
@Tool
def search_web(query: str) -> str:
    """Search the web for information."""
    # Implementation
    pass

# Create agent with tools
agent = Agent(
    model="gpt-4",
    tools=[search_web],
    system_prompt="You are a helpful assistant."
)

# Run with tracing
@langwatch.trace()
def run_agent(user_input: str):
    return agent.run(user_input)
\`\`\`
`,
  mastra: `## Mastra Agent Framework

When building with Mastra:

\`\`\`typescript
import { Agent, createTool } from '@mastra/core';
import { LangWatch } from 'langwatch';

const langwatch = new LangWatch();
langwatch.autoInstrument();

// Define tools
const searchTool = createTool({
  name: 'search',
  description: 'Search for information',
  execute: async (input) => {
    // Implementation
  }
});

// Create agent
const agent = new Agent({
  model: 'gpt-4',
  tools: [searchTool],
});

// Agent calls are automatically traced
const result = await agent.run('Hello');
\`\`\`
`,
  langgraph: `## LangGraph Agent Framework

When building with LangGraph:

\`\`\`python
from langgraph.graph import StateGraph, END
from typing import TypedDict
import langwatch

langwatch.init()

class AgentState(TypedDict):
    messages: list
    current_step: str

# Define nodes
def agent_node(state: AgentState):
    # Agent logic
    return state

def tool_node(state: AgentState):
    # Tool execution
    return state

# Build graph
graph = StateGraph(AgentState)
graph.add_node("agent", agent_node)
graph.add_node("tools", tool_node)
graph.add_edge("agent", "tools")
graph.add_edge("tools", END)

# Compile and run with tracing
app = graph.compile()

@langwatch.trace()
def run_graph(input_data):
    return app.invoke(input_data)
\`\`\`
`,
  langchain: `## LangChain Integration

When building with LangChain:

\`\`\`python
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_openai import ChatOpenAI
from langchain.tools import Tool
import langwatch

langwatch.init()

# LangWatch automatically instruments LangChain
llm = ChatOpenAI(model="gpt-4")

tools = [
    Tool(
        name="Search",
        func=search_function,
        description="Search for information"
    )
]

agent = create_openai_tools_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools)

# All agent executions are automatically traced
result = agent_executor.invoke({"input": "Hello"})
\`\`\`
`,
  generic: `## Agent Development Best Practices

1. **Instrument from the start**: Add observability early
2. **Test with scenarios**: Write tests that simulate real conversations
3. **Version your prompts**: Track changes to system prompts
4. **Monitor in production**: Use LangWatch for real-time monitoring
`,
}

/**
 * Generate comprehensive agent guidance based on configuration
 */
export function generateAgentGuidance(config: AgentGuidanceConfig): string {
  const sections: string[] = []

  // Header
  sections.push(`# Agent Development Guidelines

This document provides guidance for building production-ready agent applications.
`)

  // LangWatch instrumentation section
  if (config.includeLangWatch !== false) {
    sections.push(`## Observability with LangWatch

**IMPORTANT**: All new code that makes LLM calls MUST include LangWatch instrumentation for observability.

### Why Instrument?
- Track agent behavior and performance
- Debug issues in production
- Monitor costs and latency
- Evaluate quality over time
`)

    // Map language to instrumentation key (javascript uses typescript instrumentation)
    const langKey = config.language === 'python' ? 'python' : 'typescript'
    const langInstrumentation = langWatchInstrumentation[langKey]

    if (langInstrumentation) {
      sections.push(`### Installation

\`\`\`bash
${langInstrumentation.installation}
\`\`\`

### Environment Setup

\`\`\`bash
${langInstrumentation.envSetup}
\`\`\`

### Basic Setup

\`\`\`${langKey}
${langInstrumentation.basicSetup}
\`\`\`
`)

      // Add framework-specific setup if applicable
      if (config.framework === 'nextjs' && langKey === 'typescript') {
        const tsInstrumentation = langInstrumentation as typeof langWatchInstrumentation.typescript
        sections.push(`### Next.js Integration

\`\`\`typescript
${tsInstrumentation.nextjsSetup}
\`\`\`
`)
      } else if (config.framework === 'express' && langKey === 'typescript') {
        const tsInstrumentation = langInstrumentation as typeof langWatchInstrumentation.typescript
        sections.push(`### Express Integration

\`\`\`typescript
${tsInstrumentation.expressSetup}
\`\`\`
`)
      } else if (config.framework === 'fastapi' && langKey === 'python') {
        const pyInstrumentation = langInstrumentation as typeof langWatchInstrumentation.python
        sections.push(`### FastAPI Integration

\`\`\`python
${pyInstrumentation.fastApiSetup}
\`\`\`
`)
      }
    }
  }

  // Better Agents structure section
  if (config.includeBetterAgentsStructure !== false) {
    sections.push(betterAgentsStructure)
  }

  // Framework-specific guidance
  if (config.framework && frameworkGuidance[config.framework as keyof typeof frameworkGuidance]) {
    sections.push(frameworkGuidance[config.framework as keyof typeof frameworkGuidance])
  }

  // Project goal reminder
  if (config.projectGoal) {
    sections.push(`## Project Goal

${config.projectGoal}

Keep this goal in mind when implementing features. Ensure all code contributes to this objective.
`)
  }

  // Key reminders
  sections.push(`## Key Reminders

1. **Always instrument LLM calls** with LangWatch before committing
2. **Write scenario tests** for new agent behaviors
3. **Version prompts** in the \`prompts/\` directory
4. **Check for existing patterns** before implementing new features
5. **Follow the Better Agents structure** for maintainability
`)

  return sections.join('\n')
}

/**
 * Generate agent-specific guidance file content based on agent type
 */
export function generateAgentSpecificGuidance(
  agentType: 'claude' | 'gemini' | 'cursor' | 'codex' | 'copilot' | 'opencode',
  config: AgentGuidanceConfig = {},
): { path: string; content: string; format: 'skill' | 'agents' | 'mdc' | 'instructions' } {
  const guidance = generateAgentGuidance(config)

  switch (agentType) {
    case 'claude':
      return {
        path: '.claude/skills/better-agents/SKILL.md',
        content: `---
name: better-agents
description: Guidance for building production-ready agent applications with LangWatch instrumentation, proper testing, and observability. Use when creating new agent features, LLM integrations, or when the user asks to add observability.
---

${guidance}
`,
        format: 'skill',
      }

    case 'gemini':
      return {
        path: '.gemini/AGENTS.md',
        content: guidance,
        format: 'agents',
      }

    case 'cursor':
      return {
        path: '.cursor/rules/better-agents.mdc',
        content: `---
description: Production-ready agent development with LangWatch instrumentation
globs: ["**/*.ts", "**/*.tsx", "**/*.py", "**/*.js", "**/*.jsx"]
alwaysApply: true
---

${guidance}
`,
        format: 'mdc',
      }

    case 'codex':
      return {
        path: 'AGENTS.md',
        content: guidance,
        format: 'agents',
      }

    case 'copilot':
      return {
        path: '.github/copilot-instructions.md',
        content: guidance,
        format: 'instructions',
      }

    case 'opencode':
      return {
        path: 'AGENTS.md',
        content: guidance,
        format: 'agents',
      }
  }
}

/**
 * Detect language and framework from package.json or other indicators
 */
export function detectProjectConfig(packageJson?: {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}): Partial<AgentGuidanceConfig> {
  if (!packageJson) {
    return { language: 'typescript' }
  }

  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
  const config: Partial<AgentGuidanceConfig> = {}

  // Detect language
  if (deps['typescript'] || deps['ts-node']) {
    config.language = 'typescript'
  } else {
    config.language = 'javascript'
  }

  // Detect framework
  if (deps['next']) {
    config.framework = 'nextjs'
  } else if (deps['express']) {
    config.framework = 'express'
  } else if (deps['@mastra/core']) {
    config.framework = 'mastra'
  } else if (deps['langchain'] || deps['@langchain/core']) {
    config.framework = 'langchain'
  }

  return config
}

/**
 * Detect Python project config from requirements.txt or pyproject.toml
 */
export function detectPythonProjectConfig(requirements?: string): Partial<AgentGuidanceConfig> {
  if (!requirements) {
    return { language: 'python' }
  }

  const config: Partial<AgentGuidanceConfig> = { language: 'python' }

  if (requirements.includes('fastapi')) {
    config.framework = 'fastapi'
  } else if (requirements.includes('langgraph')) {
    config.framework = 'langgraph'
  } else if (requirements.includes('langchain')) {
    config.framework = 'langchain'
  } else if (requirements.includes('agno')) {
    config.framework = 'agno'
  }

  return config
}
