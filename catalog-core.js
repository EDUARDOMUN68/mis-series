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
  const api = {mergeCatalog, providersES};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SeriesCatalog = api;
})(typeof window === 'undefined' ? globalThis : window);
