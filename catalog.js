'use strict';
(() => {
  const TOKEN_KEY = 'misSeries.tmdbToken';
  let remembered = '';
  try { remembered = localStorage.getItem(TOKEN_KEY) || ''; } catch {}
  let token = remembered || sessionStorage.getItem(TOKEN_KEY) || '';
  let catalogBusy = false, searchGeneration = 0, selectedTitle = null, linkId = null;
  const $ = id => document.getElementById(id);
  const text = (id, value) => { $(id).textContent = value; };
  const message = value => text('catalogMessage', value);
  const dialog = $('catalogDialog');
  const rememberControl = $('rememberTMDB');
  if (rememberControl) {
    rememberControl.checked = !!remembered;
    rememberControl.onchange = () => {
      try {
        if (rememberControl.checked && token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
        message(rememberControl.checked ? 'Se recordará la conexión en este dispositivo al conectar.' : 'Conexión solo durante esta sesión.');
      } catch { rememberControl.checked = false; message('No se pudo recordar la conexión. Puedes usarla durante esta sesión.'); }
    };
  }

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
    if (version !== 'mis-series-1.0.10') throw new Error('La app está renovando su versión. Recarga la página y vuelve a conectar; no borres los datos del sitio.');
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
      sessionStorage.setItem(TOKEN_KEY, token);
      if (rememberControl?.checked) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
      input.value = '';
      $('catalogConnection').hidden = true; message(rememberControl?.checked ? 'TMDB conectado. Se recordará en este dispositivo.' : 'TMDB conectado durante esta sesión.');
      refreshCatalog(true);
    } catch(e) { token = previous; message(e.message); }
    finally { $('connectTMDB').disabled = false; }
  };
  $('disconnectTMDB').onclick = () => {
    token = ''; sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); if (rememberControl) rememberControl.checked = false; $('tmdbToken').value = '';
    message('Token eliminado de este dispositivo y de esta sesión. Tus series siguen guardadas.');
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
  function showRefreshSummary(rows) {
    let panel = $('catalogSummary');
    if (!panel) {
      panel = document.createElement('details'); panel.id = 'catalogSummary';
      $('catalogStatus').after(panel);
    }
    panel.replaceChildren(); panel.open = true;
    const heading = document.createElement('summary');
    const ok = rows.filter(r => !r.error);
    heading.textContent = `Resumen: ${ok.length} series consultadas · ${ok.reduce((n,r)=>n+r.seasons,0)} temporadas nuevas · ${ok.reduce((n,r)=>n+r.episodes,0)} capítulos nuevos · ${rows.length-ok.length} errores`;
    panel.append(heading);
    const list = document.createElement('ul');
    for (const row of rows) {
      const item = document.createElement('li');
      item.textContent = row.name + ': ' + (row.error ? 'No se pudo actualizar. Se conservan sus datos.' : row.seasons || row.episodes ? `${row.seasons} temporadas nuevas y ${row.episodes} capítulos nuevos.` : 'Sin temporadas ni capítulos nuevos.');
      list.append(item);
    }
    panel.append(list);
    const note = document.createElement('p'); note.textContent = 'Tus vistos y notas se conservan. Los capítulos nuevos no confirman disponibilidad en España.';
    panel.append(note);
  }
  window.refreshCatalog = async function (automatic = false) {
    if (catalogBusy) return;
    if (!token) { if (!automatic) openCatalog(); return; }
    const linked = series.filter(s => s.tmdbId && (!automatic || (s.catalogCheckedAt && Date.now() - Date.parse(s.catalogCheckedAt) > 24*60*60*1000))).map(s => ({id:s.id, tmdbId:s.tmdbId}));
    if (!linked.length) { if (!automatic) text('catalogStatus','Vincula tus series desde su detalle para actualizar las temporadas.'); return; }
    catalogBusy = true; $('refreshCatalog').disabled = true;
    let count = 0, failures = 0; const rows = [];
    try {
      for (const s of linked) {
        text('catalogStatus', `Actualizando ${count + failures + 1} de ${linked.length}…`);
        try {
          const incoming = await download(s.tmdbId);
          const before = series.find(item => item.id === s.id);
          const updated = commitCatalog(s.id, incoming, '');
          rows.push({name:updated.name, ...SeriesCatalog.catalogChanges(before, updated)}); count++;
        } catch { rows.push({name:series.find(item=>item.id===s.id)?.name || 'Serie eliminada', error:true}); failures++; }
      }
      text('catalogStatus', `${count} series actualizadas${failures ? '; ' + failures + ' sin actualizar (se conservan sus datos)' : ''}.`);
      showRefreshSummary(rows);
    } finally { catalogBusy = false; $('refreshCatalog').disabled = false; }
  };

  const originalOpen = window.openSeries;
  window.openSeries = function (id) {
    originalOpen(id); const s = series.find(x => x.id === id); if (!s) return;
    const panel = document.createElement('section'); panel.className = 'catalog-info';
    panel.innerHTML = `<h3>Dónde verla · España</h3>${s.tmdbId ? offersHTML(s.providersES) + attributionLink(s.providersES) + `<p class="muted">${s.catalogCheckedAt ? 'Temporadas consultadas: ' + esc(new Date(s.catalogCheckedAt).toLocaleDateString('es-ES')) : 'Vinculada. Pulsa Actualizar temporadas para consultar capítulos nuevos.'} Plataformas: JustWatch vía TMDB.</p>` : '<p>Vincula esta serie para consultar plataformas y capítulos nuevos.</p>'}`;
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

  let bulkRunning = false, bulkStop = false, bulkChoiceButtons = [];
  const bulkDialog = $('bulkDialog');
  function storeLink(id, title, providers) {
    // Always apply to the latest collection so marks made during network calls survive.
    const next = SeriesCatalog.linkIdentity(series, id, title, providers);
    const previous = localStorage.getItem(KEY);
    if (previous && !localStorage.getItem(KEY + '.before-bulk-link')) localStorage.setItem(KEY + '.before-bulk-link', previous);
    localStorage.setItem(KEY, JSON.stringify(next));
    series = next; render();
  }
  function rowMessage(row, value) { row.querySelector('.bulk-state').textContent = value; }
  async function linkChoice(id, title, row) {
    if (catalogBusy) return;
    catalogBusy = true;
    rowMessage(row,'Vinculando…');
    try {
      const providers = SeriesCatalog.providersES(await api(`tv/${title.id}/watch/providers`));
      storeLink(id,title,providers); rowMessage(row,`Vinculada con ${title.name}. Tus vistos siguen intactos.`);
      row.querySelector('.bulk-choices').replaceChildren();
    } catch(e) { rowMessage(row,e.message); }
    finally { catalogBusy=false; }
  }
  function renderChoices(id, candidates, row) {
    const choices=row.querySelector('.bulk-choices'); choices.replaceChildren();
    for (const title of candidates) {
      const button=document.createElement('button'); button.className='secondary';
      button.disabled=bulkRunning;bulkChoiceButtons.push(button);
      const country=title.origin_country?.length ? ' · '+title.origin_country.join(', ') : '';
      button.textContent=`${title.name} · ${title.first_air_date?.slice(0,4) || 'año sin confirmar'}${country}${title.overview ? ' — '+title.overview.slice(0,180) : ''}`;
      button.onclick=()=>linkChoice(id,title,row); choices.append(button);
    }
    const manual=document.createElement('button');manual.className='secondary';manual.textContent='Buscar otro título';
    manual.disabled=bulkRunning;bulkChoiceButtons.push(manual);
    manual.onclick=()=>{if(catalogBusy)return;bulkDialog.close();openCatalog(id);};choices.append(manual);
    const skip=document.createElement('button');skip.className='secondary';skip.textContent='Dejar sin vincular';
    skip.disabled=bulkRunning;bulkChoiceButtons.push(skip);
    skip.onclick=()=>{if(catalogBusy)return;choices.replaceChildren();rowMessage(row,'Sin vincular. Puedes intentarlo de nuevo más adelante.');};choices.append(skip);
  }
  window.bulkLinkSeries = async function () {
    if(catalogBusy || bulkRunning) { text('catalogStatus','Hay una consulta en curso. Espera a que termine.');return; }
    if(!token){openCatalog();message('Conecta TMDB una vez. Después pulsa Vincular mis series.');return;}
    $('bulkRows').replaceChildren();bulkChoiceButtons=[];text('bulkStatus','Preparando búsqueda…');
    if(!bulkDialog.open)bulkDialog.showModal();
    const pending=series.filter(s=>!s.tmdbId).map(s=>({id:s.id,name:s.name}));
    if(!pending.length){text('bulkStatus','Todas tus series ya están vinculadas. Puedes actualizar sus temporadas.');return;}
    bulkRunning=true;bulkStop=false;catalogBusy=true;
    $('bulkStart').disabled=true;
    let linked=0,review=0,errors=0;
    try {
      for(let i=0;i<pending.length;i++) {
        if(bulkStop)break;
        const item=pending[i];
        // The series may have been removed or linked in another action during this run.
        if(!series.some(s=>s.id===item.id&&!s.tmdbId))continue;
        text('bulkStatus',`Buscando ${i+1} de ${pending.length}: ${item.name}`);
        const row=document.createElement('article');row.className='bulk-row';
        row.innerHTML='<strong></strong><p class="bulk-state" role="status"></p><div class="bulk-choices"></div>';
        row.querySelector('strong').textContent=item.name;$('bulkRows').append(row);
        rowMessage(row,'Buscando coincidencias…');
        try {
          const payload=await api('search/tv',{query:item.name,include_adult:'false'});
          if(bulkStop){rowMessage(row,'Búsqueda detenida, sin cambios.');break;}
          const match=SeriesCatalog.matchCandidates(item.name,payload,series.filter(s=>s.tmdbId).map(s=>s.tmdbId));
          if(match.automatic){
            const providers=SeriesCatalog.providersES(await api(`tv/${match.automatic.id}/watch/providers`));
            if(bulkStop){rowMessage(row,'Detenido sin vincular esta serie.');break;}
            storeLink(item.id,match.automatic,providers);linked++;
            rowMessage(row,`Vinculada: ${match.automatic.name} (${match.automatic.first_air_date?.slice(0,4)||'sin año'}). Vistos conservados.`);
          }else{
            review++;rowMessage(row,match.candidates.length?'Elige el título y año correctos. No se ha cambiado esta serie.':'No hay una coincidencia disponible. Puedes buscar con otro nombre.');
            renderChoices(item.id,match.candidates,row);
          }
        }catch(e){errors++;rowMessage(row,e.message);renderChoices(item.id,[],row);}
      }
      text('bulkStatus',`${bulkStop?'Búsqueda detenida. ':''}${linked} vinculadas automáticamente; ${review} por elegir; ${errors} consultas fallidas. Total: ${series.filter(s=>s.tmdbId).length} de ${series.length} vinculadas. Después puedes pulsar Actualizar temporadas.`);
      text('catalogStatus',`${series.filter(s=>s.tmdbId).length} de ${series.length} series vinculadas. Tus vistos se conservan.`);
    }finally{bulkRunning=false;catalogBusy=false;$('bulkStart').disabled=false;bulkChoiceButtons.forEach(button=>button.disabled=false);}
  };
  $('bulkClose').onclick=()=>{bulkStop=true;bulkDialog.close();};
  $('bulkStop').onclick=()=>{bulkStop=true;text('bulkStatus','Deteniendo tras la consulta actual. Las series ya vinculadas se conservan.');};
  $('bulkRefresh').onclick=()=>{if(catalogBusy)return;bulkDialog.close();refreshCatalog();};
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshCatalog(true); });
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).catch(() => {});
  if (token) refreshCatalog(true);
})();
