import { Sandbox } from '@vercel/sandbox'
import { runCommandInSandbox, runInProject, PROJECT_DIR } from '../commands'
import { AgentExecutionResult } from '../types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { TaskLogger } from '@/lib/utils/task-logger'
import { connectors } from '@/lib/db/schema'

type Connector = typeof connectors.$inferSelect

// Helper function to run command and log it in project directory
async function runAndLogCommand(sandbox: Sandbox, command: string, args: string[], logger: TaskLogger) {
  const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command
  await logger.command(redactSensitiveInfo(fullCommand))

  const result = await runInProject(sandbox, command, args)

  if (result.output && result.output.trim()) {
    await logger.info(redactSensitiveInfo(result.output.trim()))
  }

  if (!result.success && result.error) {
    await logger.error(redactSensitiveInfo(result.error))
  }

  return result
}

export async function executeCodexInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
  mcpServers?: Connector[],
  isResumed?: boolean,
  sessionId?: string,
): Promise<AgentExecutionResult> {
  try {
    // Executing Codex CLI with instruction

    // Check if Codex CLI is already installed (for resumed sandboxes)
    const existingCLICheck = await runCommandInSandbox(sandbox, 'which', ['codex'])

    let installResult: { success: boolean; output?: string; error?: string } = { success: true }

    if (existingCLICheck.success && existingCLICheck.output?.includes('codex')) {
      // CLI already installed, skip installation
      await logger.info('Codex CLI already installed, skipping installation')
    } else {
      // Install Codex CLI using npm
      // Installing Codex CLI
      await logger.info('Installing Codex CLI...')
      installResult = await runAndLogCommand(sandbox, 'npm', ['install', '-g', '@openai/codex'], logger)

      if (!installResult.success) {
        return {
          success: false,
          error: `Failed to install Codex CLI: ${installResult.error}`,
          cliName: 'codex',
          changesDetected: false,
        }
      }

      await logger.info('Codex CLI installed successfully')
    }

    // Check if Codex CLI is available
    const cliCheck = await runAndLogCommand(sandbox, 'which', ['codex'], logger)

    if (!cliCheck.success) {
      return {
        success: false,
        error: 'Codex CLI not found after installation. Please ensure it is properly installed.',
        cliName: 'codex',
        changesDetected: false,
      }
    }

    // Set up authentication - we'll use API key method since we're in a sandbox
    if (!process.env.OPENROUTER_API_KEY) {
      return {
        success: false,
        error: 'OpenRouter API key not found. Please set OPENROUTER_API_KEY environment variable.',
        cliName: 'codex',
        changesDetected: false,
      }
    }

    // Validate API key format
    const apiKey = process.env.OPENROUTER_API_KEY
    const isOpenAIKey = apiKey?.startsWith('sk-')
    const isOpenRouterKey = apiKey?.startsWith('sk-or-')

    if (!apiKey || (!isOpenAIKey && !isOpenRouterKey)) {
      const errorMsg = `Invalid API key format. Expected to start with "sk-" (OpenAI) or "sk-or-" (OpenRouter), but got: "${apiKey?.substring(0, 15) || 'undefined'}"`

      if (logger) {
        await logger.error(errorMsg)
      }
      return {
        success: false,
        error: errorMsg,
        cliName: 'codex',
        changesDetected: false,
      }
    }

    if (logger) {
      const keyType = isOpenRouterKey ? 'OpenRouter' : (isOpenAIKey ? 'OpenAI' : 'Custom')
      await logger.info(`Using ${keyType} API key for authentication`)
    }

    // According to the official Codex CLI docs, we should use 'exec' for non-interactive execution
    // The correct syntax is: codex exec "instruction"
    // We can also specify model with --model flag
    // For API key authentication in sandbox, we need to set the OPENAI_API_KEY environment variable

    // First, try to configure the CLI to use API key authentication
    // According to the docs, we can use API key but it requires additional setup
    if (logger) {
      await logger.info('Setting up Codex CLI authentication with API key...')
    }

    // According to the docs, we need to set up authentication properly
    // Try to configure the CLI with proper authentication and approval mode
    if (logger) {
      await logger.info('Configuring Codex CLI for API key authentication...')
    }

    // Based on research, the CLI might have ZDR (Zero Data Retention) limitations
    // or require specific authentication setup. Let's try a more comprehensive approach

    // First, check if we can get version info
    const versionTestResult = await sandbox.runCommand({
      cmd: 'codex',
      args: ['--version'],
      env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
        HOME: '/home/vercel-sandbox',
      },
      sudo: false,
      cwd: PROJECT_DIR,
    })

    if (logger) {
      await logger.info('Codex CLI version test completed')
    }

    // Create configuration file based on API key type
    // Use selectedModel if provided, otherwise fall back to default
    const modelToUse = selectedModel || 'openai/gpt-4o'
    let configToml
    if (isOpenRouterKey || !isOpenAIKey) {
      // Use OpenRouter configuration
      configToml = `model = "${modelToUse}"
model_provider = "openrouter"

[model_providers.openrouter]
name = "OpenRouter"
base_url = "https://openrouter.ai/api/v1"
env_key = "OPENROUTER_API_KEY"
wire_api = "chat"

# Debug settings
[debug]
log_requests = true
`
    } else {
      // Use OpenAI direct for sk_ keys
      configToml = `model = "${modelToUse}"
model_provider = "openai"

[model_providers.openai]
name = "OpenAI"
base_url = "https://api.openai.com/v1"
env_key = "OPENROUTER_API_KEY"
wire_api = "responses"

# Debug settings
[debug]
log_requests = true
`
    }

    // Add MCP servers configuration if provided
    if (mcpServers && mcpServers.length > 0) {
      await logger.info('Configuring MCP servers')

      // Check if we need experimental RMCP client (for remote servers)
      const hasRemoteServers = mcpServers.some((s) => s.type === 'remote')
      if (hasRemoteServers) {
        configToml = `experimental_use_rmcp_client = true\n\n` + configToml
      }

      for (const server of mcpServers) {
        const serverName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-')

        if (server.type === 'local') {
          // Local STDIO server - parse command string into command and args
          const commandParts = server.command!.trim().split(/\s+/)
          const executable = commandParts[0]
          const args = commandParts.slice(1)

          configToml += `
[mcp_servers.${serverName}]
command = "${executable}"
`
          // Add args if provided
          if (args.length > 0) {
            configToml += `args = [${args.map((arg) => `"${arg}"`).join(', ')}]\n`
          }

          // Add env vars if provided
          if (server.env && Object.keys(server.env).length > 0) {
            configToml += `env = { ${Object.entries(server.env)
              .map(([key, value]) => `"${key}" = "${value}"`)
              .join(', ')} }\n`
          }

          await logger.info('Added local MCP server')
        } else {
          // Remote HTTP/SSE server
          configToml += `
[mcp_servers.${serverName}]
url = "${server.baseUrl}"
`
          // Add bearer token if available (using oauthClientSecret)
          if (server.oauthClientSecret) {
            configToml += `bearer_token = "${server.oauthClientSecret}"\n`
          }

          await logger.info('Added remote MCP server')
        }
      }
    }

    if (logger) {
      await logger.info('Creating Codex configuration file...')
    }

    const configSetupResult = await sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', `mkdir -p ~/.codex && cat > ~/.codex/config.toml << 'EOF'\n${configToml}EOF`],
      env: {},
      sudo: false,
      cwd: PROJECT_DIR,
    })

    if (logger) {
      await logger.info('Codex config setup completed')
    }

    // Debug: Check if the config file was created correctly (without logging sensitive contents)
    const configCheckResult = await sandbox.runCommand({
      cmd: 'test',
      args: ['-f', '~/.codex/config.toml'],
      env: { HOME: '/home/vercel-sandbox' },
      sudo: false,
      cwd: PROJECT_DIR,
    })

    if (logger && configCheckResult.exitCode === 0) {
      await logger.info('Config file verified')
    }

    // Debug: List files in the current directory before running Codex
    const lsDebugResult = await runCommandInSandbox(sandbox, 'ls', ['-la'])
    if (logger) {
      await logger.info('Current directory contents retrieved')
    }

    // Debug: Show current working directory
    const pwdResult = await runCommandInSandbox(sandbox, 'pwd', [])
    if (logger) {
      await logger.info('Current working directory retrieved')
    }

    // Prepare the command arguments
    const args = isResumed
      ? ['resume', '--last']
      : ['exec', '--dangerously-bypass-approvals-and-sandbox']

    if (isResumed && logger) {
      await logger.info('Resuming previous Codex conversation')
    }

    const logCommand = `codex ${args.join(' ')} "${instruction.substring(0, 50)}..."`
    await logger.command(logCommand)

    const providerName = isOpenRouterKey ? 'OpenRouter' : 'OpenAI API'
    await logger.info(
      `Executing Codex with model ${modelToUse} via ${providerName} and bypassed sandbox restrictions`,
    )

    // Build environment variables for the command
    const env = {
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
      HOME: '/home/vercel-sandbox',
      CI: 'true',
    }

    // Execute Codex CLI in the project directory
    const result = await runInProject(sandbox, 'codex', args.concat(instruction), env)

    // Log the output and error results (similar to Claude and Cursor)
    if (result.output && result.output.trim()) {
      const redactedOutput = redactSensitiveInfo(result.output.trim())
      await logger.info(redactedOutput)
    }

    if (!result.success && result.error && result.error.trim()) {
      const redactedError = redactSensitiveInfo(result.error.trim())
      await logger.error(redactedError)
      if (logger) {
        await logger.error(redactedError)
      }
    }

    // Codex CLI execution completed

    // Extract session ID from output if present (for resumption)
    // Note: Codex uses --last to resume, so we may not need explicit session IDs
    // But we'll extract it if available
    let extractedSessionId: string | undefined
    try {
      const sessionMatch = result.output?.match(/(?:session[_\s-]?id|Session)[:\s]+([a-f0-9-]+)/i)
      if (sessionMatch) {
        extractedSessionId = sessionMatch[1]
      }
    } catch {
      // Ignore parsing errors
    }

    // Check if any files were modified
    const gitStatusCheck = await runAndLogCommand(sandbox, 'git', ['status', '--porcelain'], logger)
    const hasChanges = gitStatusCheck.success && gitStatusCheck.output?.trim()

    if (result.success || result.exitCode === 0) {
      return {
        success: true,
        output: `Codex CLI executed successfully${hasChanges ? ' (Changes detected)' : ' (No changes made)'}`,
        agentResponse: result.output || 'Codex CLI completed the task',
        cliName: 'codex',
        changesDetected: !!hasChanges,
        error: undefined,
        sessionId: extractedSessionId, // Include session ID if available
      }
    } else {
      return {
        success: false,
        error: `Codex CLI failed (exit code ${result.exitCode}): ${result.error || 'No error message'}`,
        agentResponse: result.output,
        cliName: 'codex',
        changesDetected: !!hasChanges,
        sessionId: extractedSessionId, // Include session ID even on failure
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute Codex CLI in sandbox'
    return {
      success: false,
      error: errorMessage,
      cliName: 'codex',
      changesDetected: false,
    }
  }
}
