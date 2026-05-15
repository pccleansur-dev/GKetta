# PRD Kettal Plan

## Objetivo

Dejar el sistema listo para seguir desde una base estable: configuracion local clara, backend consumible por API, flujos principales consistentes y una ronda final de pulido operativo antes de sumar mas alcance.

## Estado actual actualizado

- App montada con `Next.js 16`, `React 19`, `Prisma` y `PostgreSQL`.
- Hay entorno Docker y flujo local documentado.
- Existe capa backend por `route handlers` bajo `src/app/api` y servicios compartidos en `src/server`.
- El login y logout ya consumen API, sin depender de server actions del front.
- Los modulos principales ya quedaron separados del backend de Next a nivel UI:
  - clientes
  - cuentas corrientes
  - pedidos
  - ventas
  - usuarios
- Los accesos rapidos del header ya abren paneles en:
  - nuevo cliente
  - registrar venta
  - cargar pedido
- Ya existe criterio visual comun para paneles emergentes:
  - se abren sobre la misma pantalla
  - usan query params (`panel=...`)
  - mantienen CTA visible
  - estan pensados para no depender de scroll interno del formulario

## Lo que ya se completo

### Configuracion base

- Flujo de arranque y setup mejorado.
- `README.md` actualizado con arranque recomendado.
- `proxy.ts` alineado con convencion actual de Next.
- Script `db:setup` agregado y flujo Docker preparado para seed.

### Separacion front / backend

- Capa `src/server` creada para consultas, auth y helpers.
- API JSON agregada para auth, session, dashboard, clientes, cuentas, pedidos, ventas, usuarios, caja, auditoria y recordatorios.
- Front migrado a `fetch` en los flujos principales de operacion.

### UX operativa

- `clientes` migrado a panel emergente para alta y edicion.
- `cuentas-corrientes` migrado a panel emergente para registrar pago.
- `pedidos` migrado a panel emergente para alta y edicion.
- `ventas` ya usa panel emergente para registrar venta.
- `usuarios` ya usa panel para alta, edicion y password.

## Pendientes reales segun el codigo actual

### Prioridad alta

- Corregir textos con encoding roto que siguen visibles en multiples pantallas.
  - se ve en labels, estados y copies de varias vistas
- Hacer una pasada completa de QA funcional de punta a punta.
  - login
  - crear cliente
  - registrar pago
  - crear pedido
  - registrar venta
  - crear y editar usuario
- Revisar responsive real de todos los paneles en mobile.
  - clientes
  - cuentas corrientes
  - pedidos
  - ventas
  - usuarios

### Prioridad media

- Unificar feedback y validaciones de formularios.
  - errores mas claros
  - estados disabled consistentes
  - mensajes de exito homogéneos
- Revisar consistencia de datos entre modulos.
  - pagos y caja
  - pedidos, seña y ventas
  - usuarios y auditoria
- Completar revision de permisos por rol en cada endpoint y accion visible.

### Prioridad media / baja

- `caja` y `recordatorios` siguen mas cerca del patron server-rendered clasico.
  - no es bloqueo, pero todavia no siguen el mismo desacople visual de los modulos CRUD
- Definir si hace falta panel para acciones manuales en recordatorios.
- Evaluar filtros utiles:
  - clientes vencidos
  - pedidos por estado
  - ventas por fecha
  - auditoria por actor y accion

### Calidad y cierre

- Agregar o terminar la pasada minima de pruebas automatizadas sobre flujos criticos.
- Hacer revision manual con base vacia y con seed.
- Limpiar artefactos de trabajo antes de cierre final si no se van a versionar.
  - snapshots locales
  - archivos temporales de QA

## Conclusión de estado

- No parece faltar una separacion grande entre front y backend en los flujos principales: esa parte ya quedo bastante avanzada.
- Lo que falta ahora es mas de cierre, pulido, QA y consistencia que de arquitectura base.
- Si se quisiera declarar “terminado”, antes conviene cerrar:
  1. encoding
  2. QA funcional completa
  3. responsive real de paneles
  4. repaso final de permisos, caja y recordatorios

## Orden sugerido para la ultima pasada

1. Corregir encoding visible en toda la app.
2. Hacer QA manual de los flujos principales.
3. Revisar paneles en mobile y ajustar lo que falte.
4. Confirmar consistencia de datos entre cuentas, pedidos, ventas y caja.
5. Limpiar detalles finales y recien ahi considerar cierre.
