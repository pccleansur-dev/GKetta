# Instalacion desde cero

Guia corta para dejar el sistema funcionando en una PC nueva.

## Requisitos

Instalar:

- `Node.js` LTS
- `pnpm`
- `Docker Desktop`

Verificaciones utiles:

```powershell
node --version
pnpm --version
docker version
```

## 1. Abrir la carpeta del proyecto

En PowerShell, ubicarse dentro del repo:

```powershell
cd "C:\Sistemas\Sistema Kettal"
```

## 2. Verificar entorno

```powershell
pnpm setup:check
```

## 3. Levantar el sistema

```powershell
docker compose up -d --build
```

La primera vez puede tardar varios minutos.

## 4. Abrir la app

```text
http://localhost:3017
```

En una base vacia, el sistema abre el wizard de configuracion inicial.

## 5. Configurar desde cero

### Paso 1

Definir el nombre del negocio.

### Paso 2

Elegir una contrasena nueva para el usuario inicial:

- usuario: `admin`

### Paso 3

Definir la carpeta de backups.

Notas:

- en Docker, la carpeta por defecto es `./backups`
- si esa carpeta esta dentro de OneDrive, Dropbox o similar, los backups tambien se sincronizan fuera de la app
- el mensaje de deteccion de nube es solo una ayuda visual basada en el nombre de la ruta

### Paso 4

Confirmar y entrar al sistema.

## Estado inicial esperado

Antes de cargar informacion real, la base queda asi:

- `1` usuario: `admin`
- `0` clientes
- `0` pedidos
- `0` ventas
- `0` movimientos de caja

Los demas usuarios se crean luego desde `Usuarios`.

## Acceso inicial

| Usuario | Contrasena inicial | Rol |
|---|---|---|
| `admin` | `admin1234` | Administrador |

La contrasena se cambia en el setup.

## Reset limpio

Si queres volver a probar una instalacion desde cero:

```powershell
docker compose down -v
docker compose up -d --build
```

## Problemas comunes

### No abre `http://localhost:3017`

- verificar que Docker Desktop este corriendo
- verificar que los contenedores hayan levantado bien

```powershell
docker compose ps
docker compose logs app --tail 50
```

### Quiero reinstalar todo

```powershell
docker compose down -v
docker compose up -d --build
```

Eso borra la base de datos local y vuelve a dejar una instalacion limpia.
