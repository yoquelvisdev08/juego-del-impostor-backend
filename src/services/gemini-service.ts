import { GoogleGenerativeAI } from "@google/generative-ai"

if (!process.env.GEMINI_API_KEY) {
  console.warn("[Gemini] GEMINI_API_KEY no está configurado. La generación de palabras estará deshabilitada.")
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

const model = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null

// Rate limiting: máximo 1 solicitud por segundo para evitar rate limits
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 1000 // 1 segundo entre solicitudes

export interface GeneratedWord {
  word: string
  category: string
  description?: string
}

export class GeminiService {
  /**
   * Rate limiting: espera si es necesario para evitar exceder límites
   */
  private static async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest))
    }

    lastRequestTime = Date.now()
  }

  /**
   * Verifica si un error es un rate limit
   */
  private static isRateLimitError(error: any): boolean {
    return (
      error?.status === 429 ||
      error?.statusText === "Too Many Requests" ||
      error?.errorDetails?.some?.((detail: any) => detail?.reason === "RATE_LIMIT_EXCEEDED")
    )
  }

  /**
   * Genera palabras aleatorias para una categoría específica usando Gemini AI
   */
  static async generateWordsForCategory(
    category: string,
    count: number = 10,
  ): Promise<string[]> {
    if (!model) {
      throw new Error("Gemini API no está configurada. Configura GEMINI_API_KEY en .env")
    }

    await this.waitForRateLimit()

    try {
      const prompt = `Genera ${count} palabras en español relacionadas con la categoría "${category}". 
Las palabras deben ser:
- Sustantivos comunes
- Fáciles de entender
- Apropiadas para un juego familiar
- En español
- Una palabra por línea, sin numeración ni puntos

Solo devuelve las palabras, una por línea, sin explicaciones adicionales.`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      // Parsear las palabras (una por línea)
      const words = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.match(/^\d+[\.\)]/)) // Filtrar numeración
        .slice(0, count)

      return words.length > 0 ? words : []
    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        // No loguear rate limits como errores críticos, solo como warning
        console.warn("[Gemini] Rate limit alcanzado, usando palabras base")
      } else {
        console.error("[Gemini] Error generando palabras:", error)
      }
      throw error
    }
  }

  /**
   * Genera una palabra aleatoria de cualquier categoría
   */
  static async generateRandomWord(category?: string): Promise<GeneratedWord> {
    if (!model) {
      throw new Error("Gemini API no está configurada")
    }

    await this.waitForRateLimit()

    try {
      const categories = [
        "objetos",
        "animales",
        "comida",
        "lugares",
        "profesiones",
        "deportes",
        "películas",
        "personajes famosos",
        "tecnología",
        "naturaleza",
        "música",
        "arte",
        "ciencia",
        "historia",
      ]

      const selectedCategory = category || categories[Math.floor(Math.random() * categories.length)]

      const prompt = `Genera una palabra en español relacionada con la categoría "${selectedCategory}".
La palabra debe ser:
- Un sustantivo común
- Fácil de entender
- Apropiada para un juego familiar
- En español
- Una sola palabra

Solo devuelve la palabra, sin explicaciones.`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const word = response.text().trim().split("\n")[0].trim()

      return {
        word,
        category: selectedCategory,
      }
    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        // No loguear rate limits como errores críticos
        console.warn("[Gemini] Rate limit alcanzado, usando palabras base")
      } else {
        console.error("[Gemini] Error generando palabra:", error)
      }
      throw error
    }
  }

  /**
   * Genera múltiples palabras de diferentes categorías
   */
  static async generateMultipleWords(count: number = 5): Promise<GeneratedWord[]> {
    if (!model) {
      throw new Error("Gemini API no está configurada")
    }

    try {
      const categories = [
        "objetos",
        "animales",
        "comida",
        "lugares",
        "profesiones",
        "deportes",
        "películas",
        "personajes",
        "tecnología",
        "naturaleza",
      ]

      const words: GeneratedWord[] = []

      for (let i = 0; i < count; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)]
        const word = await this.generateRandomWord(category)
        words.push(word)
      }

      return words
    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        console.warn("[Gemini] Rate limit alcanzado, usando palabras base")
      } else {
        console.error("[Gemini] Error generando múltiples palabras:", error)
      }
      throw error
    }
  }

  /**
   * Verifica si Gemini está disponible
   */
  static isAvailable(): boolean {
    return model !== null && process.env.GEMINI_API_KEY !== undefined
  }
}

