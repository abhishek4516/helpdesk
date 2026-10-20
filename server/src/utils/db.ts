
import { pool } from '../config/database.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

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
