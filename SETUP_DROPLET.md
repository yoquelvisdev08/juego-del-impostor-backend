# Guía Rápida: Configurar en Droplet

Sigue estos pasos en orden dentro de tu Droplet:

## 1. Instalar Node.js y pnpm

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version
npm --version

# Instalar pnpm globalmente
sudo npm install -g pnpm

# Verificar pnpm
pnpm --version
```

## 2. Navegar al directorio del proyecto

```bash
cd juego-del-impostor-backend
```

## 3. Crear archivo .env

```bash
# Copiar el ejemplo
cp .env.example .env

# Editar el archivo .env con tus credenciales
nano .env
```

**Importante**: Completa todas las variables con tus valores reales:
- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_GAMES_COLLECTION_ID`
- `APPWRITE_PLAYERS_COLLECTION_ID`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `REDIS_TLS` (normalmente `true` para Redis Cloud)
- `CORS_ORIGIN` (URL de tu frontend, ej: `https://tu-dominio.com`)
- `GEMINI_API_KEY`
- `NODE_ENV=production`
- `PORT=3001`

Guarda con `Ctrl+O`, `Enter`, `Ctrl+X`

## 4. Instalar dependencias

```bash
pnpm install
```

## 5. Compilar el proyecto

```bash
pnpm build
```

## 6. Probar que funciona (opcional)

```bash
# Ejecutar temporalmente para verificar
pnpm start
```

Si ves `[Server] Servidor corriendo en puerto 3001`, presiona `Ctrl+C` para detenerlo.

## 7. Instalar PM2 (Process Manager)

PM2 mantendrá tu aplicación corriendo y la reiniciará automáticamente si se cae.

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Iniciar la aplicación con PM2
pm2 start dist/server.js --name juego-impostor

# Ver el estado
pm2 status

# Ver logs en tiempo real
pm2 logs juego-impostor

# Configurar PM2 para iniciar al arrancar el servidor
pm2 startup
pm2 save
```

## 8. Configurar el Firewall

```bash
# Permitir SSH (importante, no lo cierres)
sudo ufw allow 22/tcp

# Permitir el puerto de la aplicación
sudo ufw allow 3001/tcp

# Permitir HTTP y HTTPS (si vas a usar Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Activar firewall
sudo ufw enable

# Verificar estado
sudo ufw status
```

## 9. Verificar que funciona

```bash
# Desde el mismo servidor, probar localmente
curl http://localhost:3001/health
```

Deberías recibir: `{"status":"ok","timestamp":...}`

## 10. (Opcional) Configurar Nginx como Reverse Proxy

Si quieres usar un dominio y SSL, configura Nginx:

```bash
# Instalar Nginx
sudo apt install nginx -y

# Crear configuración
sudo nano /etc/nginx/sites-available/juego-impostor
```

Pega esta configuración (reemplaza `tu-dominio.com` con tu dominio):

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
sudo ln -s /etc/nginx/sites-available/juego-impostor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 11. (Opcional) Configurar SSL con Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d tu-dominio.com
```

## Comandos Útiles de PM2

```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs juego-impostor

# Reiniciar aplicación
pm2 restart juego-impostor

# Detener aplicación
pm2 stop juego-impostor

# Eliminar de PM2
pm2 delete juego-impostor

# Monitoreo en tiempo real
pm2 monit
```

## Verificar desde fuera del servidor

Abre tu navegador o usa curl desde tu máquina local:

```bash
# Si usas el puerto directo
curl http://TU-IP-DEL-DROPLET:3001/health

# Si usas Nginx con dominio
curl http://tu-dominio.com/health
```

## Troubleshooting

### La aplicación no inicia
```bash
# Ver logs detallados
pm2 logs juego-impostor --lines 50

# Verificar variables de entorno
cat .env
```

### Error de conexión a Redis
- Verifica que `REDIS_HOST` sea correcto
- Si usas Redis Cloud, agrega la IP del Droplet a la whitelist
- Verifica que `REDIS_TLS=true` si Redis Cloud lo requiere

### Error de CORS
- Asegúrate de que `CORS_ORIGIN` tenga la URL exacta de tu frontend
- Incluye el protocolo: `https://tu-dominio.com`

### El puerto no responde
```bash
# Verificar que la app esté corriendo
pm2 status

# Verificar que el puerto esté abierto
sudo netstat -tlnp | grep 3001

# Verificar firewall
sudo ufw status
```

## Actualizar la aplicación

Cuando hagas cambios:

```bash
cd juego-del-impostor-backend
git pull
pnpm install
pnpm build
pm2 restart juego-impostor
```

¡Listo! Tu aplicación debería estar corriendo en producción. 🚀

