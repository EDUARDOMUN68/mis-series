# 1.0.12 — Información al pie sin repeticiones

Notas y plataformas al pie, después de Editar/Guardar. Retiradas plataformas y avisos repetidos dentro de cada temporada. El pie conserva diferencias de plataformas por temporada cuando existen.

# 1.0.11 — Marcar varios capítulos y guardar

Eliminar pasa arriba en rojo. Guardar queda abajo en verde. Marcar capítulos o temporadas mantiene abierta la ficha y no reconstruye sus desplegables; se guardan conjuntamente al pulsar Guardar. Escape pide confirmación si hay marcas pendientes. Editar guarda previamente las marcas; borrar sigue requiriendo confirmación.

# 1.0.10 — Acciones compactas

Buscar, Vincular y Actualizar en una fila. Eliminado texto inicial de conexión de la pantalla principal; se mantienen avisos de progreso y resultados.

# 1.0.9 — Cabecera compacta

Título y versión en una sola línea para ahorrar espacio vertical, también en móvil.

# 1.0.8 — Nuevo icono

Icono de colección de series con pantalla y reproducción, fondo claro, azul y coral. PNG 192 y 512 para Android y manifest con zona segura para máscara.

# 1.0.7 — Recordar conexión

Opción voluntaria para recordar TMDB en este navegador. Sin marcarla se mantiene solo durante la sesión. Olvidar token elimina ambas copias sin borrar la colección. El token queda fuera de exportaciones y caché.

# 1.0.6 — Apertura compatible durante actualizaciones

El detalle ya no depende de la función nueva de catalog-core para separar temporadas. Permite abrir fichas aunque el navegador conserve una copia anterior de ese recurso.

# 1.0.5 — Temporadas futuras y vacías

Las temporadas del catálogo sin capítulos se ocultan con una nota. Las que solo contienen episodios con fecha original futura y ninguno visto se agrupan en Próximas temporadas. Sin fecha confirmada permanecen visibles; no se infiere disponibilidad española. No se borran datos.

# 1.0.4 — Resumen de actualización

Al actualizar temporadas se muestra un resumen desplegable con temporadas y capítulos añadidos, series sin novedades y errores por serie. Se conservan vistos y notas.

# Registro de cambios

## 1.0.3 — 31 de octubre de 2026

- Opciones ambiguas con país y sinopsis para distinguir series con el mismo título y año. Prioridad a coincidencias exactas entre las opciones, con búsqueda manual alternativa.
- El resultado de vinculación muestra también el total de series ya vinculadas.

## 1.0.2 — 31 de octubre de 2026

- Botón Vincular mis series: búsqueda colectiva, coincidencias exactas y únicas, elección manual de títulos dudosos con año y posibilidad de detener/reanudar.
- Vinculación conserva identidad local, episodios, vistos y notas; impide vincular un mismo título a dos entradas. La descarga de nuevas temporadas sigue siendo una operación separada.
- Buscador local renombrado Buscar en mis series y corregido orden de estilos para aplicar cabecera clara.

## 1.0.1 — 31 de octubre de 2026

- Importar una copia recupera los vistos del archivo y conserva los ya marcados en el navegador. Una colección inicial sin vistos ya no anula el progreso del archivo importado.
- La importación valida el archivo completo antes de guardar y no elimina temporadas o episodios locales ausentes del archivo.
- Copia local previa a importar o actualizar catálogo, separada del token. Conserva vinculación de catálogo al importar copias anteriores.

## 1.0.0 — 31 de octubre de 2026

- Buscador TMDB y consulta de plataformas en España por serie y temporada, con categorías de oferta y atribución a JustWatch.
- Vinculación de series existentes y descarga de nuevas temporadas y capítulos conservando vistos, notas, valoración y plataforma elegida.
- Conexión mediante token de lectura introducido por el usuario, guardado durante la sesión y excluido de exportaciones y caché de red.
- Actualización manual y revisión diaria al conectar o volver a primer plano mientras existe conexión con TMDB.
- Distinción entre emisión original y disponibilidad española por capítulo sin confirmar.
- Editor conserva metadatos y fechas; cálculo del día local en Europe/Madrid. Cabecera clara y caché de interfaz actualizada.
- Verificación automatizada del catálogo con respuestas simuladas; la prueba real requiere conectar el token del usuario.

La versión anterior usaba caché mis-series-v11 y formato de exportación 1. Se mantiene la colección misSeries.v1 y ese formato de copia.
