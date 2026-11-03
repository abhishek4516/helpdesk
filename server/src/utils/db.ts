
import { pool } from '../config/database.js'
import type {
  RowDataPacket,
  ResultSetHeader,
  PoolConnection,
} from 'mysql2/promise'

export async function query<T extends RowDataPacket>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const [rows] = await pool.query<T[]>(sql, values)
  return rows
}

export async function execute(
  sql: string,
  values: unknown[] = [],
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>({
    sql,
    values: values as (string | number | Date | Buffer | null)[],
  })
  return result
}

// Run multiple database operations as one transaction.
export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const result = await callback(connection)

    await connection.commit()

    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
