# Mis Series 1.0.3

Aplicación web personal para llevar el seguimiento de series y capítulos vistos. Funciona con archivos estáticos y guarda tu colección en el navegador.

## Buscar y añadir

1. Pulsa **Buscar y añadir serie**.
2. Introduce tu **API Read Access Token** de TMDB y pulsa **Conectar**. Se verifica contra TMDB y se conserva solo en esta pestaña durante la sesión, fuera de tu colección y de las copias JSON.
3. Busca por nombre y elige el título y año correctos.
4. Consulta las plataformas en España, diferenciadas por suscripción, gratis, anuncios, compra o alquiler. Elige tu plataforma si quieres y añade la serie.

Para una serie que ya tienes, abre su detalle y pulsa **Vincular con el catálogo**. Comprueba el título: esa vinculación permite añadir temporadas y capítulos sin duplicar tu colección.

También puedes pulsar **Vincular mis series**: busca todas las que no estén vinculadas, de una en una. Vincula automáticamente solo un título único con nombre exacto (también nombre original); las búsquedas con varias páginas o títulos ambiguos requieren elegir. No transfiere un mismo título a dos entradas de la colección. Cada elección muestra nombre y año. Puedes detener la búsqueda y continuar más adelante, conservando las vinculaciones ya hechas.

La vinculación colectiva conserva todos los capítulos, notas y vistos tal como estaban. Después pulsa **Actualizar temporadas** para descargar capítulos nuevos. La copia local previa a la primera vinculación colectiva se guarda separadamente del token.

## Actualizar conservando tus vistos

**Actualizar temporadas** consulta las series vinculadas a TMDB. También se revisan al conectar, abrir o volver a la app si la última comprobación tiene más de 24 horas y el token sigue disponible. No hay tareas en segundo plano con la app cerrada. Tras cerrar la sesión del navegador tendrás que volver a introducir el token.

Las actualizaciones conservan marcas de vistos, notas, valoración y plataforma elegida. No eliminan capítulos locales porque una respuesta del catálogo deje de incluirlos. Una descarga incompleta no sustituye la serie. La colección sigue en la clave local original, misSeries.v1.

## Qué significa disponibilidad en España

Las plataformas por serie y temporada proceden de JustWatch a través de TMDB, región ES. La ausencia de ofertas significa que no hay información en esa consulta, no que la serie no exista en España. Las fechas de capítulos son **emisión original**, no la fecha española de cada plataforma. La app indica que esa disponibilidad por capítulo no está confirmada y no usa esas fechas para bloquear tus marcas. Las fechas manuales de disponibilidad existentes se conservan.

Este producto usa la API de TMDB y no está respaldado ni certificado por TMDB. Los créditos de la app incluyen el aviso y logo oficiales y la atribución a JustWatch.

## Copias y privacidad

**Exportar** e **Importar** siguen disponibles como copia de seguridad y traslado entre navegadores. No hay sincronización automática entre dispositivos. El token no se exporta ni se almacena en el repositorio; las consultas autenticadas no se guardan en la caché del service worker. No borres los datos del sitio para actualizar la interfaz: ahí se conserva tu progreso.

Importar combina el progreso: un capítulo visto en cualquiera de las dos copias queda visto. No sirve para desmarcar capítulos en bloque; desmárcalos desde el detalle. Antes de importar o actualizar el catálogo se conserva una copia previa en el almacenamiento del mismo navegador. Esta copia no sustituye una exportación externa.

## Desarrollo

Ejecutar `python -m http.server 8001` y abrir http://localhost:8001. No necesita compilación. Pruebas: `node --test test_catalog.js test_catalog_flow.js`. Las pruebas de catálogo usan respuestas de prueba, no credenciales reales. Consultar [arquitectura](docs/ARQUITECTURA.md) y [cambios](CHANGELOG.md).
