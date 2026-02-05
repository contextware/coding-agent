import { Sandbox } from '@vercel/sandbox'
import { LogEntry } from '@/lib/db/schema'

export interface SandboxConfig {
  taskId: string
  repoUrl: string
  githubToken?: string | null
  gitAuthorName?: string
  gitAuthorEmail?: string
  apiKeys?: {
    OPENAI_API_KEY?: string
    GEMINI_API_KEY?: string
    CURSOR_API_KEY?: string
    ANTHROPIC_API_KEY?: string
    OPENROUTER_API_KEY?: string
  }
  timeout?: string
  ports?: number[]
  runtime?: string
  resources?: {
    vcpus?: number
  }
  taskPrompt?: string
  selectedAgent?: string
  selectedModel?: string
  installDependencies?: boolean
  keepAlive?: boolean
  enableBrowser?: boolean
  preDeterminedBranchName?: string
  onProgress?: (progress: number, message: string) => Promise<void>
  onCancellationCheck?: () => Promise<boolean>
  /** Initialize project with @contextware/better-agents CLI */
  initWithBetterAgents?: boolean
  /** Project goal for better-agents init (--goal flag) */
  betterAgentsGoal?: string
  /** Skills to install with better-agents (comma-separated or 'all') */
  betterAgentsSkills?: string
  /** Custom LangWatch endpoint URL for better-agents */
  betterAgentsLangWatchEndpoint?: string
}

export interface SandboxResult {
  success: boolean
  sandbox?: Sandbox
  domain?: string
  branchName?: string
  error?: string
  cancelled?: boolean
}

export interface AgentExecutionResult {
  success: boolean
  output?: string
  agentResponse?: string
  cliName?: string
  changesDetected?: boolean
  error?: string
  streamingLogs?: unknown[]
  logs?: LogEntry[]
  sessionId?: string // For Cursor agent session resumption
}
