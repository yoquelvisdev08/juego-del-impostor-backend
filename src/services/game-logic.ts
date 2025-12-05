import type { GameState, Player } from "../types"
import { WordsService } from "./words-service"

export class GameLogic {
  /**
   * Asigna el rol de impostor a un jugador aleatorio
   * Usa Fisher-Yates shuffle para garantizar una distribución aleatoria justa
   */
  static assignImpostor(players: Record<string, Player>): string {
    const playerIds = Object.keys(players).filter((id) => players[id].status === "alive")
    if (playerIds.length === 0) {
      throw new Error("No hay jugadores vivos para asignar impostor")
    }

    // Mezclar el array usando Fisher-Yates shuffle para garantizar aleatoriedad
    const shuffledIds = [...playerIds]
    for (let i = shuffledIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]]
    }

    // Seleccionar el primer elemento del array mezclado
    const impostorId = shuffledIds[0]

    // Asignar roles
    Object.keys(players).forEach((id) => {
      players[id].role = id === impostorId ? "impostor" : "player"
    })

    return impostorId
  }

  /**
   * Inicia una nueva ronda: asigna palabra e impostor
   */
  static async startNewRound(game: GameState): Promise<void> {
    // Asignar nuevo impostor
    game.impostorId = this.assignImpostor(game.players)

    // Obtener palabra aleatoria (usando Gemini si está disponible)
    const wordData = await WordsService.getRandomWord()
    game.currentWord = wordData.word
    game.currentCategory = wordData.category

    // Resetear estado de la ronda
    game.clues = {}
    game.votes = {}
    game.round++
    game.phase = "pistas"
    game.timeLeft = game.cluesTime

    // Resetear estado de jugadores
    Object.values(game.players).forEach((player) => {
      if (player.status === "alive") {
        player.hasGivenClue = false
        player.clue = undefined
        player.hasVoted = false
      }
    })
  }

  /**
   * Procesa los votos y determina el ganador de la ronda
   */
  static processVotes(game: GameState): { ejectedPlayer: string | null; isTie: boolean; winner: "players" | "impostor" | null } {
    const voteCounts: Record<string, number> = {}
    let skipVotes = 0

    Object.values(game.votes).forEach((vote) => {
      if (vote === "skip") {
        skipVotes++
      } else {
        voteCounts[vote] = (voteCounts[vote] || 0) + 1
      }
    })

    let maxVotes = skipVotes
    let ejectedPlayer: string | null = null
    let isTie = false

    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count > maxVotes) {
        maxVotes = count
        ejectedPlayer = playerId
        isTie = false
      } else if (count === maxVotes && maxVotes > 0) {
        isTie = true
      }
    })

    // Determinar ganador y asignar puntos de forma más dinámica
    let winner: "players" | "impostor" | null = null

    if (!isTie && ejectedPlayer) {
      // Si el impostor fue expulsado, los jugadores ganan
      if (ejectedPlayer === game.impostorId) {
        winner = "players"
        // Dar puntos dinámicos basados en participación
        const alivePlayers = Object.values(game.players).filter(
          (p) => p.id !== game.impostorId && p.status === "alive"
        )
        const basePoints = 20
        const bonusPerPlayer = 5
        
        alivePlayers.forEach((player) => {
          let points = basePoints
          // Bonus por dar pista
          if (player.hasGivenClue) points += 5
          // Bonus por votar correctamente
          if (player.hasVoted && game.votes[player.id] === game.impostorId) points += 10
          // Bonus por estar vivo al final
          points += bonusPerPlayer
          
          player.points += points
        })
      } else {
        // Si un jugador normal fue expulsado, el impostor gana
        winner = "impostor"
        const impostor = game.players[game.impostorId!]
        if (impostor) {
          let points = 30 // Base points
          // Bonus por pasar desapercibido
          const votesAgainst = Object.values(game.votes).filter((v) => v === game.impostorId).length
          if (votesAgainst === 0) points += 20 // Nadie votó por él
          // Bonus por dar pista creíble
          if (impostor.hasGivenClue) points += 10
          
          impostor.points += points
        }
      }
    } else if (isTie || maxVotes === skipVotes) {
      // Empate o todos votaron skip: el impostor gana
      winner = "impostor"
      const impostor = game.players[game.impostorId!]
      if (impostor) {
        let points = 25 // Base points por empate
        // Bonus por crear confusión
        if (isTie) points += 15
        // Bonus por dar pista creíble
        if (impostor.hasGivenClue) points += 10
        
        impostor.points += points
      }
    }

    return { ejectedPlayer, isTie, winner }
  }

  /**
   * Verifica si el impostor adivinó la palabra correctamente
   */
  static checkWordGuess(guessedWord: string, actualWord: string): boolean {
    const normalize = (word: string) =>
      word
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos

    return normalize(guessedWord) === normalize(actualWord)
  }

  /**
   * Verifica condiciones de victoria del juego completo
   */
  static checkGameEnd(game: GameState): "players" | "impostor" | null {
    // El juego termina cuando se alcanza el número máximo de rondas
    if (game.round >= game.maxRounds) {
      // Determinar ganador por puntos
      const playerPoints = Object.values(game.players)
        .filter((p) => p.role === "player" && p.status === "alive")
        .reduce((sum, p) => sum + p.points, 0)

      const impostorPoints = game.players[game.impostorId!]?.points || 0

      return impostorPoints >= playerPoints ? "impostor" : "players"
    }

    return null
  }
}

