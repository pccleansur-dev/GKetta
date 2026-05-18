# Sistema Kettal

Sistema interno para administrar la operacion diaria del local: clientes, cuentas corrientes, pedidos, ventas, caja, usuarios y seguimiento de actividad.

## Captura

![Pantalla de clientes de Sistema Kettal](./clientes-after-create.png)

## Funciones principales

- Dashboard ejecutivo con KPIs, cuentas que requieren atencion, caja del dia, pedidos activos, ventas recientes, recordatorios y actividad operativa.
- Gestion de clientes con alta, edicion, baja logica, telefono, documento, notas, vencimiento mensual y saldo inicial.
- Cuentas corrientes por cliente con saldo, estados, vencimientos y registro de pagos o ajustes.
- Pedidos con producto, sena, saldo pendiente, estado de entrega y confirmacion de pago.
- Ventas del dia con categoria, medio de pago y relacion opcional con clientes o pedidos.
- Caja diaria con apertura, ingresos, egresos, total esperado y trazabilidad de movimientos.
- Recordatorios de deuda con acceso directo a WhatsApp para contactar clientes con cuentas vencidas o proximas a vencer.
- Usuarios con roles (`owner`, `manager`, `staff`) y permisos segun el perfil.
- Auditoria de acciones relevantes para seguir altas, cambios y registros operativos.
- Setup inicial guiado para definir nombre del negocio, nueva contrasena de admin, ruta de backups y retencion.
- Restauracion desde backup JSON y backups automaticos diarios.
- Login con sesiones persistentes para uso interno del sistema.

## Stack

- `Next.js 16`
- `React 19`
- `Prisma`
- `PostgreSQL 16`
- `Docker Compose`

## Uso recomendado

### 1. Verificar entorno

```powershell
pnpm setup:check
```

### 2. Levantar el sistema

```powershell
docker compose up -d --build
```

### 3. Abrir la app

```text
http://localhost:3017
```

En una instalacion limpia, el sistema redirige automaticamente a `/setup`.

## Instalacion inicial

En el primer arranque no hay datos operativos cargados.

Estado inicial esperado:

- 1 usuario: `admin`
- 0 clientes
- 0 pedidos
- 0 ventas
- 0 movimientos de caja
- 0 sesiones

Durante el setup se define:

- nombre del negocio
- contrasena del administrador
- carpeta de backups
- retencion de backups

Despues del setup, el resto de los usuarios se crean desde la pantalla `Usuarios`.

## Acceso inicial

| Usuario | Contrasena | Rol |
|---|---|---|
| `admin` | `admin1234` | Administrador |

La contrasena se reemplaza en el wizard de configuracion inicial.

## Desarrollo local

### Arranque limpio

```powershell
Copy-Item .env.example .env
pnpm install
docker compose up -d postgres
pnpm db:setup
pnpm dev
```

Abrir `http://localhost:3000`.

## Variables de entorno

El archivo `.env.example` incluye valores de desarrollo para correr localmente.

Variables principales:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexion a Postgres |
| `POSTGRES_DB` | Nombre de la base |
| `POSTGRES_USER` | Usuario de Postgres |
| `POSTGRES_PASSWORD` | Password de Postgres para entorno local |

## Backups

- El sistema guarda backups automaticos todos los dias a las `00:00`.
- En Docker se usa la carpeta `./backups/` del proyecto.
- Si esa carpeta esta dentro de OneDrive, Dropbox o similar, los backups tambien quedan sincronizados fuera de la app.
- La deteccion de "ruta de nube" en el setup es solo una ayuda visual basada en el nombre de la carpeta.

## Scripts

| Script | Descripcion |
|---|---|
| `pnpm setup:check` | Verifica entorno local |
| `pnpm dev` | Levanta la app en desarrollo |
| `pnpm build` | Build de produccion |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm db:generate` | Genera cliente Prisma |
| `pnpm db:push` | Sincroniza esquema |
| `pnpm db:seed` | Crea el usuario inicial |
| `pnpm db:setup` | `db:generate` + `db:push` + `db:seed` |

## GitHub

Antes de subir el repo:

- no subir `.env`
- no subir `backups/`
- no subir `.playwright-mcp/`
- no subir screenshots locales de QA

La configuracion actual de `.gitignore` ya cubre esos casos.
