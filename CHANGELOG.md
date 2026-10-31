# Registro de cambios

## 1.0.0 — 31 de octubre de 2026

- Buscador TMDB y consulta de plataformas en España por serie y temporada, con categorías de oferta y atribución a JustWatch.
- Vinculación de series existentes y descarga de nuevas temporadas y capítulos conservando vistos, notas, valoración y plataforma elegida.
- Conexión mediante token de lectura introducido por el usuario, guardado durante la sesión y excluido de exportaciones y caché de red.
- Actualización manual y revisión diaria al conectar o volver a primer plano mientras existe conexión con TMDB.
- Distinción entre emisión original y disponibilidad española por capítulo sin confirmar.
- Editor conserva metadatos y fechas; cálculo del día local en Europe/Madrid. Cabecera clara y caché de interfaz actualizada.
- Verificación automatizada del catálogo con respuestas simuladas; la prueba real requiere conectar el token del usuario.

La versión anterior usaba caché mis-series-v11 y formato de exportación 1. Se mantiene la colección misSeries.v1 y ese formato de copia.
