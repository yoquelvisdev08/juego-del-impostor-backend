// Utilidad para filtrar palabras secretas en mensajes y pistas
// Evita que los jugadores escriban la palabra secreta explícitamente

/**
 * Normaliza un texto para comparación (minúsculas, sin acentos, sin espacios)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/\s+/g, "") // Eliminar espacios
    .replace(/[^\w]/g, "") // Eliminar caracteres especiales
}

/**
 * Verifica si un texto contiene la palabra secreta (o variaciones)
 */
export function containsSecretWord(message: string, secretWord: string | null): boolean {
  if (!secretWord) return false

  const normalizedMessage = normalizeText(message)
  const normalizedSecret = normalizeText(secretWord)

  // Verificar si el mensaje contiene la palabra exacta
  if (normalizedMessage.includes(normalizedSecret)) {
    return true
  }

  // Verificar si el mensaje contiene la palabra con espacios (ej: "la palabra es mesa")
  const wordsInMessage = normalizedMessage.split(/\s+/)
  if (wordsInMessage.includes(normalizedSecret)) {
    return true
  }

  // Verificar si el mensaje contiene la palabra con separadores comunes
  const separators = /[.,;:!?\-_]/g
  const messageWithoutSeparators = normalizedMessage.replace(separators, " ")
  const wordsInMessageWithoutSeparators = messageWithoutSeparators.split(/\s+/)
  if (wordsInMessageWithoutSeparators.includes(normalizedSecret)) {
    return true
  }

  return false
}

/**
 * Filtra un mensaje para reemplazar la palabra secreta con asteriscos
 */
export function filterSecretWord(message: string, secretWord: string | null): string {
  if (!secretWord) return message

  const normalizedSecret = normalizeText(secretWord)
  const words = message.split(/(\s+|[.,;:!?\-_])/)

  return words
    .map((word) => {
      const normalizedWord = normalizeText(word)
      if (normalizedWord === normalizedSecret || normalizedWord.includes(normalizedSecret)) {
        return "*".repeat(word.length)
      }
      return word
    })
    .join("")
}


