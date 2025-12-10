import "dotenv/config"
import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import { SocketHandlers } from "./socket/handlers"
import { GameService } from "./services/game-service"
import { StatsService } from "./services/stats-service"
import { redis } from "./config/redis"

const app = express()
const httpServer = createServer(app)

// Configurar CORS para múltiples orígenes
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000"
const allowedOrigins = corsOrigin.split(",").map((origin) => origin.trim())

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Permitir requests sin origin (como Postman o curl)
    if (!origin) return callback(null, true)
    
    // Verificar si el origin está en la lista permitida
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error("Not allowed by CORS"))
    }
  },
  credentials: true,
}

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
})

app.use(cors(corsOptions))

app.use(express.json())

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() })
})

app.post("/api/games", async (req, res) => {
  try {
    const { hostId, hostName } = req.body

    if (!hostId || !hostName) {
      return res.status(400).json({ error: "hostId y hostName son requeridos" })
    }

    const game = await GameService.createGame(hostId, hostName)
    return res.json(game)
  } catch (error: any) {
    console.error("[API] Error creating game:", error)
    return res.status(500).json({ error: error.message || "Error al crear la partida" })
  }
})

app.get("/api/games/:code", async (req, res) => {
  try {
    const { code } = req.params
    const game = await GameService.getGame(code)

    if (!game) {
      return res.status(404).json({ error: "Partida no encontrada" })
    }

    return res.json(game)
  } catch (error: any) {
    console.error("[API] Error getting game:", error)
    return res.status(500).json({ error: error.message || "Error al obtener la partida" })
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

// Endpoints de Estadísticas
app.get("/api/stats/general", async (_req, res) => {
  try {
    const stats = await StatsService.getGeneralStats()
    return res.json(stats)
  } catch (error: any) {
    console.error("[API] Error getting general stats:", error)
    return res.status(500).json({ error: error.message || "Error al obtener estadísticas" })
  }
})

app.get("/api/stats/impostor-wins", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100
    const wins = await StatsService.getImpostorWins(limit)
    return res.json(wins)
  } catch (error: any) {
    console.error("[API] Error getting impostor wins:", error)
    return res.status(500).json({ error: error.message || "Error al obtener victorias del impostor" })
  }
})

app.get("/api/stats/players-wins", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100
    const wins = await StatsService.getPlayersWins(limit)
    return res.json(wins)
  } catch (error: any) {
    console.error("[API] Error getting players wins:", error)
    return res.status(500).json({ error: error.message || "Error al obtener victorias de jugadores" })
  }
})

app.get("/api/stats/impostor/:impostorId", async (req, res) => {
  try {
    const { impostorId } = req.params
    const stats = await StatsService.getImpostorStats(impostorId)
    return res.json(stats)
  } catch (error: any) {
    console.error("[API] Error getting impostor stats:", error)
    return res.status(500).json({ error: error.message || "Error al obtener estadísticas del impostor" })
  }
})

app.post("/api/stats/query", async (req, res) => {
  try {
    const query = req.body
    const results = await StatsService.queryGames(query)
    return res.json(results)
  } catch (error: any) {
    console.error("[API] Error querying stats:", error)
    return res.status(500).json({ error: error.message || "Error al consultar estadísticas" })
  }
})

const socketHandlers = new SocketHandlers(io)
io.on("connection", (socket) => {
  socketHandlers.handleConnection(socket)
})

const PORT = process.env.PORT || 3001

httpServer.listen(PORT, () => {
  console.log(`[Server] Servidor corriendo en puerto ${PORT}`)
  console.log(`[Server] CORS habilitado para: ${allowedOrigins.join(", ")}`)
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

