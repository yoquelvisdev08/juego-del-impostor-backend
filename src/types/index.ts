export type PlayerColor =
  | "red"
  | "blue"
  | "green"
  | "pink"
  | "orange"
  | "yellow"
  | "purple"
  | "cyan"
  | "white"
  | "brown"
  | "lime"
  | "black"

export type GamePhase = "lobby" | "pistas" | "discusion" | "votacion" | "resultados"

export type Role = "player" | "impostor"

export type PlayerStatus = "alive" | "eliminated"

export interface Player {
  id: string
  name: string
  color: PlayerColor
  role?: Role
  status: PlayerStatus
  hasGivenClue: boolean
  clue?: string
  hasVoted: boolean
  points: number
}

export interface GameState {
  id: string
  code: string
  phase: GamePhase
  hostId: string
  players: Record<string, Player>
  currentWord: string | null
  currentCategory: string | null
  impostorId: string | null
  clues: Record<string, string> // playerId -> pista dada
  votes: Record<string, string | "skip"> // playerId -> votadoPor
  round: number
  maxRounds: number
  cluesTime: number // tiempo para fase de pistas (segundos)
  discussionTime: number // tiempo para fase de discusión (segundos)
  votingTime: number // tiempo para fase de votación (segundos)
  timeLeft: number // tiempo restante en la fase actual
  changeImpostorEachRound: boolean // si el impostor cambia cada ronda
  winner?: "players" | "impostor"
  createdAt: number
}

export interface Message {
  id: string
  playerId: string
  playerName: string
  content: string
  timestamp: number
}

export type GameAction =
  | { type: "player-joined"; player: Player }
  | { type: "player-left"; playerId: string }
  | { type: "game-started" }
  | { type: "clue-submitted"; playerId: string; clue: string }
  | { type: "phase-changed"; phase: GamePhase }
  | { type: "vote-cast"; playerId: string; votedFor: string | "skip" }
  | { type: "word-guessed"; playerId: string; guessedWord: string; correct: boolean }
  | { type: "round-ended"; winner: "players" | "impostor" }
  | { type: "game-ended"; winner: "players" | "impostor" }
  | { type: "settings-updated"; maxRounds: number; cluesTime: number; discussionTime: number; votingTime: number; changeImpostorEachRound?: boolean }
  | { type: "next-round" }

export interface SocketData {
  gameCode: string
  playerId: string
  playerName: string
}

