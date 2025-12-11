import { GameService } from "./game-service"
import { GameLogic } from "./game-logic"
import type { GameState } from "../types"
import { Server } from "socket.io"
import { redis } from "../config/redis"

interface GameTimer {
  gameCode: string
  intervalId: NodeJS.Timeout
  game: GameState
  phaseStartTime: number
}

const activeTimers = new Map<string, GameTimer>()

export class TimerService {
  /**
   * Emite el estado del juego filtrado a todos los jugadores del juego
   * Cada jugador recibe el estado con currentWord filtrado según su rol
   */
  private static emitGameUpdatedToAll(io: Server, gameCode: string, game: GameState): void {
    const room = io.sockets.adapter.rooms.get(`game:${gameCode}`)
    if (!room) return

    // Enviar estado filtrado a cada socket en el room
    room.forEach((socketId) => {
      const socket = io.sockets.sockets.get(socketId)
      if (!socket) return

      const socketData = socket.data as any
      if (!socketData || !socketData.playerId) {
        socket.emit("game-updated", game)
        return
      }

      const player = game.players[socketData.playerId]
      if (!player) {
        socket.emit("game-updated", game)
        return
      }

      // Si el jugador es el impostor, ocultar la palabra secreta
      if (player.role === "impostor") {
        socket.emit("game-updated", {
          ...game,
          currentWord: null,
          currentCategory: null,
        })
      } else {
        socket.emit("game-updated", game)
      }
    })
  }

  /**
   * Inicia o reinicia el timer para un juego
   */
  static startTimer(io: Server, game: GameState): void {
    // Detener timer existente si hay uno
    this.stopTimer(game.code)

    console.log(`[TimerService] ⏱️ Iniciando timer para juego ${game.code}, fase: ${game.phase}, tiempo: ${game.timeLeft}s`)

    let tickCount = 0
    const intervalId = setInterval(async () => {
      tickCount++
      try {
        const currentGame = await GameService.getGame(game.code)
        if (!currentGame) {
          console.log(`[TimerService] ⚠️ Juego ${game.code} no encontrado, deteniendo timer`)
          this.stopTimer(game.code)
          return
        }

        // Solo decrementar si estamos en una fase activa
        if (currentGame.phase === "pistas" || currentGame.phase === "discusion" || currentGame.phase === "votacion") {
          const previousTime = currentGame.timeLeft
          // Decrementar tiempo
          currentGame.timeLeft = Math.max(0, currentGame.timeLeft - 1)

          // Log cada 5 segundos o cuando el tiempo cambia significativamente
          if (tickCount % 5 === 0 || currentGame.timeLeft === 0 || previousTime !== currentGame.timeLeft) {
            console.log(`[TimerService] ⏱️ Juego ${game.code} - Fase: ${currentGame.phase}, Tiempo: ${currentGame.timeLeft}s (tick #${tickCount})`)
          }

          // Guardar el estado actualizado
          await GameService.saveGame(currentGame)

          // Emitir actualización a todos los clientes (filtrado por rol)
          this.emitGameUpdatedToAll(io, currentGame.code, currentGame)

          // Si el tiempo llegó a 0, avanzar a la siguiente fase
          if (currentGame.timeLeft === 0) {
            console.log(`[TimerService] ⏰ TIMEOUT para fase ${currentGame.phase} en juego ${currentGame.code} - Iniciando transición...`)
            await this.handlePhaseTimeout(io, currentGame)
          }
        } else {
          // Si no estamos en una fase activa, detener el timer
          console.log(`[TimerService] ⚠️ Fase ${currentGame.phase} no es activa, deteniendo timer para juego ${game.code}`)
          this.stopTimer(game.code)
        }
      } catch (error) {
        console.error(`[TimerService] ❌ Error en timer para juego ${game.code}:`, error)
        this.stopTimer(game.code)
      }
    }, 1000) // Actualizar cada segundo

    activeTimers.set(game.code, {
      gameCode: game.code,
      intervalId,
      game,
      phaseStartTime: Date.now(),
    })
  }

  /**
   * Maneja cuando el tiempo de una fase se agota
   */
  private static async handlePhaseTimeout(io: Server, game: GameState): Promise<void> {
    console.log(`[TimerService] 🔄 handlePhaseTimeout llamado para juego ${game.code}, fase actual: ${game.phase}`)
    const timer = activeTimers.get(game.code)
    const phaseStartTime = timer?.phaseStartTime || Date.now()
    
    switch (game.phase) {
      case "pistas": {
        // Log duración de fase de pistas
        const duration = Math.floor((Date.now() - phaseStartTime) / 1000)
        console.log(`[TimerService] 📊 Fase pistas completada en ${duration}s para juego ${game.code}`)
        await this.logPhaseDuration(game.code, "pistas", duration)
        
        // Si el tiempo se agotó pero no todos dieron pista, avanzar igual
        console.log(`[TimerService] ➡️ Transicionando de pistas a discusion para juego ${game.code}`)
        game.phase = "discusion"
        game.timeLeft = game.discussionTime
        await GameService.saveGame(game)
        console.log(`[TimerService] ✅ Estado guardado: fase=discusion, tiempo=${game.timeLeft}s`)
        this.emitGameUpdatedToAll(io, game.code, game)
        io.to(`game:${game.code}`).emit("action", { type: "phase-changed", phase: "discusion" })
        console.log(`[TimerService] 📢 Evento phase-changed emitido a todos los clientes`)
        this.startTimer(io, game)
        break
      }

      case "discusion": {
        // Log duración de fase de discusión
        const duration = Math.floor((Date.now() - phaseStartTime) / 1000)
        console.log(`[TimerService] 📊 Fase discusion completada en ${duration}s para juego ${game.code}`)
        await this.logPhaseDuration(game.code, "discusion", duration)
        
        // Avanzar a votación
        console.log(`[TimerService] ➡️ Transicionando de discusion a votacion para juego ${game.code}`)
        game.phase = "votacion"
        game.timeLeft = game.votingTime
        await GameService.saveGame(game)
        console.log(`[TimerService] ✅ Estado guardado: fase=votacion, tiempo=${game.timeLeft}s`)
        this.emitGameUpdatedToAll(io, game.code, game)
        io.to(`game:${game.code}`).emit("action", { type: "phase-changed", phase: "votacion" })
        console.log(`[TimerService] 📢 Evento phase-changed emitido a todos los clientes`)
        this.startTimer(io, game)
        break
      }

      case "votacion": {
        // Log duración de fase de votación
        const duration = Math.floor((Date.now() - phaseStartTime) / 1000)
        await this.logPhaseDuration(game.code, "votacion", duration)
        
        // Procesar votos automáticamente
        const { winner } = GameLogic.processVotes(game)

        if (winner) {
          // Ronda terminada
          game.phase = "resultados"
          game.winner = winner
          await GameService.saveGame(game)
          this.stopTimer(game.code)

          this.emitGameUpdatedToAll(io, game.code, game)
          io.to(`game:${game.code}`).emit("action", {
            type: "round-ended",
            winner,
          })

          // Verificar si el juego completo terminó
          const gameWinner = GameLogic.checkGameEnd(game)
          if (gameWinner) {
            game.winner = gameWinner
            await GameService.saveGame(game)
            io.to(`game:${game.code}`).emit("action", {
              type: "game-ended",
              winner: gameWinner,
            })
          }
        } else {
          // Continuar al siguiente round
          game.phase = "resultados"
          await GameService.saveGame(game)
          this.stopTimer(game.code)
          this.emitGameUpdatedToAll(io, game.code, game)
        }
        break
      }
    }
  }

  /**
   * Detiene el timer de un juego
   */
  static stopTimer(gameCode: string): void {
    const timer = activeTimers.get(gameCode)
    if (timer) {
      clearInterval(timer.intervalId)
      activeTimers.delete(gameCode)
      console.log(`[TimerService] 🛑 Timer detenido para juego ${gameCode}`)
    }
  }

  /**
   * Reinicia el timer con un nuevo tiempo
   */
  static restartTimer(io: Server, game: GameState): void {
    console.log(`[TimerService] 🔄 Reiniciando timer para juego ${game.code}, fase: ${game.phase}, tiempo: ${game.timeLeft}s`)
    this.startTimer(io, game)
  }

  private static async logPhaseDuration(gameCode: string, phase: string, duration: number) {
    try {
      const logKey = `logs:${gameCode}:phases`
      const logEntry = {
        timestamp: Date.now(),
        phase,
        duration,
      }
      await redis.lpush(logKey, JSON.stringify(logEntry))
      await redis.ltrim(logKey, 0, 999) // Mantener últimos 1000 logs
      await redis.expire(logKey, 86400 * 7) // Expirar en 7 días

      // Calcular tiempo promedio por fase
      const allPhases = await redis.lrange(logKey, 0, -1)
      const phaseDurations = allPhases
        .map((entry) => JSON.parse(entry))
        .filter((entry) => entry.phase === phase)
        .map((entry) => entry.duration)

      if (phaseDurations.length > 0) {
        const avgDuration = phaseDurations.reduce((a, b) => a + b, 0) / phaseDurations.length
        const avgKey = `stats:${gameCode}:avgPhaseTime:${phase}`
        await redis.setex(avgKey, 86400, avgDuration.toString()) // 24 horas
      }
    } catch (error) {
      console.error("[Logs] Error logging phase duration:", error)
    }
  }
}

