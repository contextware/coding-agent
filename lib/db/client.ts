import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    if (!_db) {
      if (!process.env.POSTGRES_URL) {
        throw new Error('POSTGRES_URL environment variable is required')
      }
      // Configure connection pooling to prevent "too many clients" error
      const client = postgres(process.env.POSTGRES_URL, {
        max: 10, // Maximum number of connections in the pool
        idle_timeout: 20, // Close idle connections after 20 seconds
        connect_timeout: 10, // Connection timeout in seconds
      })
      _db = drizzle(client, { schema })
    }
    return Reflect.get(_db, prop)
  },
})
