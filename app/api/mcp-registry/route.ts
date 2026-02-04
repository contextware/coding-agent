import { NextResponse } from 'next/server'

export type RegistryMcpServer = {
  server?: {
    name: string
    description?: string
    remotes?: Array<{
      url: string
      headers?: Array<{
        name: string
        value?: string
      }>
    }>
  }
  _meta?: {
    'io.modelcontextprotocol.registry/official'?: {
      status: 'active' | 'deleted'
      isLatest: boolean
      publishedAt?: string
      updatedAt?: string
    }
    category?: string
  }
}

export async function GET() {
  try {
    const registryUrl = process.env.MCP_REGISTRY_URL

    if (!registryUrl) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // Fetch MCP servers from the registry
    const response = await fetch(`${registryUrl}/v0.1/servers`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Failed to fetch MCP servers from registry')
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    const data = await response.json()

    // The MCP Registry returns { servers: [...] }
    const servers = data.servers || []

    // Filter for active and latest servers only
    const activeServers = Array.isArray(servers)
      ? servers.filter((server: RegistryMcpServer) => {
          const meta = server._meta?.['io.modelcontextprotocol.registry/official']
          return meta?.status === 'active' && meta?.isLatest === true
        })
      : []

    return NextResponse.json({
      success: true,
      data: activeServers,
    })
  } catch (error) {
    console.error('Error fetching MCP servers from registry:', error)

    return NextResponse.json({
      success: true,
      data: [],
    })
  }
}
