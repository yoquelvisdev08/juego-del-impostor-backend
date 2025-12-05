import type { Server, Socket } from "socket.io"
import { GameService } from "../services/game-service"
import { GameLogic } from "../services/game-logic"
import { TimerService } from "../services/timer-service"
import type { GameAction, SocketData, GameState } from "../types"
import { redis } from "../config/redis"

export class SocketHandlers {
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map()
  private typingUsers: Map<string, Set<string>> = new Map() // gameCode -> Set<playerId>
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map() // playerId -> timeout

  constructor(private io: Server) {
    // Limpiar intervalos de heartbeat periódicamente
    setInterval(() => {
      this.cleanupHeartbeats()
    }, 30000) // Cada 30 segundos
  }

  handleConnection(socket: Socket) {
    console.log(`[Socket] Client connected: ${socket.id}`)
    
    // Inicializar heartbeat
    this.setupHeartbeat(socket)

    socket.on("join-game", async (data: { gameCode: string; playerId: string; playerName: string }) => {
      try {
        const { gameCode, playerId, playerName } = data

        const game = await GameService.getGame(gameCode)
        if (!game) {
          socket.emit("error", { message: "Sala no encontrada" })
          return
        }

        socket.data = { gameCode, playerId, playerName } as SocketData
        await socket.join(`game:${gameCode}`)
        
        // Log conexión y actualizar estadísticas
        await this.logConnection(gameCode, playerId)
        await this.updateActiveUsers(gameCode, 1)
        await this.updateActiveRooms(gameCode)

        // Si el juego está en progreso, no permitir nuevos jugadores
        if (game.phase !== "lobby" && game.phase !== "resultados") {
          socket.emit("error", { 
            message: "El juego está en progreso. Espera a que termine para unirte." 
          })
          return
        }

        if (!game.players[playerId]) {
          // Verificar si la sala está llena antes de intentar agregar
          if (Object.keys(game.players).length >= 12) {
            socket.emit("error", { message: "Sala llena" })
            return
          }

          const availableColor = GameService.getAvailableColorForPlayer(game.players)
          const newPlayer = {
            id: playerId,
            name: playerName,
            color: availableColor,
            status: "alive" as const,
            hasGivenClue: false,
            hasVoted: false,
            points: 0,
          }

          const updatedGame = await GameService.addPlayerToGame(gameCode, newPlayer)
          
          if (!updatedGame) {
            // Sala llena o error al agregar jugador
            socket.emit("error", { message: "Sala llena" })
            return
          }

          this.io.to(`game:${gameCode}`).emit("game-updated", updatedGame)
          this.io.to(`game:${gameCode}`).emit("action", {
            type: "player-joined",
            player: newPlayer,
          } as GameAction)
        } else {
          socket.emit("game-updated", game)
        }

        socket.emit("joined-game", { gameCode, playerId })
      } catch (error: any) {
        console.error("[Socket] Error joining game:", error)
        socket.emit("error", { message: error.message || "Error al unirse a la partida" })
      }
    })

    socket.on("game-action", async (action: GameAction) => {
      try {
        const socketData = socket.data as SocketData | undefined
        if (!socketData) {
          socket.emit("error", { message: "No estás conectado a una partida" })
          return
        }

        const { gameCode } = socketData
        const game = await GameService.getGame(gameCode)
        if (!game) {
          socket.emit("error", { message: "Partida no encontrada" })
          return
        }

        await this.handleGameAction(socket, game, action)
      } catch (error: any) {
        console.error("[Socket] Error handling game action:", error)
        socket.emit("error", { message: error.message || "Error al procesar la acción" })
      }
    })

    socket.on("send-message", async (data: { content: string }) => {
      try {
        const socketData = socket.data as SocketData | undefined
        if (!socketData) return

        const { gameCode, playerId } = socketData
        const game = await GameService.getGame(gameCode)
        if (!game) return

        const player = game.players[playerId]
        if (!player || player.status === "eliminated") return

        // Rate limiting: 3 mensajes cada 5 segundos
        const rateLimitKey = `ratelimit:chat:${gameCode}:${playerId}`
        const messageCount = await redis.incr(rateLimitKey)
        
        if (messageCount === 1) {
          await redis.expire(rateLimitKey, 5) // Expirar en 5 segundos
        }

        if (messageCount > 3) {
          socket.emit("error", { message: "Demasiados mensajes. Espera unos segundos." })
          await redis.decr(rateLimitKey)
          return
        }

        // Limpiar typing indicator
        this.clearTypingIndicator(gameCode, playerId)

        const message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          playerId,
          playerName: player.name,
          content: data.content.trim(),
          timestamp: Date.now(),
        }

        await redis.lpush(`game:${gameCode}:messages`, JSON.stringify(message))
        await redis.ltrim(`game:${gameCode}:messages`, 0, 99)

        // Log del mensaje
        await this.logMessage(gameCode, playerId, "message_sent")

        this.io.to(`game:${gameCode}`).emit("new-message", message)
      } catch (error) {
        console.error("[Socket] Error sending message:", error)
        await this.logError("send-message", error)
      }
    })

    socket.on("typing-start", async () => {
      try {
        const socketData = socket.data as SocketData | undefined
        if (!socketData) return

        const { gameCode, playerId } = socketData
        const game = await GameService.getGame(gameCode)
        if (!game) return

        this.setTypingIndicator(gameCode, playerId)
      } catch (error) {
        console.error("[Socket] Error on typing-start:", error)
      }
    })

    socket.on("typing-stop", async () => {
      try {
        const socketData = socket.data as SocketData | undefined
        if (!socketData) return

        const { gameCode, playerId } = socketData
        this.clearTypingIndicator(gameCode, playerId)
      } catch (error) {
        console.error("[Socket] Error on typing-stop:", error)
      }
    })

    socket.on("ping", () => {
      socket.emit("pong")
    })

    socket.on("get-messages", async () => {
      try {
        const socketData = socket.data as SocketData | undefined
        if (!socketData) return

        const { gameCode } = socketData
        const messages = await redis.lrange(`game:${gameCode}:messages`, 0, -1)
        const parsedMessages = messages.map((msg) => JSON.parse(msg)).reverse()

        socket.emit("messages", parsedMessages)
      } catch (error) {
        console.error("[Socket] Error getting messages:", error)
      }
    })

    socket.on("disconnect", async () => {
      try {
        const socketData = socket.data as SocketData | undefined
        if (!socketData) return

        const { gameCode, playerId } = socketData
        
        // Limpiar heartbeat
        this.clearHeartbeat(socket.id)
        
        // Limpiar typing indicator
        this.clearTypingIndicator(gameCode, playerId)

        const game = await GameService.getGame(gameCode)

        if (game && game.players[playerId]) {
          await GameService.removePlayerFromGame(gameCode, playerId)
          const updatedGame = await GameService.getGame(gameCode)

          if (updatedGame) {
            this.io.to(`game:${gameCode}`).emit("game-updated", updatedGame)
            this.io.to(`game:${gameCode}`).emit("action", {
              type: "player-left",
              playerId,
            } as GameAction)
          } else {
            this.io.to(`game:${gameCode}`).emit("game-deleted")
          }
        }

        // Log desconexión
        await this.logDisconnection(gameCode, playerId)

        console.log(`[Socket] Client disconnected: ${socket.id}`)
      } catch (error) {
        console.error("[Socket] Error on disconnect:", error)
        await this.logError("disconnect", error)
      }
    })
  }

  private setupHeartbeat(socket: Socket) {
    let lastPong = Date.now()
    let missedPongs = 0

    // Enviar ping cada 12 segundos
    const pingInterval = setInterval(() => {
      if (!socket.connected) {
        clearInterval(pingInterval)
        this.heartbeatIntervals.delete(socket.id)
        return
      }

      const timeSinceLastPong = Date.now() - lastPong
      
      // Si no hay respuesta en 15 segundos, desconectar
      if (timeSinceLastPong > 15000) {
        missedPongs++
        if (missedPongs >= 2) {
          console.log(`[Socket] Heartbeat timeout for ${socket.id}, disconnecting...`)
          clearInterval(pingInterval)
          this.heartbeatIntervals.delete(socket.id)
          socket.disconnect()
          return
        }
      }

      socket.emit("ping")
    }, 12000) // Ping cada 12 segundos

    socket.on("pong", () => {
      lastPong = Date.now()
      missedPongs = 0
    })

    this.heartbeatIntervals.set(socket.id, pingInterval)
  }

  private clearHeartbeat(socketId: string) {
    const interval = this.heartbeatIntervals.get(socketId)
    if (interval) {
      clearInterval(interval)
      this.heartbeatIntervals.delete(socketId)
    }
  }

  private cleanupHeartbeats() {
    // Limpiar intervalos de sockets desconectados
    for (const [socketId, interval] of this.heartbeatIntervals.entries()) {
      const socket = this.io.sockets.sockets.get(socketId)
      if (!socket || !socket.connected) {
        clearInterval(interval)
        this.heartbeatIntervals.delete(socketId)
      }
    }
  }

  private setTypingIndicator(gameCode: string, playerId: string) {
    if (!this.typingUsers.has(gameCode)) {
      this.typingUsers.set(gameCode, new Set())
    }
    
    const typingSet = this.typingUsers.get(gameCode)!
    if (!typingSet.has(playerId)) {
      typingSet.add(playerId)
      this.io.to(`game:${gameCode}`).emit("typing-users", Array.from(typingSet))
    }

    // Auto-limpiar después de 3 segundos de inactividad
    const existingTimeout = this.typingTimeouts.get(playerId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    const timeout = setTimeout(() => {
      this.clearTypingIndicator(gameCode, playerId)
    }, 3000)

    this.typingTimeouts.set(playerId, timeout)
  }

  private clearTypingIndicator(gameCode: string, playerId: string) {
    const typingSet = this.typingUsers.get(gameCode)
    if (typingSet && typingSet.has(playerId)) {
      typingSet.delete(playerId)
      this.io.to(`game:${gameCode}`).emit("typing-users", Array.from(typingSet))
      
      if (typingSet.size === 0) {
        this.typingUsers.delete(gameCode)
      }
    }

    const timeout = this.typingTimeouts.get(playerId)
    if (timeout) {
      clearTimeout(timeout)
      this.typingTimeouts.delete(playerId)
    }
  }

  private async logMessage(gameCode: string, playerId: string, event: string) {
    try {
      const logKey = `logs:${gameCode}:messages`
      const logEntry = {
        timestamp: Date.now(),
        playerId,
        event,
      }
      await redis.lpush(logKey, JSON.stringify(logEntry))
      await redis.ltrim(logKey, 0, 999) // Mantener últimos 1000 logs
      await redis.expire(logKey, 86400 * 7) // Expirar en 7 días
    } catch (error) {
      console.error("[Logs] Error logging message:", error)
    }
  }

  private async logError(event: string, error: any) {
    try {
      const errorKey = `logs:errors:${Date.now()}`
      const errorEntry = {
        timestamp: Date.now(),
        event,
        error: error?.message || String(error),
        stack: error?.stack,
      }
      await redis.setex(errorKey, 86400 * 7, JSON.stringify(errorEntry)) // 7 días
    } catch (logError) {
      console.error("[Logs] Error logging error:", logError)
    }
  }

  private async logDisconnection(gameCode: string, _playerId: string) {
    try {
      await this.updateActiveUsers(gameCode, -1)
    } catch (error) {
      console.error("[Logs] Error logging disconnection:", error)
    }
  }

  private async updateActiveUsers(gameCode: string, delta: number) {
    try {
      const key = `stats:${gameCode}:activeUsers`
      const current = await redis.get(key)
      const newCount = Math.max(0, (parseInt(current || "0") + delta))
      await redis.setex(key, 3600, newCount.toString()) // Expirar en 1 hora
    } catch (error) {
      console.error("[Logs] Error updating active users:", error)
    }
  }

  private async updateActiveRooms(gameCode: string) {
    try {
      const key = `stats:activeRooms`
      await redis.sadd(key, gameCode)
      await redis.expire(key, 3600) // Expirar en 1 hora
    } catch (error) {
      console.error("[Logs] Error updating active rooms:", error)
    }
  }

  private async logConnection(gameCode: string, playerId: string) {
    try {
      const logKey = `logs:${gameCode}:connections`
      const logEntry = {
        timestamp: Date.now(),
        playerId,
        event: "connected",
      }
      await redis.lpush(logKey, JSON.stringify(logEntry))
      await redis.ltrim(logKey, 0, 999) // Mantener últimos 1000 logs
      await redis.expire(logKey, 86400 * 7) // Expirar en 7 días
    } catch (error) {
      console.error("[Logs] Error logging connection:", error)
    }
  }


  private async handleGameAction(socket: Socket, game: GameState, action: GameAction) {
    const socketData = socket.data as SocketData
    const { gameCode } = socketData

    switch (action.type) {
      case "game-started": {
        if (game.hostId !== socketData.playerId) {
          socket.emit("error", { message: "Solo el host puede iniciar la partida" })
          return
        }

        const playerCount = Object.keys(game.players).length
        if (playerCount < 3) {
          socket.emit("error", { message: "Se necesitan al menos 3 jugadores" })
          return
        }

        // Iniciar primera ronda
        await GameLogic.startNewRound(game)
        await GameService.saveGame(game)

        // Iniciar timer sincronizado
        TimerService.startTimer(this.io, game)

        this.io.to(`game:${gameCode}`).emit("game-updated", game)
        this.io.to(`game:${gameCode}`).emit("action", action)
        break
      }

      case "clue-submitted": {
        const player = game.players[action.playerId]
        if (player && player.status === "alive" && !player.hasGivenClue) {
          player.hasGivenClue = true
          player.clue = action.clue
          game.clues[action.playerId] = action.clue
          await GameService.saveGame(game)

          this.io.to(`game:${gameCode}`).emit("game-updated", game)
          this.io.to(`game:${gameCode}`).emit("action", action)

          // Verificar si todos dieron pista
          const allGaveClue = Object.values(game.players)
            .filter((p) => p.status === "alive")
            .every((p) => p.hasGivenClue)

          if (allGaveClue) {
            // Cambiar a fase de discusión
            game.phase = "discusion"
            game.timeLeft = game.discussionTime
            await GameService.saveGame(game)
            TimerService.restartTimer(this.io, game)
            this.io.to(`game:${gameCode}`).emit("game-updated", game)
            this.io.to(`game:${gameCode}`).emit("action", { type: "phase-changed", phase: "discusion" })
          }
        }
        break
      }

      case "word-guessed": {
        const player = game.players[action.playerId]
        if (player && player.role === "impostor" && game.currentWord) {
          const correct = GameLogic.checkWordGuess(action.guessedWord, game.currentWord)
          action.correct = correct

          if (correct) {
            // El impostor adivinó: gana la ronda con bonus grande
            TimerService.stopTimer(gameCode)
            game.winner = "impostor"
            // Bonus grande por adivinar la palabra
            player.points += 50
            // Bonus adicional por adivinarla rápido
            const timeBonus = Math.max(0, Math.floor(game.timeLeft / 10))
            player.points += timeBonus
            game.phase = "resultados"
            await GameService.saveGame(game)

            this.io.to(`game:${gameCode}`).emit("game-updated", game)
            this.io.to(`game:${gameCode}`).emit("action", {
              type: "round-ended",
              winner: "impostor",
            })
          } else {
            // Solo notificar que intentó adivinar
            this.io.to(`game:${gameCode}`).emit("action", action)
          }
        }
        break
      }

      case "vote-cast": {
        const player = game.players[action.playerId]
        if (player && player.status === "alive" && !player.hasVoted) {
          game.votes[action.playerId] = action.votedFor
          player.hasVoted = true
          await GameService.saveGame(game)

          this.io.to(`game:${gameCode}`).emit("game-updated", game)
          this.io.to(`game:${gameCode}`).emit("action", action)

          const allVoted = Object.values(game.players)
            .filter((p) => p.status === "alive")
            .every((p) => p.hasVoted)

          if (allVoted) {
            setTimeout(async () => {
              await this.processVoting(game, gameCode)
            }, 1000)
          }
        }
        break
      }

      case "next-round": {
        if (game.hostId !== socketData.playerId) {
          socket.emit("error", { message: "Solo el host puede iniciar la siguiente ronda" })
          return
        }

        // Verificar si el juego terminó
        const gameWinner = GameLogic.checkGameEnd(game)
        if (gameWinner) {
          game.phase = "resultados"
          game.winner = gameWinner
          await GameService.saveGame(game)
          this.io.to(`game:${gameCode}`).emit("game-updated", game)
          this.io.to(`game:${gameCode}`).emit("action", { type: "game-ended", winner: gameWinner })
          return
      }

        // Iniciar nueva ronda
        await GameLogic.startNewRound(game)
        await GameService.saveGame(game)

        // Reiniciar timer
        TimerService.restartTimer(this.io, game)

        this.io.to(`game:${gameCode}`).emit("game-updated", game)
        this.io.to(`game:${gameCode}`).emit("action", action)
        break
      }

      case "settings-updated": {
        if (game.hostId === socketData.playerId) {
          // Validar y actualizar los valores
          game.maxRounds = Math.max(1, Math.min(10, action.maxRounds || game.maxRounds))
          game.cluesTime = Math.max(30, Math.min(600, action.cluesTime || game.cluesTime))
          game.discussionTime = Math.max(30, Math.min(600, action.discussionTime || game.discussionTime))
          game.votingTime = Math.max(10, Math.min(300, action.votingTime || game.votingTime))
          
          await GameService.saveGame(game)

          // Emitir el juego actualizado con los valores validados
          this.io.to(`game:${gameCode}`).emit("game-updated", game)
          this.io.to(`game:${gameCode}`).emit("action", {
            ...action,
            maxRounds: game.maxRounds,
            cluesTime: game.cluesTime,
            discussionTime: game.discussionTime,
            votingTime: game.votingTime,
          })
        } else {
          socket.emit("error", { message: "Solo el host puede actualizar la configuración" })
        }
        break
      }

      default:
        this.io.to(`game:${gameCode}`).emit("action", action)
    }
  }

  private async processVoting(game: GameState, gameCode: string) {
    // Detener timer antes de procesar
    TimerService.stopTimer(gameCode)

    const { winner } = GameLogic.processVotes(game)

    if (winner) {
      // Ronda terminada
      game.phase = "resultados"
      game.winner = winner
      await GameService.saveGame(game)

      this.io.to(`game:${gameCode}`).emit("game-updated", game)
      this.io.to(`game:${gameCode}`).emit("action", {
        type: "round-ended",
        winner,
      } as GameAction)

      // Verificar si el juego completo terminó
      const gameWinner = GameLogic.checkGameEnd(game)
      if (gameWinner) {
        game.winner = gameWinner
        await GameService.saveGame(game)
        this.io.to(`game:${gameCode}`).emit("action", {
          type: "game-ended",
          winner: gameWinner,
      } as GameAction)
    }
    } else {
      // Continuar al siguiente round (si no se alcanzó maxRounds)
      game.phase = "resultados"
      await GameService.saveGame(game)
      this.io.to(`game:${gameCode}`).emit("game-updated", game)
    }
  }
}

