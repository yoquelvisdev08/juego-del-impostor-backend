import { databases, APPWRITE_CONFIG } from "../config/appwrite"
import { redis } from "../config/redis"
import type { GameState, Player, PlayerColor } from "../types"

const AVAILABLE_COLORS: PlayerColor[] = [
  "red",
  "blue",
  "green",
  "pink",
  "orange",
  "yellow",
  "purple",
  "cyan",
  "white",
  "brown",
  "lime",
  "black",
]

const GAME_TTL = 3600 * 2 // 2 horas en segundos

export class GameService {
  private static generateGameCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let code = ""
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  private static getAvailableColor(players: Record<string, Player>): PlayerColor {
    const usedColors = new Set(Object.values(players).map((p) => p.color))
    const available = AVAILABLE_COLORS.find((c) => !usedColors.has(c))
    return available || AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)]
  }

  static async createGame(hostId: string, hostName: string): Promise<GameState> {
    const code = this.generateGameCode()
    const color = this.getAvailableColor({})

    const host: Player = {
      id: hostId,
      name: hostName,
      color,
      status: "alive",
      hasGivenClue: false,
      hasVoted: false,
      points: 0,
    }

    const game: GameState = {
      id: code,
      code,
      phase: "lobby",
      hostId,
      players: { [hostId]: host },
      currentWord: null,
      currentCategory: null,
      impostorId: null,
      clues: {},
      votes: {},
      round: 0,
      maxRounds: 5,
      cluesTime: 180, // 3 minutos
      discussionTime: 180, // 3 minutos
      votingTime: 60, // 1 minuto
      timeLeft: 0,
      createdAt: Date.now(),
    }

    await this.saveGameToRedis(game)
    await this.saveGameToAppwrite(game)

    return game
  }

  static async getGame(code: string): Promise<GameState | null> {
    try {
      const gameData = await redis.get(`game:${code}`)
      if (gameData) {
        return JSON.parse(gameData)
      }

      const appwriteGame = await databases.getDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.GAMES_COLLECTION_ID,
        code,
      )

      if (appwriteGame) {
        const game = this.parseAppwriteGame(appwriteGame)
        await this.saveGameToRedis(game)
        return game
      }

      return null
    } catch (error) {
      console.error(`[GameService] Error getting game ${code}:`, error)
      return null
    }
  }

  static async saveGame(game: GameState): Promise<void> {
    await Promise.all([this.saveGameToRedis(game), this.saveGameToAppwrite(game)])
  }

  private static async saveGameToRedis(game: GameState): Promise<void> {
    await redis.setex(`game:${game.code}`, GAME_TTL, JSON.stringify(game))
  }

  private static async saveGameToAppwrite(game: GameState): Promise<void> {
    try {
      // Consolidamos todo el estado del juego en un solo atributo JSON
      // Esto reduce el número de atributos necesarios en Appwrite
      const gameData = {
        code: game.code,
        gameState: JSON.stringify(game), // Guardamos todo el estado en un solo atributo
        updatedAt: Date.now(),
      }

      try {
        await databases.updateDocument(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.GAMES_COLLECTION_ID,
          game.code,
          gameData,
        )
      } catch (error: any) {
        if (error.code === 404) {
          await databases.createDocument(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.GAMES_COLLECTION_ID,
            game.code,
            gameData,
          )
        } else {
          throw error
        }
      }
    } catch (error) {
      console.error(`[GameService] Error saving game to Appwrite:`, error)
    }
  }

  private static parseAppwriteGame(doc: any): GameState {
    // Si el documento tiene gameState (nueva estructura), lo parseamos directamente
    if (doc.gameState) {
      return JSON.parse(doc.gameState)
    }

    // Si es estructura antigua, crear estructura nueva con valores por defecto
    const oldGame = doc
    return {
      id: oldGame.code || doc.code,
      code: oldGame.code || doc.code,
      phase: "lobby",
      hostId: oldGame.hostId || doc.hostId,
      players: oldGame.players ? JSON.parse(oldGame.players) : {},
      currentWord: null,
      currentCategory: null,
      impostorId: null,
      clues: {},
      votes: oldGame.votes ? JSON.parse(oldGame.votes) : {},
      round: 0,
      maxRounds: 5,
      cluesTime: 180,
      discussionTime: oldGame.discussionTime || 180,
      votingTime: oldGame.votingTime || 60,
      timeLeft: 0,
      createdAt: oldGame.createdAt || doc.createdAt || Date.now(),
    }
  }

  static async addPlayerToGame(code: string, player: Player): Promise<GameState | null> {
    const game = await this.getGame(code)
    if (!game) return null

    if (Object.keys(game.players).length >= 12) {
      return null // Sala llena, retornar null en lugar de lanzar error
    }

    game.players[player.id] = player
    await this.saveGame(game)

    return game
  }

  static async removePlayerFromGame(code: string, playerId: string): Promise<GameState | null> {
    const game = await this.getGame(code)
    if (!game) return null

    delete game.players[playerId]

    if (Object.keys(game.players).length === 0) {
      await this.deleteGame(code)
      return null
    }

    if (game.hostId === playerId && Object.keys(game.players).length > 0) {
      game.hostId = Object.keys(game.players)[0]
    }

    await this.saveGame(game)
    return game
  }

  static async deleteGame(code: string): Promise<void> {
    await Promise.all([
      redis.del(`game:${code}`),
      redis.del(`game:${code}:messages`),
      databases.deleteDocument(APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.GAMES_COLLECTION_ID, code).catch(() => {
        // Ignorar si no existe
      }),
    ])
  }

  static getAvailableColorForPlayer(players: Record<string, Player>): PlayerColor {
    return this.getAvailableColor(players)
  }

  /**
   * Obtiene la palabra actual del juego (solo para jugadores normales, no impostor)
   */
  static getWordForPlayer(game: GameState, playerId: string): string | null {
    // El impostor no debe ver la palabra
    if (game.players[playerId]?.role === "impostor") {
      return null
    }
    return game.currentWord
  }
}

