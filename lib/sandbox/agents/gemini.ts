import { Sandbox } from '@vercel/sandbox'
import { Writable } from 'stream'
import { runCommandInSandbox, runInProject, PROJECT_DIR } from '../commands'
import { AgentExecutionResult } from '../types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { TaskLogger } from '@/lib/utils/task-logger'
import { connectors } from '@/lib/db/schema'

type Connector = typeof connectors.$inferSelect

// Helper function to run command and log it in project directory
async function runAndLogCommand(sandbox: Sandbox, command: string, args: string[], logger: TaskLogger) {
  const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command
  const redactedCommand = redactSensitiveInfo(fullCommand)

  await logger.command(redactedCommand)

  const result = await runInProject(sandbox, command, args)

  // Only try to access properties if result is valid
  if (result && result.output && result.output.trim()) {
    const redactedOutput = redactSensitiveInfo(result.output.trim())
    await logger.info(redactedOutput)
  }

  if (result && !result.success && result.error) {
    const redactedError = redactSensitiveInfo(result.error)
    await logger.error(redactedError)
  }

  // If result is null/undefined, create a fallback result
  if (!result) {
    const errorResult = {
      success: false,
      error: 'Command execution failed - no result returned',
      exitCode: -1,
      output: '',
      command: redactedCommand,
    }
    await logger.error('Command execution failed - no result returned')
    return errorResult
  }

  return result
}

export async function executeGeminiInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
  mcpServers?: Connector[],
): Promise<AgentExecutionResult> {
  try {
    // Executing Gemini CLI with instruction

    // Check if Gemini CLI is available
    const cliCheck = await runAndLogCommand(sandbox, 'which', ['gemini'], logger)

    if (!cliCheck.success) {
      // Gemini CLI not found, try to install it
      await logger.info('Gemini CLI not found, installing...')

      // Install Gemini CLI using npm
      const installResult = await runAndLogCommand(sandbox, 'npm', ['install', '-g', '@google/gemini-cli'], logger)

      if (!installResult.success) {
        return {
          success: false,
          error: `Failed to install Gemini CLI: ${installResult.error}`,
          cliName: 'gemini',
          changesDetected: false,
        }
      }

      await logger.info('Gemini CLI installed successfully')

      // Verify installation worked
      const verifyCheck = await runAndLogCommand(sandbox, 'which', ['gemini'], logger)
      if (!verifyCheck.success) {
        return {
          success: false,
          error: 'Gemini CLI installation completed but CLI still not found',
          cliName: 'gemini',
          changesDetected: false,
        }
      }
    }

    // Configure MCP servers if provided
    if (mcpServers && mcpServers.length > 0) {
      await logger.info('Configuring MCP servers')

      // Create Gemini settings.json configuration file
      const settingsConfig: {
        mcpServers: Record<
          string,
          | { httpUrl: string; headers?: Record<string, string> }
          | { command: string; args?: string[]; env?: Record<string, string> }
        >
      } = {
        mcpServers: {},
      }

      for (const server of mcpServers) {
        const serverName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-')

        if (server.type === 'local') {
          // Local STDIO server - parse command string into command and args
          const commandParts = server.command!.trim().split(/\s+/)
          const executable = commandParts[0]
          const args = commandParts.slice(1)

          // Parse env from JSON string if present
          let envObject: Record<string, string> | undefined
          if (server.env) {
            try {
              envObject = JSON.parse(server.env)
            } catch (e) {
              await logger.info('Warning: Failed to parse env for MCP server')
            }
          }

          settingsConfig.mcpServers[serverName] = {
            command: executable,
            ...(args.length > 0 ? { args } : {}),
            ...(envObject ? { env: envObject } : {}),
          }
          await logger.info('Added local MCP server')
        } else {
          // Remote HTTP server
          settingsConfig.mcpServers[serverName] = {
            httpUrl: server.baseUrl!,
          }

          // Build headers object
          const headers: Record<string, string> = {}
          if (server.oauthClientSecret) {
            headers.Authorization = `Bearer ${server.oauthClientSecret}`
          }
          if (server.oauthClientId) {
            headers['X-Client-ID'] = server.oauthClientId
          }
          if (Object.keys(headers).length > 0) {
            settingsConfig.mcpServers[serverName].headers = headers
          }

          await logger.info('Added remote MCP server')
        }
      }

      // Write the settings.json file to ~/.gemini/
      const settingsJson = JSON.stringify(settingsConfig, null, 2)
      const createSettingsCmd = `mkdir -p ~/.gemini && cat > ~/.gemini/settings.json << 'EOF'
${settingsJson}
EOF`

      await logger.info('Creating Gemini MCP settings file...')
      const settingsResult = await runCommandInSandbox(sandbox, 'sh', ['-c', createSettingsCmd])

      if (settingsResult.success) {
        await logger.info('Gemini settings.json file created successfully')

        // Verify the file was created (without logging sensitive contents)
        const verifySettings = await runCommandInSandbox(sandbox, 'test', ['-f', '~/.gemini/settings.json'])
        if (verifySettings.success) {
          await logger.info('Gemini MCP configuration verified')
        }
      } else {
        await logger.info('Warning: Failed to create Gemini settings.json file')
      }
    }

    // Check authentication options in order of preference
    let authMethod = 'none'
    const authEnv: Record<string, string> = {}

    // Option 1: Check for GEMINI_API_KEY (Gemini API)
    // NOTE: The Gemini CLI does NOT support OpenRouter - it requires a direct Gemini API key
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
      authMethod = 'api_key'
      authEnv.GEMINI_API_KEY = geminiKey
      // Log key format for debugging (without revealing the actual key)
      const keyPrefix = geminiKey.substring(0, 4)
      const keyLength = geminiKey.length
      await logger.info(`Gemini API key detected (prefix: ${keyPrefix}..., length: ${keyLength})`)

      // Validate key format - Google AI Studio keys start with "AIza"
      if (!geminiKey.startsWith('AIza')) {
        await logger.info(`WARNING: Gemini API key does not start with 'AIza' - may be invalid format`)
      }

      // Also write API key to Gemini config file for CLI to use
      // The Gemini CLI may read from ~/.gemini/settings.json
      const geminiConfigCmd = `mkdir -p ~/.gemini && echo '{"selectedAuthType":"API_KEY","apiKey":"${geminiKey}"}' > ~/.gemini/settings.json`
      const configResult = await runCommandInSandbox(sandbox, 'sh', ['-c', geminiConfigCmd])
      if (configResult.success) {
        await logger.info('Gemini config file created with API key')
      } else {
        await logger.info('Warning: Failed to create Gemini config file')
      }
    }
    // Option 2: Check for GOOGLE_API_KEY with Vertex AI flag (Vertex AI)
    else if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_GENAI_USE_VERTEXAI) {
      authMethod = 'vertex_ai'
      authEnv.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
      authEnv.GOOGLE_GENAI_USE_VERTEXAI = 'true'
      await logger.info('Using Vertex AI auth')
    }
    // Option 3: Check for Google Cloud Project (OAuth with Code Assist)
    else if (process.env.GOOGLE_CLOUD_PROJECT) {
      authMethod = 'oauth_project'
      authEnv.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT
      await logger.info('Using Google Cloud Project auth (requires OAuth login)')
    }
    // Option 4: Default OAuth (will require interactive login)
    else {
      authMethod = 'oauth'
      await logger.info('WARNING: No GEMINI_API_KEY found - CLI will attempt OAuth which cannot work in sandbox')
    }

    // Prepare the command arguments using the correct Gemini CLI syntax
    const args = []

    // Add model selection if provided
    if (selectedModel) {
      args.push('-m', selectedModel)
      await logger.info('Using selected model')
    }

    // Use YOLO mode to auto-approve all tools (bypass approval prompts)
    args.push('--yolo')

    // Use stream-json output for real-time streaming
    args.push('-o', 'stream-json')

    // Don't add instruction to args array - we'll add it quoted separately to the command string

    // Log what we're trying to do
    await logger.info('Executing Gemini CLI in headless mode')
    const redactedCommand = `gemini ${args.join(' ')} -p "${instruction.substring(0, 100)}..."`
    await logger.command(redactedCommand)

    // Build environment variables for the command
    // IMPORTANT: Include PATH to ensure CLI tools can be found
    const env: Record<string, string> = {
      ...authEnv,
      HOME: '/home/vercel-sandbox',
      PATH: '/home/vercel-sandbox/.global/npm/bin:/home/vercel-sandbox/.global/pnpm/bin:/vercel/runtimes/node22/bin:/vercel/bin:/opt/git/bin:/home/vercel-sandbox/.local/bin:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/sbin:/bin',
      // CI mode to skip interactive prompts in tools like npm, create-next-app, etc.
      CI: 'true',
      // Disable npm update notifier which can hang
      NO_UPDATE_NOTIFIER: 'true',
      // Non-interactive npm
      npm_config_yes: 'true',
    }

    // Set up streaming output capture
    let capturedOutput = ''
    const captureStdout = new Writable({
      write(chunk, _encoding, callback) {
        const text = chunk.toString()
        capturedOutput += text
        // Log to task logger immediately for real-time feedback
        logger.info(text.trim()).catch(() => {})
        callback()
      },
    })

    let capturedStderr = ''
    const captureStderr = new Writable({
      write(chunk, _encoding, callback) {
        const text = chunk.toString()
        capturedStderr += text
        // Log errors immediately too
        logger.error(`[stderr] ${text.trim()}`).catch(() => {})
        callback()
      },
    })

    // Prepare full command string for shell execution in project directory
    // IMPORTANT: Use -p/--prompt flag for non-interactive (headless) mode
    // Without -p, the CLI runs in interactive mode and waits for user input
    // Use single quotes to avoid issues with double quotes in the prompt
    // Escape any single quotes in the instruction by ending the string, adding escaped quote, and starting new string
    const escapedInstruction = instruction.replace(/'/g, "'\\''")
    const fullCommand = `cd ${PROJECT_DIR} && gemini ${args.join(' ')} -p '${escapedInstruction}'`

    // Execute Gemini CLI with streaming
    await logger.info('Executing Gemini CLI in project directory with streaming...')
    let result = await sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', fullCommand],
      env,
      stdout: captureStdout,
      stderr: captureStderr,
    })

    // If that fails with tool registry error, try with different approval modes
    const initialError = typeof result.stderr === 'function' ? await result.stderr() : ''
    if (result.exitCode !== 0 && initialError.includes('Tool') && initialError.includes('not found in registry')) {
      await logger.info('Retrying with auto_edit approval mode...')
      const fallbackArgs = []
      if (selectedModel) {
        fallbackArgs.push('-m', selectedModel)
      }
      fallbackArgs.push('--approval-mode', 'auto_edit')

      const fallbackCommand = `cd ${PROJECT_DIR} && gemini ${fallbackArgs.join(' ')} -p '${escapedInstruction}'`

      result = await sandbox.runCommand({
        cmd: 'sh',
        args: ['-c', fallbackCommand],
        env,
        stdout: captureStdout,
        stderr: captureStderr,
      })

      const secondError = typeof result.stderr === 'function' ? await result.stderr() : ''

      // If still failing, try the most basic approach
      if (result.exitCode !== 0 && secondError.includes('Tool') && secondError.includes('not found in registry')) {
        await logger.info('Retrying with minimal flags...')
        const minimalArgs = selectedModel ? ['-m', selectedModel] : []
        const minimalCommand = `cd ${PROJECT_DIR} && gemini ${minimalArgs.join(' ')} -p '${escapedInstruction}'`

        result = await sandbox.runCommand({
          cmd: 'sh',
          args: ['-c', minimalCommand],
          env,
          stdout: captureStdout,
          stderr: captureStderr,
        })
      }
    }

    // Check if result is valid before accessing properties
    if (!result) {
      const errorMsg = 'Gemini CLI execution failed - no result returned'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'gemini',
        changesDetected: false,
      }
    }

    // Capture final outputs for legacy return object compatibility
    const finalStdout = typeof result.stdout === 'function' ? await result.stdout() : ''
    const finalStderr = typeof result.stderr === 'function' ? await result.stderr() : ''
    const isSuccess = result.exitCode === 0

    // Log the output
    if (finalStdout.trim()) {
      const redactedOutput = redactSensitiveInfo(finalStdout.trim())
      await logger.info(redactedOutput)
    }

    if (!isSuccess && finalStderr.trim()) {
      const redactedError = redactSensitiveInfo(finalStderr.trim())
      await logger.error(redactedError)
    }

    // Log more details for debugging
    await logger.info('Gemini CLI execution completed')

    // Check if any files were modified
    const gitStatusCheck = await runAndLogCommand(sandbox, 'git', ['status', '--porcelain'], logger)
    const hasChanges = gitStatusCheck.success && gitStatusCheck.output?.trim()

    if (isSuccess) {
      // Log additional debugging info if no changes were made
      if (!hasChanges) {
        await logger.info('No changes detected. Checking if files exist...')
        // Check if common files exist
        await runAndLogCommand(sandbox, 'find', ['.', '-name', 'README*', '-o', '-name', 'readme*'], logger)
        await runAndLogCommand(sandbox, 'ls', ['-la'], logger)
      }

      return {
        success: true,
        output: `Gemini CLI executed successfully${hasChanges ? ' (Changes detected)' : ' (No changes made)'}`,
        agentResponse: finalStdout || 'No detailed response available',
        cliName: 'gemini',
        changesDetected: !!hasChanges,
        error: undefined,
      }
    } else {
      // Handle specific error types
      if (finalStderr.includes('authentication') || finalStderr.includes('login')) {
        return {
          success: false,
          error: `Gemini CLI authentication failed. Please set GEMINI_API_KEY, GOOGLE_API_KEY (with GOOGLE_GENAI_USE_VERTEXAI=true), or GOOGLE_CLOUD_PROJECT environment variable. Error: ${finalStderr}`,
          agentResponse: finalStdout,
          cliName: 'gemini',
          changesDetected: !!hasChanges,
        }
      }

      // Handle tool registry errors (common in sandbox environments)
      if (finalStderr.includes('Tool') && finalStderr.includes('not found in registry')) {
        return {
          success: false,
          error: `Gemini CLI tool registry error - this may be due to sandbox environment limitations. The Gemini CLI may have restricted file operation capabilities in this environment. Consider using a different agent for file modifications. Error: ${finalStderr}`,
          agentResponse: finalStdout,
          cliName: 'gemini',
          changesDetected: !!hasChanges,
        }
      }

      return {
        success: false,
        error: `Gemini CLI failed (exit code ${result.exitCode}): ${finalStderr || 'No error message'}`,
        agentResponse: finalStdout,
        cliName: 'gemini',
        changesDetected: !!hasChanges,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute Gemini CLI in sandbox'
    return {
      success: false,
      error: errorMessage,
      cliName: 'gemini',
      changesDetected: false,
    }
  }
}
