# Configuración de Appwrite - El Impostor Online

## Problema Resuelto: Límite de Columnas

Appwrite tiene un límite en el número de atributos por colección. Para solucionarlo, usamos una estructura optimizada que guarda todo el estado del juego en un solo atributo JSON.

## Estructura de la Colección `games`

### Atributos Necesarios (Solo 3)

1. **`code`** (String, Required, Unique)
   - Tipo: String
   - Tamaño: 6 caracteres
   - Requerido: Sí
   - Único: Sí
   - Usado como: ID del documento

2. **`gameState`** (String, Required)
   - Tipo: String (JSON)
   - Tamaño: Variable (puede ser grande)
   - Requerido: Sí
   - Contiene: Todo el estado del juego serializado como JSON
   - Incluye:
     - `players`: Objeto con todos los jugadores
     - `votes`: Objeto con todos los votos
     - `phase`: Fase actual del juego
     - `hostId`: ID del host
     - `impostorCount`: Número de impostores
     - `totalTasks`: Total de tareas
     - `completedTasks`: Tareas completadas
     - `emergencyMeetingsLeft`: Reuniones de emergencia restantes
     - `discussionTime`: Tiempo de discusión
     - `votingTime`: Tiempo de votación
     - `meetingReason`: Razón de la reunión (si existe)
     - `sabotageActive`: Si hay sabotaje activo
     - `createdAt`: Timestamp de creación

3. **`updatedAt`** (Integer, Required)
   - Tipo: Integer
   - Requerido: Sí
   - Contiene: Timestamp de última actualización

## Estado Actual

✅ **Las colecciones están configuradas con la estructura optimizada**

### Colección `games`
- **ID**: `692f81e4003262186f74`
- **Atributos**: `code`, `gameState`, `updatedAt` (exactamente 3 atributos)
- **Estructura**: Optimizada y funcionando
- **Configuración en `.env`**: `APPWRITE_GAMES_COLLECTION_ID=692f81e4003262186f74`

### Colección `players`
- **ID**: `692f81f0003570c524af`
- **Atributos**: `playerId`, `name`, `gameCode`, `createdAt`
- **Configuración en `.env`**: `APPWRITE_PLAYERS_COLLECTION_ID=692f81f0003570c524af`

### Verificación

Para verificar que todo está correcto, ejecuta:
```bash
pnpm verify-strict
```

Deberías ver:
```
✅ CONFIGURACIÓN CORRECTA
   La colección 'games' tiene exactamente 3 atributos
```

## Pasos para Crear la Colección (Si necesitas recrearla)

1. Ve a tu proyecto en [Appwrite Cloud](https://cloud.appwrite.io)

2. Crea una base de datos (si no la tienes)

3. Crea la colección `games`

4. Agrega los atributos:

   **Atributo 1: `code`**
   - Tipo: String
   - Tamaño: 6
   - Requerido: ✅
   - Array: ❌
   - Único: ✅
   - Default: (vacío)

   **Atributo 2: `gameState`**
   - Tipo: String
   - Tamaño: 65535 (máximo)
   - Requerido: ✅
   - Array: ❌
   - Único: ❌
   - Default: (vacío)

   **Atributo 3: `updatedAt`**
   - Tipo: Integer
   - Tamaño: 64 bits
   - Requerido: ✅
   - Array: ❌
   - Único: ❌
   - Default: (vacío)

5. Configura los índices:
   - Crea un índice en `code` (único)
   - Opcional: Crea un índice en `updatedAt` para búsquedas por fecha

6. Configura los permisos:
   - **Read**: `users` (o el rol que uses)
   - **Create**: `users`
   - **Update**: `users`
   - **Delete**: `users` (o solo admins)

## Ventajas de Esta Estructura

✅ **Solo 3 atributos** en lugar de 13+
✅ **Evita el límite de columnas** de Appwrite
✅ **Más flexible**: Fácil agregar nuevos campos sin modificar la estructura
✅ **Mejor rendimiento**: Menos atributos = menos overhead
✅ **Compatibilidad**: El código maneja automáticamente la estructura antigua si existe

## Scripts Disponibles

El proyecto incluye scripts esenciales para gestionar la configuración de Appwrite:

```bash
# Verificar configuración (verificación general)
pnpm verify-appwrite

# Verificar configuración estricta (solo 3 atributos en games)
pnpm verify-strict

# Listar todas las colecciones y sus IDs
pnpm get-collections

# Recrear colecciones desde cero (elimina y crea nuevas)
pnpm recreate-collections
```

### Descripción de Scripts

- **`verify-appwrite`**: Verificación general de la configuración
- **`verify-strict`**: Verificación estricta que asegura exactamente 3 atributos en `games`
- **`get-collections`**: Lista todas las colecciones y muestra sus IDs
- **`recreate-collections`**: Elimina las colecciones existentes y las recrea con la estructura optimizada (actualiza automáticamente el `.env`)

## Migración desde Estructura Antigua

El código es compatible con ambas estructuras:
- **Nueva estructura optimizada**: Usa `gameState` (JSON con todo el estado)
- **Estructura antigua**: Atributos individuales (code, phase, players, votes, etc.)

El código detecta automáticamente qué estructura tiene cada documento y lo parsea correctamente. Las nuevas partidas se guardan con la estructura optimizada.

Si necesitas migrar datos existentes de la estructura antigua a la nueva, puedes crear un script que:
1. Lee los documentos con la estructura antigua
2. Consolida los datos en `gameState`
3. Actualiza los documentos

## Ejemplo de `gameState` JSON

```json
{
  "id": "ABC123",
  "code": "ABC123",
  "phase": "playing",
  "hostId": "player-123",
  "players": {
    "player-123": {
      "id": "player-123",
      "name": "Jugador 1",
      "color": "red",
      "role": "crewmate",
      "status": "alive",
      "position": { "x": 400, "y": 300 },
      "inRoom": "cafeteria",
      "hasVoted": false,
      "taskProgress": 0
    }
  },
  "impostorCount": 1,
  "totalTasks": 10,
  "completedTasks": 3,
  "emergencyMeetingsLeft": 2,
  "discussionTime": 30,
  "votingTime": 30,
  "votes": {},
  "sabotageActive": false,
  "createdAt": 1701234567890
}
```

## Troubleshooting

### Error: "The maximum number or size of columns for this table has been reached"
- **Solución**: Usa la estructura optimizada con solo 3 atributos

### Error: "String size too large"
- **Solución**: Asegúrate de que `gameState` tenga tamaño 65535 (máximo en Appwrite)

### Error: "Invalid JSON"
- **Solución**: Verifica que el JSON esté bien formado antes de guardarlo

## Configuración Actual en `.env`

Las siguientes variables deben estar configuradas en tu archivo `.env`:

```env
APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=692f78ab00365b57d902
APPWRITE_API_KEY=tu-api-key
APPWRITE_DATABASE_ID=692f7b1f00078304ba14
APPWRITE_GAMES_COLLECTION_ID=692f81e4003262186f74
APPWRITE_PLAYERS_COLLECTION_ID=692f81f0003570c524af
```

**Nota**: Reemplaza `tu-api-key` con tu API Key real de Appwrite.

## Resumen

✅ **Colecciones configuradas correctamente**
- `games`: 3 atributos (code, gameState, updatedAt)
- `players`: 4 atributos (playerId, name, gameCode, createdAt)

✅ **Scripts disponibles y limpios**
- Solo 4 scripts esenciales mantenidos
- Scripts obsoletos eliminados

✅ **Documentación actualizada**
- IDs actuales documentados
- Instrucciones claras para verificación y recreación

