/* Metadata updates never replace the user's collection or viewing choices. */
(function (root) {
  'use strict';
  function mergeCatalog(current, incoming) {
    if (!incoming || !Number.isInteger(incoming.tmdbId) || !Array.isArray(incoming.seasons)) throw new Error('Catálogo inválido');
    if (current?.tmdbId && current.tmdbId !== incoming.tmdbId) throw new Error('La serie está vinculada a otro título');
    const result = structuredClone(current || {
      id: 'tmdb-' + incoming.tmdbId, name: incoming.name, platforms: [], status: 'Pendiente', rating: '', notes: '', seasons: []
    });
    result.tmdbId = incoming.tmdbId;
    result.catalogName = incoming.name;
    result.providersES = structuredClone(incoming.providersES);
    result.catalogCheckedAt = incoming.catalogCheckedAt;
    result.seasons ||= [];
    for (const season of incoming.seasons) {
      let target = result.seasons.find(s => s.number === season.number);
      if (!target) { target = {number: season.number, episodes: []}; result.seasons.push(target); }
      target.providersES = structuredClone(season.providersES);
      target.episodes ||= [];
      for (const episode of season.episodes) {
        const byId = target.episodes.find(e => e.tmdbEpisodeId && e.tmdbEpisodeId === episode.tmdbEpisodeId);
        const byNumber = target.episodes.find(e => e.number === episode.number && !e.tmdbEpisodeId);
        const old = byId || byNumber;
        // Conflicting identity: keep the user's entry instead of moving their seen mark.
        if (!old && target.episodes.some(e => e.number === episode.number)) continue;
        if (old) {
          old.tmdbEpisodeId = episode.tmdbEpisodeId;
          old.title = episode.title || old.title;
          old.originalAirDate = episode.originalAirDate || null;
        } else target.episodes.push({...episode, seen: false});
      }
      target.episodes.sort((a, b) => a.number - b.number);
      if (target.episodes.some(e => !e.seen)) delete target.completedAt;
    }
    result.seasons.sort((a, b) => a.number - b.number);
    return result;
  }
  function providersES(payload) {
    const data = payload?.results?.ES;
    const groups = {flatrate: 'Suscripción', free: 'Gratis', ads: 'Con anuncios', buy: 'Compra', rent: 'Alquiler'};
    const offers = [];
    for (const [key, label] of Object.entries(groups)) {
      for (const provider of data?.[key] || []) offers.push({id: provider.provider_id, name: provider.provider_name, type: key, label});
    }
    const rawLink = data?.link;
    const link = typeof rawLink === 'string' && /^https:\/\/(www\.)?themoviedb\.org\//.test(rawLink) ? rawLink : null;
    return {region: 'ES', offers, link};
  }
  function mergeImport(collection, incoming) {
    if (!Array.isArray(incoming)) throw new Error('El archivo no contiene una lista de series.');
    const result = structuredClone(collection);
    const nameKey = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    // Validate the whole file first; one broken series must not partially overwrite the library.
    for (const item of incoming) {
      if (!item || typeof item.name !== 'string' || !item.name.trim() || !Array.isArray(item.seasons)) throw new Error('Serie inválida en el archivo.');
      for (const season of item.seasons) {
        if (!Number.isInteger(Number(season.number)) || Number(season.number) < 0 || !Array.isArray(season.episodes)) throw new Error('Temporada inválida.');
        if (season.episodes.some(e => !e || !Number.isInteger(Number(e.number)) || Number(e.number) < 1)) throw new Error('Capítulo inválido.');
      }
    }
    for (const raw of incoming) {
      const item = structuredClone(raw);
      item.seasons.forEach(s => { s.number = Number(s.number); s.episodes.forEach(e => { e.number = Number(e.number); e.seen = !!e.seen; }); });
      const index = result.findIndex(s => (item.id && s.id === item.id) || nameKey(s.name) === nameKey(item.name));
      if (index < 0) { item.id ||= 'import-' + nameKey(item.name).replace(/[^a-z0-9]+/g, '-'); result.push(item); continue; }
      const old = result[index];
      const merged = {...old, ...item, id:old.id, seasons:structuredClone(old.seasons || [])};
      for (const season of item.seasons) {
        let target = merged.seasons.find(s => Number(s.number) === season.number);
        if (!target) { merged.seasons.push(season); continue; }
        for (const episode of season.episodes) {
          const epIndex = target.episodes.findIndex(e => Number(e.number) === episode.number);
          if (epIndex < 0) target.episodes.push(episode);
          else {
            const previous = target.episodes[epIndex];
            target.episodes[epIndex] = {...previous, ...episode, seen:!!previous.seen || !!episode.seen};
          }
        }
        target.completedAt ||= season.completedAt;
        target.episodes.sort((a,b) => a.number-b.number);
        if (target.episodes.some(e => !e.seen)) delete target.completedAt;
      }
      merged.seasons.sort((a,b) => a.number-b.number);
      result[index] = merged;
    }
    return result;
  }
  const api = {mergeCatalog, providersES, mergeImport};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SeriesCatalog = api;
})(typeof window === 'undefined' ? globalThis : window);
