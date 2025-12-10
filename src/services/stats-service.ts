// Servicio de Estadísticas e Historial de Partidas
// Permite consultas complejas sobre resultados de partidas usando Appwrite

import { databases, APPWRITE_CONFIG } from "../config/appwrite"
import { Query } from "node-appwrite"
import type { GameState } from "../types"

export interface GameResult {
  gameId: string
  code: string
  winner: "players" | "impostor"
  round: number
  maxRounds: number
  impostorId: string | null
  impostorName: string | null
  playerCount: number
  createdAt: number
  endedAt: number
  duration: number // en segundos
  totalPoints: {
    impostor: number
    players: number
  }
  cluesGiven: number
  votesCast: number
}

export interface GameStatsQuery {
  winner?: "players" | "impostor"
  minRounds?: number
  maxRounds?: number
  minPlayers?: number
  maxPlayers?: number
  startDate?: number
  endDate?: number
  impostorId?: string
  limit?: number
  offset?: number
}

export class StatsService {
  private static readonly COLLECTION_ID = APPWRITE_CONFIG.STATS_COLLECTION_ID

  /**
   * Guarda el resultado de una partida finalizada en Appwrite
   */
  static async saveGameResult(game: GameState): Promise<void> {
    if (!game.winner || game.phase !== "resultados") {
      return // Solo guardar partidas completadas
    }

    const impostor = game.impostorId ? game.players[game.impostorId] : null
    const playerCount = Object.keys(game.players).length

    // Calcular puntos totales
    const impostorPoints = impostor?.points || 0
    const playersPoints = Object.values(game.players)
      .filter((p) => p.role === "player")
      .reduce((sum, p) => sum + p.points, 0)

    const endedAt = Date.now()
    const duration = Math.floor((endedAt - game.createdAt) / 1000)

    // Formato para Appwrite (sin objetos anidados, totalPoints como JSON string)
    const appwriteData = {
      gameId: game.id,
      code: game.code,
      winner: game.winner,
      round: game.round,
      maxRounds: game.maxRounds,
      impostorId: game.impostorId || "",
      impostorName: impostor?.name || "",
      playerCount,
      createdAt: game.createdAt,
      endedAt,
      duration,
      totalPoints: JSON.stringify({
        impostor: impostorPoints,
        players: playersPoints,
      }),
      cluesGiven: Object.keys(game.clues).length,
      votesCast: Object.keys(game.votes).length,
    }

    try {
      await databases.createDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        this.COLLECTION_ID,
        game.id, // Usar game.id como document ID
        appwriteData
      )
    } catch (error: any) {
      // Si el documento ya existe, actualizarlo
      if (error.code === 409) {
        await databases.updateDocument(
          APPWRITE_CONFIG.DATABASE_ID,
          this.COLLECTION_ID,
          game.id,
          appwriteData
        )
      } else {
        console.error("[StatsService] Error saving game result:", error)
        throw error
      }
    }
  }

  /**
   * Consulta partidas según criterios usando Appwrite queries
   */
  static async queryGames(query: GameStatsQuery = {}): Promise<GameResult[]> {
    const queries: string[] = []

    if (query.winner) {
      queries.push(Query.equal("winner", query.winner))
    }

    if (query.minRounds !== undefined) {
      queries.push(Query.greaterThanEqual("round", query.minRounds))
    }

    if (query.maxRounds !== undefined) {
      queries.push(Query.lessThanEqual("round", query.maxRounds))
    }

    if (query.minPlayers !== undefined) {
      queries.push(Query.greaterThanEqual("playerCount", query.minPlayers))
    }

    if (query.maxPlayers !== undefined) {
      queries.push(Query.lessThanEqual("playerCount", query.maxPlayers))
    }

    if (query.startDate !== undefined) {
      queries.push(Query.greaterThanEqual("createdAt", query.startDate))
    }

    if (query.endDate !== undefined) {
      queries.push(Query.lessThanEqual("createdAt", query.endDate))
    }

    if (query.impostorId) {
      queries.push(Query.equal("impostorId", query.impostorId))
    }

    // Ordenar por fecha descendente (más recientes primero)
    queries.push(Query.orderDesc("endedAt"))

    // Límite y offset (Appwrite espera strings)
    const limit = String(query.limit || 100)
    const offset = String(query.offset || 0)

    try {
      // listDocuments en node-appwrite v20: 
      // listDocuments(databaseId, collectionId, queries?, limit?, offset?, orderAttributes?, orderTypes?)
      // El orden de parámetros puede variar, usamos type assertion para evitar problemas de tipos
      const response = await (databases as any).listDocuments(
        APPWRITE_CONFIG.DATABASE_ID,
        this.COLLECTION_ID,
        queries.length > 0 ? queries : undefined,
        limit,
        offset
      )

      // Convertir documentos de Appwrite a GameResult
      return response.documents.map((doc: any) => ({
        gameId: doc.gameId,
        code: doc.code,
        winner: doc.winner as "players" | "impostor",
        round: doc.round,
        maxRounds: doc.maxRounds,
        impostorId: doc.impostorId || null,
        impostorName: doc.impostorName || null,
        playerCount: doc.playerCount,
        createdAt: doc.createdAt,
        endedAt: doc.endedAt,
        duration: doc.duration,
        totalPoints: typeof doc.totalPoints === "string" 
          ? JSON.parse(doc.totalPoints)
          : doc.totalPoints,
        cluesGiven: doc.cluesGiven,
        votesCast: doc.votesCast,
      })) as GameResult[]
    } catch (error) {
      console.error("[StatsService] Error querying games:", error)
      return []
    }
  }

  /**
   * Obtiene todas las partidas donde ganó el impostor
   */
  static async getImpostorWins(limit: number = 100): Promise<GameResult[]> {
    return this.queryGames({ winner: "impostor", limit })
  }

  /**
   * Obtiene todas las partidas donde ganaron los jugadores
   */
  static async getPlayersWins(limit: number = 100): Promise<GameResult[]> {
    return this.queryGames({ winner: "players", limit })
  }

  /**
   * Obtiene estadísticas de un impostor específico
   */
  static async getImpostorStats(impostorId: string): Promise<{
    totalGames: number
    wins: number
    losses: number
    winRate: number
    averagePoints: number
    games: GameResult[]
  }> {
    const games = await this.queryGames({ impostorId, limit: 1000 })
    const wins = games.filter((g) => g.winner === "impostor").length
    const losses = games.length - wins

    return {
      totalGames: games.length,
      wins,
      losses,
      winRate: games.length > 0 ? (wins / games.length) * 100 : 0,
      averagePoints:
        games.length > 0
          ? games.reduce((sum, g) => sum + g.totalPoints.impostor, 0) / games.length
          : 0,
      games,
    }
  }

  /**
   * Obtiene estadísticas generales
   */
  static async getGeneralStats(): Promise<{
    totalGames: number
    impostorWins: number
    playersWins: number
    averageDuration: number
    averagePlayers: number
    averageRounds: number
  }> {
    try {
      // Obtener todas las partidas (con límite razonable)
      const allResults = await this.queryGames({ limit: 10000 })

      if (allResults.length === 0) {
        return {
          totalGames: 0,
          impostorWins: 0,
          playersWins: 0,
          averageDuration: 0,
          averagePlayers: 0,
          averageRounds: 0,
        }
      }

      const impostorWins = allResults.filter((r) => r.winner === "impostor").length
      const playersWins = allResults.length - impostorWins

      return {
        totalGames: allResults.length,
        impostorWins,
        playersWins,
        averageDuration:
          allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length,
        averagePlayers:
          allResults.reduce((sum, r) => sum + r.playerCount, 0) / allResults.length,
        averageRounds:
          allResults.reduce((sum, r) => sum + r.round, 0) / allResults.length,
      }
    } catch (error) {
      console.error("[StatsService] Error getting general stats:", error)
      return {
        totalGames: 0,
        impostorWins: 0,
        playersWins: 0,
        averageDuration: 0,
        averagePlayers: 0,
        averageRounds: 0,
      }
    }
  }
}

