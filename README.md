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

- `join-game`: Unirse a una partida
- `game-action`: Enviar acción del juego
- `send-message`: Enviar mensaje en el chat
- `get-messages`: Obtener mensajes del chat

### Servidor → Cliente

- `joined-game`: Confirmación de unión
- `game-updated`: Estado del juego actualizado
- `action`: Acción del juego
- `new-message`: Nuevo mensaje en el chat
- `messages`: Lista de mensajes
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

