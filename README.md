# Backend Server - El Impostor Online

Servidor backend para el juego El Impostor Online usando Express, Socket.io, Appwrite y Redis Cloud.

## Configuración

### 1. Variables de Entorno

Copia el archivo `.env.example` a `.env` y completa las variables:

```bash
cp .env.example .env
```

#### Appwrite

1. Crea un proyecto en [Appwrite Cloud](https://cloud.appwrite.io)
2. Crea una base de datos
3. Crea las siguientes colecciones:
   - `games`: Para almacenar partidas
   - `players`: Para almacenar información de jugadores (opcional)

**Estructura de la colección `games` (OPTIMIZADA):**

Para evitar el límite de atributos en Appwrite, usamos una estructura simplificada:

- `code` (string, required, unique) - Código de la partida (usado como ID del documento)
- `gameState` (string, required) - **JSON stringificado con TODO el estado del juego**
  - Incluye: id, code, phase, hostId, players, currentWord, currentCategory, impostorId, clues, votes, round, maxRounds, cluesTime, discussionTime, votingTime, timeLeft, winner, createdAt
  - **Nota:** Este juego se basa en palabras/pistas, NO incluye mecánicas tipo Among Us (tareas, sabotajes, eliminaciones)
- `updatedAt` (integer, required) - Timestamp de última actualización

**Nota:** Esta estructura usa solo 3 atributos en lugar de 13+, evitando el límite de columnas de Appwrite. El juego se basa en palabras/pistas, no en tareas tipo Among Us.

#### Redis Cloud

1. Crea una cuenta en [Redis Cloud](https://redis.com/try-free/)
2. Crea una base de datos
3. Obtén la URL de conexión, host, puerto y contraseña

## Instalación

```bash
pnpm install
```

## Desarrollo

```bash
pnpm dev
```

El servidor se ejecutará en `http://localhost:3001`

## Producción

```bash
pnpm build
pnpm start
```

## Despliegue

### Digital Ocean

Para desplegar en Digital Ocean, consulta la [guía completa de despliegue](./DEPLOY_DIGITALOCEAN.md).

**Opciones disponibles:**
- **App Platform** (Recomendado): Despliegue automático desde GitHub
- **Droplet con Docker**: Mayor control sobre el servidor
- **Docker Compose**: Para desarrollo/producción simple

**Archivos de configuración incluidos:**
- `.do/app.yaml` - Configuración para App Platform
- `Dockerfile` - Imagen Docker para despliegue
- `docker-compose.yml` - Orquestación con Docker Compose

## Endpoints API

### POST /api/games
Crea una nueva partida

**Body:**
```json
{
  "hostId": "player-123",
  "hostName": "Jugador 1"
}
```

**Response:**
```json
{
  "code": "ABC123",
  "phase": "lobby",
  ...
}
```

### GET /api/games/:code
Obtiene una partida por código

### DELETE /api/games/:code
Elimina una partida

## Eventos Socket.io

### Cliente → Servidor

- `join-game`: Unirse a una partida (con reconexión automática)
- `game-action`: Enviar acción del juego
- `send-message`: Enviar mensaje en el chat (con validación de palabra secreta)
- `get-messages`: Obtener mensajes del chat
- `typing-start`: Indicar que está escribiendo
- `typing-stop`: Indicar que dejó de escribir
- `ping`: Heartbeat para mantener conexión activa

### Servidor → Cliente

- `joined-game`: Confirmación de unión
- `game-updated`: Estado del juego actualizado
- `action`: Acción del juego
- `new-message`: Nuevo mensaje en el chat
- `messages`: Lista de mensajes
- `typing-users`: Lista de usuarios escribiendo
- `pong`: Respuesta al heartbeat
- `error`: Error ocurrido
- `game-deleted`: Partida eliminada

## Arquitectura

- **Express**: Servidor HTTP y API REST
- **Socket.io**: Comunicación en tiempo real
- **Appwrite**: Persistencia de datos
- **Redis Cloud**: Estado en tiempo real y caché

El flujo es:
1. Estado del juego se guarda en Redis (rápido, tiempo real)
2. Estado se sincroniza con Appwrite (persistencia)
3. Cambios se emiten a todos los clientes vía Socket.io
4. Estadísticas se guardan automáticamente cuando termina una partida

## Características de Seguridad

### Validación de Pistas y Mensajes

El sistema incluye un filtro automático que previene que los jugadores escriban la palabra secreta:

- **Detección inteligente**: Normaliza texto (sin acentos, espacios, mayúsculas)
- **Validación en tiempo real**: Rechaza mensajes/pistas que contengan la palabra secreta
- **Filtrado automático**: Reemplaza la palabra secreta con asteriscos si se detecta
- **Mensajes claros**: Informa al usuario por qué se rechazó el mensaje

**Archivo**: `src/utils/word-filter.ts`

### Sistema de Reconexión

El sistema maneja reconexiones de forma inteligente:

- **Sin jugadores fantasma**: Los jugadores que se reconectan no se duplican
- **Estado preservado**: Puntos, pistas y votos se mantienen al reconectar
- **Reconexión durante el juego**: Los jugadores pueden reconectarse sin perder progreso
- **Eliminación inteligente**: Solo elimina jugadores en lobby o resultados, no durante el juego

**Comportamiento**:
- En `lobby` o `resultados`: Se elimina el jugador al desconectarse
- Durante el juego (`pistas`, `discusion`, `votacion`): Se mantiene para permitir reconexión

## Sistema de Estadísticas

El backend incluye un sistema completo de estadísticas:

- **Guardado automático**: Los resultados se guardan en Appwrite cuando termina una partida
- **API RESTful**: Endpoints para consultar estadísticas
- **Consultas complejas**: Filtrado por múltiples criterios con índices optimizados

### Endpoints de Estadísticas

- `GET /api/stats/general` - Estadísticas generales
- `GET /api/stats/impostor-wins?limit=100` - Victorias del impostor
- `GET /api/stats/players-wins?limit=100` - Victorias de jugadores
- `GET /api/stats/impostor/:impostorId` - Estadísticas de un impostor
- `POST /api/stats/query` - Consulta personalizada

### Configuración

1. Crear la colección de estadísticas:
   ```bash
   pnpm run create-stats-collection
   ```

2. Agregar variable de entorno (opcional):
   ```env
   APPWRITE_STATS_COLLECTION_ID=game_stats
   ```

Para más información, consulta la documentación del frontend: `../juego-del-impostor/docs/ESTADISTICAS.md`

