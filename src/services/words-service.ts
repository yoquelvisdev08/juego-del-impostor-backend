import { GeminiService } from "./gemini-service"
import { redis } from "../config/redis"

// Palabras base por categoría (fallback si Gemini no está disponible)
const BASE_WORDS: Record<string, string[]> = {
  objetos: [
    "mesa",
    "silla",
    "lápiz",
    "libro",
    "teléfono",
    "computadora",
    "ventana",
    "puerta",
    "cama",
    "espejo",
  ],
  animales: [
    "perro",
    "gato",
    "león",
    "tigre",
    "elefante",
    "jirafa",
    "mono",
    "oso",
    "lobo",
    "zorro",
  ],
  comida: [
    "pizza",
    "hamburguesa",
    "manzana",
    "plátano",
    "naranja",
    "arroz",
    "pasta",
    "pan",
    "queso",
    "leche",
  ],
  lugares: [
    "playa",
    "montaña",
    "ciudad",
    "pueblo",
    "bosque",
    "desierto",
    "río",
    "lago",
    "oceano",
    "isla",
  ],
  profesiones: [
    "médico",
    "profesor",
    "cocinero",
    "bombero",
    "policía",
    "ingeniero",
    "arquitecto",
    "abogado",
    "periodista",
    "fotógrafo",
  ],
}

export interface WordWithCategory {
  word: string
  category: string
}

export class WordsService {
  private static readonly CACHE_PREFIX = "words:category:"
  private static readonly CACHE_TTL = 3600 * 24 // 24 horas
  private static readonly RANDOM_WORD_CACHE_PREFIX = "words:random:"
  private static readonly RANDOM_WORD_CACHE_TTL = 3600 // 1 hora para palabras aleatorias

  /**
   * Obtiene una palabra aleatoria, usando Gemini si está disponible, sino usa palabras base
   */
  static async getRandomWord(categoryId?: string): Promise<WordWithCategory> {
    // Intentar obtener del caché primero (palabras aleatorias recientes)
    const cacheKey = `${this.RANDOM_WORD_CACHE_PREFIX}${categoryId || "any"}`
    const cached = await redis.get(cacheKey)

    if (cached) {
      const cachedWord = JSON.parse(cached)
      return cachedWord
    }

    // Si Gemini está disponible, intentar usarlo
    if (GeminiService.isAvailable()) {
      try {
        const generated = await GeminiService.generateRandomWord(categoryId)
        const wordData = {
          word: generated.word,
          category: generated.category,
        }
        // Guardar en caché
        await redis.setex(cacheKey, this.RANDOM_WORD_CACHE_TTL, JSON.stringify(wordData))
        return wordData
      } catch (error: any) {
        // Solo loguear si no es rate limit (ya se loguea en GeminiService)
        if (error?.status !== 429) {
          console.warn("[WordsService] Error con Gemini, usando palabras base")
        }
        // Fallback a palabras base
      }
    }

    // Usar palabras base como fallback
    return this.getRandomWordFromBase(categoryId)
  }

  /**
   * Obtiene múltiples palabras, usando Gemini si está disponible
   */
  static async getMultipleWords(count: number = 10, categoryId?: string): Promise<WordWithCategory[]> {
    if (GeminiService.isAvailable()) {
      try {
        const words = await GeminiService.generateMultipleWords(count)
        return words.map((w) => ({ word: w.word, category: w.category }))
      } catch (error: any) {
        // Solo loguear si no es rate limit
        if (error?.status !== 429) {
          console.warn("[WordsService] Error con Gemini, usando palabras base")
        }
      }
    }

    // Fallback: generar múltiples palabras de la base
    const words: WordWithCategory[] = []
    for (let i = 0; i < count; i++) {
      words.push(this.getRandomWordFromBase(categoryId))
    }
    return words
  }

  /**
   * Obtiene palabras de una categoría específica, con caché
   */
  static async getWordsForCategory(categoryId: string, count: number = 10): Promise<string[]> {
    // Intentar obtener del caché
    const cacheKey = `${this.CACHE_PREFIX}${categoryId}:${count}`
    const cached = await redis.get(cacheKey)

    if (cached) {
      return JSON.parse(cached)
    }

    let words: string[] = []

    // Si Gemini está disponible, generar palabras
    if (GeminiService.isAvailable()) {
      try {
        words = await GeminiService.generateWordsForCategory(categoryId, count)
        // Guardar en caché
        await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(words))
        return words
      } catch (error: any) {
        // Solo loguear si no es rate limit
        if (error?.status !== 429) {
          console.warn("[WordsService] Error con Gemini, usando palabras base")
        }
      }
    }

    // Fallback a palabras base
    words = BASE_WORDS[categoryId] || BASE_WORDS.objetos
    return words.slice(0, count)
  }

  /**
   * Obtiene una palabra aleatoria de las palabras base
   */
  private static getRandomWordFromBase(categoryId?: string): WordWithCategory {
    const categories = Object.keys(BASE_WORDS)
    const selectedCategory = categoryId && BASE_WORDS[categoryId]
      ? categoryId
      : categories[Math.floor(Math.random() * categories.length)]

    const words = BASE_WORDS[selectedCategory]
    const randomWord = words[Math.floor(Math.random() * words.length)]

    return {
      word: randomWord,
      category: selectedCategory,
    }
  }

  /**
   * Verifica si hay palabras disponibles (base o Gemini)
   */
  static isAvailable(): boolean {
    return Object.keys(BASE_WORDS).length > 0 || GeminiService.isAvailable()
  }
}

