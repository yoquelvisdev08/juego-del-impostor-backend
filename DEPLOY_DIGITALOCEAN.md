# Guía de Despliegue en Digital Ocean

Esta guía te ayudará a desplegar el backend del juego El Impostor en Digital Ocean.

## Opción 1: Digital Ocean App Platform (Recomendado) ⭐

App Platform es la forma más sencilla de desplegar aplicaciones en Digital Ocean. Maneja automáticamente el build, despliegue y escalado.

### Prerrequisitos

1. Cuenta en [Digital Ocean](https://www.digitalocean.com/)
2. Repositorio en GitHub con tu código
3. Todas las variables de entorno configuradas

### Pasos para Desplegar

#### 1. Preparar el Repositorio

Asegúrate de que tu código esté en GitHub:

```bash
git add .
git commit -m "Preparar para despliegue"
git push origin main
```

#### 2. Crear la Aplicación en App Platform

1. Ve a [Digital Ocean App Platform](https://cloud.digitalocean.com/apps)
2. Haz clic en **"Create App"**
3. Selecciona **"GitHub"** como fuente
4. Autoriza Digital Ocean a acceder a tu repositorio si es necesario
5. Selecciona tu repositorio `juego-del-impostor-backend`
6. Selecciona la rama `main`

#### 3. Configurar la Aplicación

**Opción A: Usar el archivo `.do/app.yaml` (Recomendado)**

1. Digital Ocean detectará automáticamente el archivo `.do/app.yaml`
2. Revisa la configuración y ajusta si es necesario:
   - `region`: Cambia `nyc` por la región más cercana a tus usuarios
   - `instance_size_slug`: Ajusta según tus necesidades:
     - `basic-xxs`: $5/mes (512MB RAM) - Para desarrollo/pruebas
     - `basic-xs`: $12/mes (1GB RAM) - Recomendado para producción
     - `basic-s`: $24/mes (2GB RAM) - Para mayor carga

**Opción B: Configuración Manual**

Si no usas el archivo `.do/app.yaml`, configura manualmente:

1. **Tipo de App**: Selecciona "Web Service"
2. **Build Command**: `pnpm install && pnpm build`
3. **Run Command**: `pnpm start`
4. **HTTP Port**: `3001`
5. **Health Check Path**: `/health`

#### 4. Configurar Variables de Entorno

En la sección **"Environment Variables"**, agrega todas las variables necesarias:

```
NODE_ENV=production
PORT=3001
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=tu-project-id
APPWRITE_API_KEY=tu-api-key
APPWRITE_DATABASE_ID=tu-database-id
APPWRITE_GAMES_COLLECTION_ID=tu-games-collection-id
APPWRITE_PLAYERS_COLLECTION_ID=tu-players-collection-id
REDIS_HOST=tu-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=tu-redis-password
REDIS_TLS=true
CORS_ORIGIN=https://tu-frontend.com
GEMINI_API_KEY=tu-gemini-api-key
```

**Importante**: 
- Marca todas las variables como **"Encrypted"** para seguridad
- Actualiza `CORS_ORIGIN` con la URL de tu frontend en producción

#### 5. Desplegar

1. Haz clic en **"Next"** para revisar la configuración
2. Selecciona el plan (recomendado: Basic $12/mes)
3. Haz clic en **"Create Resources"**
4. Espera a que la aplicación se construya y despliegue (5-10 minutos)

#### 6. Verificar el Despliegue

Una vez desplegado, Digital Ocean te dará una URL como:
`https://juego-del-impostor-backend-xxxxx.ondigitalocean.app`

Prueba el endpoint de health:
```bash
curl https://tu-app.ondigitalocean.app/health
```

Deberías recibir:
```json
{"status":"ok","timestamp":1234567890}
```

---

## Opción 2: Droplet con Docker

Si prefieres más control sobre el servidor, puedes usar un Droplet con Docker.

### Prerrequisitos

1. Cuenta en Digital Ocean
2. Conocimientos básicos de Docker y Linux

### Pasos para Desplegar

#### 1. Crear un Droplet

1. Ve a [Digital Ocean Droplets](https://cloud.digitalocean.com/droplets/new)
2. Selecciona:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($6/mes mínimo)
   - **Region**: La más cercana a tus usuarios
   - **Authentication**: SSH keys (recomendado) o Password
3. Crea el Droplet

#### 2. Conectarte al Droplet

```bash
ssh root@tu-droplet-ip
```

#### 3. Instalar Docker y Docker Compose

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
apt install docker-compose -y

# Agregar usuario actual a grupo docker
usermod -aG docker $USER
```

#### 4. Clonar el Repositorio

```bash
# Instalar Git
apt install git -y

# Clonar repositorio
git clone https://github.com/tu-usuario/juego-del-impostor-backend.git
cd juego-del-impostor-backend
```

#### 5. Crear Archivo .env

```bash
nano .env
```

Copia todas las variables de entorno desde tu `.env.example` y completa los valores.

#### 6. Construir y Ejecutar con Docker

```bash
# Construir imagen
docker build -t juego-impostor-backend .

# Ejecutar contenedor
docker run -d \
  --name juego-impostor \
  --restart unless-stopped \
  -p 3001:3001 \
  --env-file .env \
  juego-impostor-backend
```

#### 7. Configurar Nginx como Reverse Proxy (Opcional pero Recomendado)

```bash
# Instalar Nginx
apt install nginx -y

# Crear configuración
nano /etc/nginx/sites-available/juego-impostor
```

Agrega esta configuración:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Habilita el sitio:
```bash
ln -s /etc/nginx/sites-available/juego-impostor /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### 8. Configurar SSL con Let's Encrypt (Recomendado)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d tu-dominio.com
```

#### 9. Configurar Firewall

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Opción 3: Docker Compose (Para Desarrollo/Producción Simple)

Crea un archivo `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3001:3001"
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Ejecuta:
```bash
docker-compose up -d
```

---

## Actualizar la Aplicación

### App Platform
- Los cambios se despliegan automáticamente cuando haces push a la rama `main`
- O puedes hacerlo manualmente desde el dashboard

### Droplet con Docker
```bash
ssh root@tu-droplet-ip
cd juego-del-impostor-backend
git pull
docker build -t juego-impostor-backend .
docker stop juego-impostor
docker rm juego-impostor
docker run -d \
  --name juego-impostor \
  --restart unless-stopped \
  -p 3001:3001 \
  --env-file .env \
  juego-impostor-backend
```

---

## Monitoreo y Logs

### App Platform
- Ve a la sección **"Runtime Logs"** en el dashboard
- Configura alertas en **"Alerts"**

### Droplet con Docker
```bash
# Ver logs
docker logs -f juego-impostor

# Ver uso de recursos
docker stats juego-impostor
```

---

## Troubleshooting

### La aplicación no inicia
1. Verifica las variables de entorno
2. Revisa los logs: `docker logs juego-impostor` o en App Platform
3. Verifica que Redis y Appwrite estén accesibles desde el servidor

### Error de conexión a Redis
- Verifica que `REDIS_HOST` sea accesible públicamente
- Si usas Redis Cloud, asegúrate de que la IP del servidor esté en la whitelist
- Verifica `REDIS_TLS` (debe ser `true` para Redis Cloud)

### Error de CORS
- Actualiza `CORS_ORIGIN` con la URL exacta de tu frontend
- Incluye el protocolo: `https://tu-dominio.com`

### Socket.io no funciona
- Verifica que el puerto esté correctamente expuesto
- Si usas Nginx, asegúrate de que el proxy esté configurado para WebSockets
- Verifica que `CORS_ORIGIN` incluya el dominio del frontend

---

## Costos Estimados

### App Platform
- **Basic Plan**: $12/mes (1GB RAM, 1 vCPU)
- **Pro Plan**: $24/mes (2GB RAM, 2 vCPU) - Para mayor carga

### Droplet
- **Basic Droplet**: $6/mes (1GB RAM, 1 vCPU)
- **Regular Droplet**: $12/mes (2GB RAM, 1 vCPU)

**Nota**: Los costos pueden variar según el uso de ancho de banda y almacenamiento.

---

## Recomendaciones

1. **Usa App Platform** si quieres simplicidad y despliegues automáticos
2. **Usa Droplet con Docker** si necesitas más control o tienes requisitos específicos
3. **Configura SSL** siempre para producción
4. **Monitorea los logs** regularmente
5. **Configura backups** de tu base de datos Appwrite
6. **Usa variables de entorno encriptadas** para todas las credenciales

---

## Siguiente Paso: Conectar el Frontend

Una vez desplegado, actualiza tu frontend para que apunte a la URL de producción:

```javascript
// En tu frontend
const API_URL = 'https://tu-backend.ondigitalocean.app'
const SOCKET_URL = 'https://tu-backend.ondigitalocean.app'
```

¡Listo! Tu backend debería estar funcionando en Digital Ocean. 🚀


