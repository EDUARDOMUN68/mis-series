const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('./catalog-core');

function harness({failSeason=false, onSeason=()=>{}}={}) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id,{id, value:'', hidden:false, children:[], textContent:'',innerHTML:'', disabled:false,
      append(x){this.children.push(x)},replaceChildren(){this.children=[];this.innerHTML=''}, focus(){},showModal(){this.open=true},close(){this.open=false}});
    return nodes.get(id);
  };
  const store = new Map(), session = new Map(), routes=[];
  const context = vm.createContext({console, structuredClone, URL, AbortSignal, Date,SeriesCatalog:core,
    document:{getElementById:node,createElement:()=>({}),addEventListener(){},visibilityState:'visible'},
    sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
    localStorage:{setItem:(k,v)=>store.set(k,v)},
    async fetch(url,opts){
      assert.equal(opts.headers.Authorization,'Bearer TEST_ONLY'); assert.equal(url.origin,'https://api.themoviedb.org'); routes.push(url.pathname);
      let data={};
      if(url.pathname.endsWith('/search/tv')) data={results:[{id:9,name:'Mi serie',first_air_date:'2026-01-01'}]};
      else if(url.pathname.endsWith('/watch/providers')) data={results:{ES:{flatrate:[{provider_id:8,provider_name:'Netflix'}]},US:{flatrate:[{provider_name:'No mostrar'}]}}};
      else if(url.pathname==='/3/tv/9') data={name:'Mi serie',seasons:[{season_number:1}]};
      else if(url.pathname==='/3/tv/9/season/1') {onSeason(context);if(failSeason)return{ok:false,status:500};data={episodes:[{id:91,episode_number:1,name:'Actualizado',air_date:'2026-10-01'},{id:92,episode_number:2,name:'Nuevo',air_date:'2026-11-01'}]};}
      return {ok:true,json:async()=>data};
    }});
  vm.runInContext(`window=globalThis; const KEY='misSeries.v1';let series=[{id:'mio',name:'Mi serie',notes:'Nota privada',status:'Viendo',platforms:['HBO'],seasons:[{number:1,episodes:[{number:1,seen:false,title:'Uno'}]}]}];function esc(s){return String(s??'').replaceAll('<','&lt;')}function norm(s){return s.toLowerCase()}function render(){} function openSeries(){} function seasonHtml(){return ''}function exportData(){return JSON.stringify(series)}`,context);
  vm.runInContext(fs.readFileSync(__dirname+'/catalog.js','utf8'),context);
  return {node,store,session,context,routes};
}
async function start(h){
  h.context.openCatalog('mio');h.node('tmdbToken').value='TEST_ONLY';await h.node('connectTMDB').onclick();
  h.node('catalogQuery').value='Mi serie';await h.node('catalogSearchForm').onsubmit({preventDefault(){}});
  await h.node('catalogResults').children[0].onclick();h.node('catalogTarget').value='mio';
}
test('flujo completo: conectar, buscar, proveedores ES y actualizar sin perder un visto marcado durante descarga',async()=>{
  const h=harness({onSeason:c=>vm.runInContext('series[0].seasons[0].episodes[0].seen=true',c)});await start(h);
  assert.ok(h.node('catalogPreview').innerHTML.includes('Netflix'));assert.ok(!h.node('catalogPreview').innerHTML.includes('No mostrar'));
  await h.node('catalogAdd').onclick();
  const saved=JSON.parse(h.store.get('misSeries.v1'))[0];assert.equal(saved.seasons[0].episodes[0].seen,true);assert.equal(saved.notes,'Nota privada');assert.deepEqual(saved.platforms,['HBO']);assert.equal(saved.seasons[0].episodes.length,2);
  assert.equal(h.node('tmdbToken').value,'');assert.ok(!h.store.get('misSeries.v1').includes('TEST_ONLY'));assert.equal(h.session.size,1);
});
test('fallo de temporada no escribe colección parcial y permite reintentar',async()=>{
  const h=harness({failSeason:true});await start(h);await h.node('catalogAdd').onclick();
  assert.equal(h.store.size,0);assert.equal(h.node('catalogAdd').disabled,false);assert.ok(h.node('catalogMessage').textContent.includes('conservan'));
});
test('una serie borrada durante la descarga no reaparece',async()=>{
  const h=harness({onSeason:c=>vm.runInContext('series=[]',c)});await start(h);await h.node('catalogAdd').onclick();
  assert.equal(h.store.size,0);assert.ok(h.node('catalogMessage').textContent.includes('eliminada'));
});
test('desconectar elimina token sin borrar colección',async()=>{
  const h=harness();await start(h);h.node('disconnectTMDB').onclick();assert.equal(h.session.size,0);assert.equal(h.store.size,0);
});
