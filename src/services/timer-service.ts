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
   * Inicia o reinicia el timer para un juego
   */
  static startTimer(io: Server, game: GameState): void {
    // Detener timer existente si hay uno
    this.stopTimer(game.code)

    const intervalId = setInterval(async () => {
      const currentGame = await GameService.getGame(game.code)
      if (!currentGame) {
        this.stopTimer(game.code)
        return
      }

      // Solo decrementar si estamos en una fase activa
      if (currentGame.phase === "pistas" || currentGame.phase === "discusion" || currentGame.phase === "votacion") {
        // Decrementar tiempo
        currentGame.timeLeft = Math.max(0, currentGame.timeLeft - 1)

        // Guardar el estado actualizado
        await GameService.saveGame(currentGame)

        // Emitir actualización a todos los clientes
        io.to(`game:${game.code}`).emit("game-updated", currentGame)

        // Si el tiempo llegó a 0, avanzar a la siguiente fase
        if (currentGame.timeLeft === 0) {
          await this.handlePhaseTimeout(io, currentGame)
        }
      } else {
        // Si no estamos en una fase activa, detener el timer
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
    const timer = activeTimers.get(game.code)
    const phaseStartTime = timer?.phaseStartTime || Date.now()
    
    switch (game.phase) {
      case "pistas": {
        // Log duración de fase de pistas
        const duration = Math.floor((Date.now() - phaseStartTime) / 1000)
        await this.logPhaseDuration(game.code, "pistas", duration)
        
        // Si el tiempo se agotó pero no todos dieron pista, avanzar igual
        game.phase = "discusion"
        game.timeLeft = game.discussionTime
        await GameService.saveGame(game)
        io.to(`game:${game.code}`).emit("game-updated", game)
        io.to(`game:${game.code}`).emit("action", { type: "phase-changed", phase: "discusion" })
        this.startTimer(io, game)
        break
      }

      case "discusion": {
        // Log duración de fase de discusión
        const duration = Math.floor((Date.now() - phaseStartTime) / 1000)
        await this.logPhaseDuration(game.code, "discusion", duration)
        
        // Avanzar a votación
        game.phase = "votacion"
        game.timeLeft = game.votingTime
        await GameService.saveGame(game)
        io.to(`game:${game.code}`).emit("game-updated", game)
        io.to(`game:${game.code}`).emit("action", { type: "phase-changed", phase: "votacion" })
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

          io.to(`game:${game.code}`).emit("game-updated", game)
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
          io.to(`game:${game.code}`).emit("game-updated", game)
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
    }
  }

  /**
   * Reinicia el timer con un nuevo tiempo
   */
  static restartTimer(io: Server, game: GameState): void {
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

