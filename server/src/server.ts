
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'

import { testDatabaseConnection } from './config/database.js'

import authRoutes from './routes/auth.routes.js'
import ticketRoutes from './routes/ticket.routes.js'
import departmentRoutes from './routes/departments.routes.js'
import employeeRoutes from './routes/employees.routes.js'
import notificationRoutes from './routes/notifications.routes.js'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 5000

// Security and middleware
app.use(helmet())

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
)

app.use(express.json())
app.use(cookieParser())

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/notifications', notificationRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Employee Helpdesk API is running',
  })
})

// Start server after connecting to MySQL
async function startServer() {
  try {
    await testDatabaseConnection()

    app.listen(PORT, () => {
      console.log(`Helpdesk API running at http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to connect to MySQL:', error)
    process.exit(1)
  }
}

startServer()
