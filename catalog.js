'use strict';
(() => {
  const TOKEN_KEY = 'misSeries.tmdbToken';
  let token = sessionStorage.getItem(TOKEN_KEY) || '';
  let catalogBusy = false, searchGeneration = 0, selectedTitle = null, linkId = null;
  const $ = id => document.getElementById(id);
  const text = (id, value) => { $(id).textContent = value; };
  const message = value => text('catalogMessage', value);
  const dialog = $('catalogDialog');

  async function checkCacheVersion() {
    // The legacy worker cached every URL, including external API calls. Wait for the safe worker.
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return;
    const controller = navigator.serviceWorker.controller;
    const version = await new Promise(resolve => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 6000);
      channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
      controller.postMessage('SERIES_CACHE_VERSION', [channel.port2]);
    });
    if (version !== 'mis-series-1.0.1') throw new Error('La app está renovando su versión. Recarga la página y vuelve a conectar; no borres los datos del sitio.');
  }

  async function api(path, params = {}) {
    if (!token) throw new Error('Conecta TMDB desde el botón Conectar.');
    await checkCacheVersion();
    const url = new URL('https://api.themoviedb.org/3/' + path);
    url.searchParams.set('language', 'es-ES');
    Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
    let response;
    try { response = await fetch(url, {headers: {Authorization: 'Bearer ' + token}, cache: 'no-store', signal: AbortSignal.timeout(20000)}); }
    catch { throw new Error('No se pudo consultar TMDB. Comprueba la conexión y vuelve a intentarlo.'); }
    if (!response.ok) throw new Error(response.status === 401 ? 'El token no es válido. Copia el token de acceso de lectura de TMDB.' : response.status === 429 ? 'TMDB ha limitado las consultas. Inténtalo más tarde.' : 'TMDB no pudo completar la consulta. Se conservan tus datos.');
    return response.json();
  }

  function offersHTML(data) {
    if (!data?.offers?.length) return '<p class="muted">Sin plataformas registradas para España. No significa que no esté disponible.</p>';
    return '<div class="provider-offers">' + data.offers.map(p => `<span>${esc(p.name)} · ${esc(p.label)}</span>`).join('') + '</div>';
  }
  function attributionLink(data) {
    return data?.link ? `<a href="${esc(data.link)}" target="_blank" rel="noopener noreferrer">Consultar dónde verla en España ↗</a>` : '';
  }

  window.openCatalog = function (existingId = null) {
    linkId = existingId; selectedTitle = null; searchGeneration++;
    $('catalogPreview').replaceChildren(); $('catalogResults').replaceChildren();
    const current = series.find(s => s.id === existingId);
    text('catalogHeading', current ? 'Vincular «' + current.name + '»' : 'Buscar una serie');
    $('catalogQuery').value = current?.name || '';
    $('catalogConnection').hidden = !!token;
    message(current ? 'Elige el título correcto para actualizar esta serie sin perder tus vistos.' : 'Busca una serie y consulta sus plataformas en España.');
    if (!dialog.open) dialog.showModal();
    $('catalogQuery').focus();
  };
  $('catalogClose').onclick = () => { searchGeneration++; dialog.close(); };
  $('connectionToggle').onclick = () => { $('catalogConnection').hidden = !$('catalogConnection').hidden; };
  $('connectTMDB').onclick = async () => {
    const input = $('tmdbToken');
    const candidate = input.value.trim().replace(/^Bearer\s+/i, '');
    if (!candidate) return message('Pega el API Read Access Token en el campo de conexión.');
    const previous = token; token = candidate;
    $('connectTMDB').disabled = true; message('Comprobando conexión…');
    try {
      await api('configuration');
      sessionStorage.setItem(TOKEN_KEY, token); input.value = '';
      $('catalogConnection').hidden = true; message('TMDB conectado en esta pestaña. Ya puedes buscar.');
      refreshCatalog(true);
    } catch(e) { token = previous; message(e.message); }
    finally { $('connectTMDB').disabled = false; }
  };
  $('disconnectTMDB').onclick = () => {
    token = ''; sessionStorage.removeItem(TOKEN_KEY); $('tmdbToken').value = '';
    message('Token eliminado de esta sesión. Tus series siguen guardadas.');
  };
  $('catalogSearchForm').onsubmit = async event => {
    event.preventDefault(); const query = $('catalogQuery').value.trim();
    if (!query) return;
    const generation = ++searchGeneration;
    $('catalogResults').replaceChildren(); $('catalogPreview').replaceChildren();
    message('Buscando…');
    try {
      const payload = await api('search/tv', {query, include_adult: 'false'});
      if (generation !== searchGeneration) return;
      const titles = payload.results || [];
      message(titles.length ? 'Selecciona el título y el año correctos.' : 'No se encontraron series. Prueba el título original.');
      for (const title of titles.slice(0, 12)) {
        const button = document.createElement('button'); button.className = 'catalog-result secondary';
        button.textContent = title.name + (title.first_air_date ? ' · ' + title.first_air_date.slice(0,4) : '');
        button.onclick = () => preview(title); $('catalogResults').append(button);
      }
    } catch(e) { if (generation === searchGeneration) message(e.message); }
  };
  async function preview(title) {
    const generation = ++searchGeneration; selectedTitle = null;
    $('catalogPreview').replaceChildren(); message('Consultando plataformas en España…');
    try {
      const providers = SeriesCatalog.providersES(await api('tv/' + title.id + '/watch/providers'));
      if (generation !== searchGeneration) return;
      selectedTitle = title;
      const already = series.find(s => s.tmdbId === title.id);
      const suggested = series.filter(s => !s.tmdbId && norm(s.name) === norm(title.name));
      const targetId = already?.id || linkId || (suggested.length === 1 ? suggested[0].id : null);
      $('catalogPreview').innerHTML = `<h3>${esc(title.name)}</h3><p>${esc(title.overview || 'Sin sinopsis en español.')}</p><strong>Plataformas en España</strong>${offersHTML(providers)}${attributionLink(providers)}
        <label for="catalogTarget">Guardar como</label><select id="catalogTarget"><option value="">Nueva serie</option>${series.filter(s => !s.tmdbId || s.tmdbId === title.id).map(s => `<option value="${esc(s.id)}" ${s.id === targetId ? 'selected' : ''}>Actualizar mi serie: ${esc(s.name)}</option>`).join('')}</select>
        <label for="catalogPlatform">Mi plataforma (opcional)</label><select id="catalogPlatform"><option value="">Conservar mi elección / elegir después</option>${[...new Set(providers.offers.map(p=>p.name))].map(p=>`<option>${esc(p)}</option>`).join('')}</select>
        <p class="hint">Las plataformas de una serie o temporada no confirman qué capítulos están disponibles en España. Las fechas del catálogo son de emisión original.</p><button id="catalogAdd" class="blue">Añadir o actualizar conservando mis vistos</button>`;
      $('catalogAdd').onclick = () => addSelected(title);
      message('Elige tu plataforma y añade la serie, o vincúlala a una que ya tienes.');
    } catch(e) { if (generation === searchGeneration) message(e.message); }
  }

  async function download(id) {
    const detail = await api('tv/' + id);
    const providers = SeriesCatalog.providersES(await api('tv/' + id + '/watch/providers'));
    if (!Array.isArray(detail.seasons)) throw new Error('TMDB no devolvió las temporadas. No se modificó la serie.');
    const seasons = [];
    // Fetch sequentially: bounded requests and no partial collection writes.
    for (const season of detail.seasons) {
      if (season.season_number <= 0) continue;
      const data = await api(`tv/${id}/season/${season.season_number}`);
      const availability = SeriesCatalog.providersES(await api(`tv/${id}/season/${season.season_number}/watch/providers`));
      if (!Array.isArray(data.episodes)) throw new Error('Temporada incompleta: no se guardó la actualización.');
      seasons.push({number: season.season_number, providersES: availability, episodes: data.episodes.map(e => ({number:e.episode_number, tmdbEpisodeId:e.id, title:e.name || 'Episodio ' + e.episode_number, originalAirDate:e.air_date || null, availabilityES:'unconfirmed', seen:false}))});
    }
    return {tmdbId:id, name:detail.name, providersES:providers, seasons, catalogCheckedAt:new Date().toISOString()};
  }
  function commitCatalog(targetId, incoming, platformChoice) {
    // Re-read current data after downloading: user may have toggled seen meanwhile.
    let index = series.findIndex(s => s.id === targetId);
    if (targetId && index < 0) throw new Error('La serie fue eliminada durante la consulta. No se ha vuelto a añadir.');
    if (!targetId) index = series.findIndex(s => s.tmdbId === incoming.tmdbId);
    const updated = SeriesCatalog.mergeCatalog(index < 0 ? null : series[index], incoming);
    if (platformChoice) updated.platforms = [platformChoice];
    const next = series.slice();
    if (index < 0) next.push(updated); else next[index] = updated;
    const previous = localStorage.getItem(KEY);
    if (previous) localStorage.setItem(KEY + '.before-catalog', previous);
    localStorage.setItem(KEY, JSON.stringify(next)); // Storage failure leaves in-memory data intact too.
    series = next; render();
    return updated;
  }
  async function addSelected(title) {
    if (catalogBusy || selectedTitle?.id !== title.id) return;
    const target = $('catalogTarget').value, choice = $('catalogPlatform').value;
    catalogBusy = true; $('catalogAdd').disabled = true; message('Descargando temporadas y capítulos…');
    try {
      const incoming = await download(title.id);
      const updated = commitCatalog(target, incoming, choice);
      searchGeneration++; dialog.close();
      $('q').value = ''; $('platform').value = ''; $('status').value = ''; render(); openSeries(updated.id);
      text('catalogStatus', 'Serie guardada. Se han conservado tus vistos y notas.');
    } catch(e) { message(e.message); }
    finally { catalogBusy = false; if ($('catalogAdd')) $('catalogAdd').disabled = false; }
  }
  window.refreshCatalog = async function (automatic = false) {
    if (catalogBusy) return;
    if (!token) { if (!automatic) openCatalog(); return; }
    const linked = series.filter(s => s.tmdbId && (!automatic || !s.catalogCheckedAt || Date.now() - Date.parse(s.catalogCheckedAt) > 24*60*60*1000)).map(s => ({id:s.id, tmdbId:s.tmdbId}));
    if (!linked.length) { if (!automatic) text('catalogStatus','Vincula tus series desde su detalle para actualizar las temporadas.'); return; }
    catalogBusy = true; $('refreshCatalog').disabled = true;
    let count = 0, failures = 0;
    try {
      for (const s of linked) {
        text('catalogStatus', `Actualizando ${count + failures + 1} de ${linked.length}…`);
        try { commitCatalog(s.id, await download(s.tmdbId), ''); count++; }
        catch { failures++; }
      }
      text('catalogStatus', `${count} series actualizadas${failures ? '; ' + failures + ' sin actualizar (se conservan sus datos)' : ''}.`);
    } finally { catalogBusy = false; $('refreshCatalog').disabled = false; }
  };

  const originalOpen = window.openSeries;
  window.openSeries = function (id) {
    originalOpen(id); const s = series.find(x => x.id === id); if (!s) return;
    const panel = document.createElement('section'); panel.className = 'catalog-info';
    panel.innerHTML = `<h3>Dónde verla · España</h3>${s.tmdbId ? offersHTML(s.providersES) + attributionLink(s.providersES) + `<p class="muted">Consulta: ${esc(new Date(s.catalogCheckedAt).toLocaleDateString('es-ES'))}. Plataformas: JustWatch vía TMDB.</p>` : '<p>Vincula esta serie para consultar plataformas y capítulos nuevos.</p>'}`;
    const button = document.createElement('button'); button.className = 'secondary'; button.textContent = s.tmdbId ? 'Consultar otro título / vinculación' : 'Vincular con el catálogo';
    button.onclick = () => { $('seriesDetail').close(); openCatalog(id); }; panel.append(button);
    $('seriesDetailContent').append(panel);
  };
  const originalSeason = window.seasonHtml;
  window.seasonHtml = function (s, season) {
    let html = originalSeason(s, season);
    if (!s.tmdbId) return html;
    const info = `<div class="season-catalog"><strong>Temporada ${season.number} · España</strong>${offersHTML(season.providersES)}<p>Fechas de emisión original; disponibilidad por capítulo en España sin confirmar. Puedes marcar los que ya has visto.</p></div>`;
    html = html.replace('<div class="season-actions">', info + '<div class="season-actions">');
    return html;
  };
  const originalExport = window.exportData;
  // Export already serializes only `series`; the token is deliberately outside that model.
  window.exportData = originalExport;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshCatalog(true); });
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).catch(() => {});
  if (token) refreshCatalog(true);
})();
