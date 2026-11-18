
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

import { testDatabaseConnection } from './config/database.js'
import { authenticateSocket } from './middleware/socket.middleware.js'

import authRoutes from './routes/auth.routes.js'
import ticketRoutes from './routes/ticket.routes.js'
import departmentRoutes from './routes/departments.routes.js'
import employeeRoutes from './routes/employees.routes.js'
import notificationRoutes from './routes/notifications.routes.js'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const PORT = Number(process.env.PORT) || 5000

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
})

app.use(helmet())

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
)

app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/notifications', notificationRoutes)

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Employee Helpdesk API is running',
  })
})

io.use(authenticateSocket)

io.on('connection', (socket) => {
  const user = socket.data.user

  console.log(`Socket connected: ${user.employeeId}`)

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${user.employeeId}`)
  })
})

async function startServer() {
  try {
    await testDatabaseConnection()

    httpServer.listen(PORT, () => {
      console.log(`Helpdesk API running at http://localhost:${PORT}`)
      console.log('Socket.IO server is ready')
    })
  } catch (error) {
    console.error('Failed to connect to MySQL:', error)
    process.exit(1)
  }
}

startServer()
