# Arquitectura

## Interfaz y persistencia

index.html mantiene la interfaz y el modelo histórico de colección, con misSeries.v1 en localStorage. El editor conserva metadatos de catálogo y fechas al editar cantidades de capítulos. catalog.css añade el buscador y un encabezado claro. No hay backend ni compilación.

catalog-core.js proporciona funciones de extracción de ofertas exclusivamente ES y actualización de metadatos. Se preservan los datos personales y las entradas locales ausentes de las respuestas remotas. Los episodios existentes se reconocen por identificador TMDB y, para colecciones antiguas sin ese identificador, por temporada y número. Un conflicto entre identificadores no transfiere una marca de visto.

catalog.js implementa conexión, búsqueda, vinculación explícita, descarga secuencial de temporadas y ofertas, guardado por serie y revisión diaria mientras la app está abierta. Relee el estado al terminar la descarga para conservar las marcas realizadas mientras se consulta. No vuelve a crear una serie eliminada durante una actualización. Si falla la escritura local conserva el estado en memoria anterior.

## Datos externos

Consultas HTTPS a api.themoviedb.org/3: configuration, search/tv, tv/{id}, tv/{id}/watch/providers, tv/{id}/season/{n} y tv/{id}/season/{n}/watch/providers. Autenticación por encabezado Bearer; el token se introduce en un campo de contraseña y permanece en sessionStorage separado de las series, nunca en la URL o exportación. No hay clave compartida en código ni en GitHub.

Las ofertas por serie y temporada no demuestran disponibilidad española de cada episodio. originalAirDate almacena la emisión original; no se transforma en availableFrom. Los datos manuales disponibles en colecciones antiguas conservan su significado. No se infieren calendarios españoles a partir de una periodicidad semanal.

## Caché y comprobaciones

sw.js versión mis-series-1.0.2 precarga recursos propios de interfaz. Solo intercepta esos recursos del mismo origen; nunca intercepta API externa ni persiste credenciales. Prioriza red y conserva respaldo sin conexión. La colección y el token no se gestionan mediante caché de red.

La vinculación colectiva usa matchCandidates (nombre exacto normalizado, identidad única y una sola página de resultados) y linkIdentity (solo metadatos de vínculo, sin tocar episodios). Las decisiones ambiguas quedan en el diálogo hasta que se elijan o se omitan; las ya guardadas se omiten en la siguiente ejecución. La primera copia de seguridad previa a la operación está en misSeries.v1.before-bulk-link. No contiene token ni se envía al servidor.

mergeImport valida la colección de entrada y combina temporadas y capítulos por número, con unión de marcas de visto. Conserva entradas locales que no estén en el archivo. Las claves misSeries.v1.before-import y misSeries.v1.before-catalog guardan la colección previa a la operación en el mismo dispositivo; no contienen el token y no son sincronización ni respaldo externo.

Las pruebas Node cubren conservación de progreso, campos personales, actualizaciones parciales, idempotencia, región ES, vinculación y flujo asíncrono de búsqueda/descarga con respuestas simuladas. La conexión y cobertura real de TMDB deben comprobarse con el token introducido por el usuario.
