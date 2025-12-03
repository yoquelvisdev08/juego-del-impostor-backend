import "dotenv/config"
import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import { SocketHandlers } from "./socket/handlers"
import { GameService } from "./services/game-service"
import { redis } from "./config/redis"

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
})

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
)

app.use(express.json())

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() })
})

app.post("/api/games", async (req, res) => {
  try {
    const { hostId, hostName } = req.body

    if (!hostId || !hostName) {
      return res.status(400).json({ error: "hostId y hostName son requeridos" })
    }

    const game = await GameService.createGame(hostId, hostName)
    res.json(game)
  } catch (error: any) {
    console.error("[API] Error creating game:", error)
    res.status(500).json({ error: error.message || "Error al crear la partida" })
  }
})

app.get("/api/games/:code", async (req, res) => {
  try {
    const { code } = req.params
    const game = await GameService.getGame(code)

    if (!game) {
      return res.status(404).json({ error: "Partida no encontrada" })
    }

    res.json(game)
  } catch (error: any) {
    console.error("[API] Error getting game:", error)
    res.status(500).json({ error: error.message || "Error al obtener la partida" })
  }
})

app.delete("/api/games/:code", async (req, res) => {
  try {
    const { code } = req.params
    await GameService.deleteGame(code)
    res.json({ success: true })
  } catch (error: any) {
    console.error("[API] Error deleting game:", error)
    res.status(500).json({ error: error.message || "Error al eliminar la partida" })
  }
})

const socketHandlers = new SocketHandlers(io)
io.on("connection", (socket) => {
  socketHandlers.handleConnection(socket)
})

const PORT = process.env.PORT || 3001

httpServer.listen(PORT, () => {
  console.log(`[Server] Servidor corriendo en puerto ${PORT}`)
  console.log(`[Server] CORS habilitado para: ${process.env.CORS_ORIGIN || "http://localhost:3000"}`)
  console.log(`[Server] Entorno: ${process.env.NODE_ENV || "development"}`)
})

process.on("SIGTERM", async () => {
  console.log("[Server] Cerrando conexiones...")
  await redis.quit()
  httpServer.close(() => {
    console.log("[Server] Servidor cerrado")
    process.exit(0)
  })
})

