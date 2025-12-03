import type { Server, Socket } from "socket.io"
import { GameService } from "../services/game-service"
import { GameLogic } from "../services/game-logic"
import { TimerService } from "../services/timer-service"
import type { GameAction, SocketData, GameState } from "../types"
import { redis } from "../config/redis"

export class SocketHandlers {
  constructor(private io: Server) {}

  handleConnection(socket: Socket) {
    console.log(`[Socket] Client connected: ${socket.id}`)

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

          // Si el juego está en fase "resultados", asignar un rol temporal
          // El rol se reasignará en la siguiente ronda, pero al menos tendrá uno
          if (game.phase === "resultados" && game.impostorId) {
            // Asignar rol temporal: la mayoría serán "player", pero algunos podrían ser impostor
            // Para mantener el balance, asignamos "player" por defecto y el rol se reasignará en startNewRound
            newPlayer.role = "player"
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

        const message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          playerId,
          playerName: player.name,
          content: data.content.trim(),
          timestamp: Date.now(),
        }

        await redis.lpush(`game:${gameCode}:messages`, JSON.stringify(message))
        await redis.ltrim(`game:${gameCode}:messages`, 0, 99)

        this.io.to(`game:${gameCode}`).emit("new-message", message)
      } catch (error) {
        console.error("[Socket] Error sending message:", error)
      }
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

        console.log(`[Socket] Client disconnected: ${socket.id}`)
      } catch (error) {
        console.error("[Socket] Error on disconnect:", error)
      }
    })
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
          
          // Actualizar configuración de cambio de impostor
          if (action.changeImpostorEachRound !== undefined) {
            game.changeImpostorEachRound = action.changeImpostorEachRound
          }
          
          await GameService.saveGame(game)

          // Emitir el juego actualizado con los valores validados
          this.io.to(`game:${gameCode}`).emit("game-updated", game)
          this.io.to(`game:${gameCode}`).emit("action", {
            ...action,
            maxRounds: game.maxRounds,
            cluesTime: game.cluesTime,
            discussionTime: game.discussionTime,
            votingTime: game.votingTime,
            changeImpostorEachRound: game.changeImpostorEachRound,
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

    const { ejectedPlayer, isTie, winner } = GameLogic.processVotes(game)

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

