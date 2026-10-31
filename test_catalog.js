'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {mergeCatalog, providersES} = require('./catalog-core');
const incoming = () => ({tmdbId:9, name:'Título actualizado', catalogCheckedAt:'2026-10-31', providersES:{region:'ES',offers:[{name:'Netflix'}]}, seasons:[{number:1, providersES:{region:'ES',offers:[]}, episodes:[{number:1,tmdbEpisodeId:91,title:'Nuevo título',originalAirDate:'2026-10-01'},{number:2,tmdbEpisodeId:92,title:'Nuevo capítulo',originalAirDate:'2026-11-08'}]}]});
const current = () => ({id:'mi-serie', name:'Mi nombre', notes:'No borrar',rating:'9',status:'Viendo',platforms:['Mi plataforma'],seasons:[{number:1,completedAt:'2026-10-02',episodes:[{number:1,title:'Antiguo',seen:true,availableFrom:'2026-10-02',personalNote:'Conservar'}]}]});
test('preserva identidad, vistos, notas, plataforma, estado, fecha española y campos personales', () => {
  const old = current(), original = structuredClone(old), updated=mergeCatalog(old,incoming());
  for(const key of ['id','name','notes','rating','status','platforms']) assert.deepEqual(updated[key],old[key]);
  const ep=updated.seasons[0].episodes[0];
  assert.equal(ep.seen,true); assert.equal(ep.availableFrom,'2026-10-02'); assert.equal(ep.personalNote,'Conservar');
  assert.equal(ep.title,'Nuevo título'); assert.equal(updated.seasons[0].episodes[1].seen,false);
  assert.equal(updated.seasons[0].completedAt,undefined); assert.deepEqual(old,original);
});
test('actualizar repetidamente no duplica capítulos ni impone fechas originales como disponibilidad',()=>{
  const first=mergeCatalog(current(),incoming()); first.seasons[0].episodes[1].seen=true;
  const next=mergeCatalog(first,incoming()); assert.equal(next.seasons[0].episodes.length,2);
  assert.equal(next.seasons[0].episodes[1].seen,true); assert.equal(next.seasons[0].episodes[1].availableFrom,undefined);
});
test('catálogo parcial no borra temporadas ni capítulos locales',()=>{
  const old=current();old.seasons[0].episodes.push({number:8,seen:true});old.seasons.push({number:3,episodes:[{number:1,seen:true}]});
  const updated=mergeCatalog(old,incoming());assert.equal(updated.seasons.length,2);assert.equal(updated.seasons[0].episodes.find(e=>e.number===8).seen,true);
});
test('identificadores diferentes nunca heredan una marca por simple número',()=>{
  const old=current();old.seasons[0].episodes[0].tmdbEpisodeId=999;
  const updated=mergeCatalog(old,incoming());assert.equal(updated.seasons[0].episodes[0].tmdbEpisodeId,999);assert.equal(updated.seasons[0].episodes.length,2);
});
test('rechaza vincular una serie ya identificada con otro título',()=>{
  const old=current();old.tmdbId=10;assert.throws(()=>mergeCatalog(old,incoming()));
});
test('nueva serie empieza pendiente y sin episodios vistos',()=>{
  const next=mergeCatalog(null,incoming());assert.equal(next.id,'tmdb-9');assert.equal(next.status,'Pendiente');assert.equal(next.seasons[0].episodes[0].seen,false);
});
test('solo devuelve España y diferencia suscripción y compra; no acepta enlaces ajenos',()=>{
  const result=providersES({results:{US:{flatrate:[{provider_name:'USA'}]},ES:{link:'https://evil.example',flatrate:[{provider_id:1,provider_name:'Netflix'}],buy:[{provider_id:2,provider_name:'Apple TV'}]}}});
  assert.deepEqual(result.offers.map(o=>o.type),['flatrate','buy']);assert.equal(result.link,null);
  assert.equal(providersES({}).offers.length,0);
});
test('fallo o ausencia de oferta no inventa disponibilidad española',()=>{
  const next=mergeCatalog(current(),{...incoming(),providersES:providersES({results:{US:{}}})});assert.equal(next.providersES.offers.length,0);
});
test('la edición manual conserva metadatos y las exportaciones no incluyen credenciales',()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const html=fs.readFileSync(__dirname+'/index.html','utf8'), source=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  new vm.Script(source);
  assert.ok(source.includes('const obj={...old,id'));assert.ok(source.includes('return{...prev,number:j+1'));
  assert.ok(source.includes('JSON.stringify({version:1,exportedAt:new Date().toISOString(),series}'));
});
test('importar una copia marcada recupera vistos sobre una colección inicial a cero',()=>{
  const {mergeImport}=require('./catalog-core');
  const old=current();old.seasons[0].episodes[0].seen=false;old.tmdbId=9;
  const backup=current();backup.seasons[0].episodes[0].seen=true;
  const result=mergeImport([old],[backup]);
  assert.equal(result[0].seasons[0].episodes[0].seen,true);assert.equal(result[0].tmdbId,9);
  assert.equal(result.length,1);assert.equal(old.seasons[0].episodes[0].seen,false);
});
test('importar no desmarca vistos más recientes, no borra ausentes y no duplica tras repetir',()=>{
  const {mergeImport}=require('./catalog-core');const old=current();old.seasons[0].episodes.push({number:2,seen:true});
  const incoming=current();incoming.seasons[0].episodes[0].seen=false;
  const once=mergeImport([old],[incoming]);const twice=mergeImport(once,[incoming]);
  assert.equal(twice[0].seasons[0].episodes.length,2);assert.ok(twice[0].seasons[0].episodes.every(e=>e.seen));
});
test('archivo malformado se rechaza sin modificar la colección',()=>{
  const {mergeImport}=require('./catalog-core');const old=[current()],copy=structuredClone(old);
  assert.throws(()=>mergeImport(old,[current(),{name:'Rota',seasons:[{number:1,episodes:null}]}]));assert.deepEqual(old,copy);
});
test('vinculación colectiva: solo coincidencia exacta única, no remakes ni páginas incompletas',()=>{
  const {matchCandidates}=require('./catalog-core');
  const title={id:9,name:'La casa del dragón',original_name:'House of the Dragon'};
  assert.equal(matchCandidates('La casa del dragon',{results:[title],total_pages:1}).automatic.id,9);
  assert.equal(matchCandidates('House of the Dragon',{results:[title]}).automatic.id,9);
  assert.equal(matchCandidates('Dragón',{results:[title]}).automatic,null);
  assert.equal(matchCandidates(title.name,{results:[title,{...title,id:10}],total_pages:1}).automatic,null);
  assert.equal(matchCandidates(title.name,{results:[title],total_pages:2}).automatic,null);
  assert.equal(matchCandidates(title.name,{results:[title]},[9]).automatic,null);
});
test('vincular identidad conserva todos los episodios, marcas y notas; evita dobles vínculos',()=>{
  const {linkIdentity}=require('./catalog-core'), collection=[current()], snapshot=structuredClone(collection);
  const linked=linkIdentity(collection,'mi-serie',{id:9,name:'TMDB'}, {region:'ES',offers:[]});
  assert.equal(linked[0].tmdbId,9);assert.deepEqual(linked[0].seasons,snapshot[0].seasons);assert.equal(linked[0].notes,'No borrar');
  assert.deepEqual(collection,snapshot);assert.equal(linked[0].catalogCheckedAt,undefined);
  assert.throws(()=>linkIdentity([...linked,{...current(),id:'otra'}],'otra',{id:9,name:'TMDB'},{}));
  assert.throws(()=>linkIdentity(collection,'eliminada',{id:9,name:'TMDB'},{}));
});

 test('summary counts new season and episode numbers, not changed titles or watched marks', () => {
 const {catalogChanges} = require('./catalog-core.js');
 const before = {seasons:[{number:1,episodes:[{number:1,seen:true}]}]};
 const after = {seasons:[{number:1,episodes:[{number:1,title:'Nuevo',seen:true},{number:2}]},{number:2,episodes:[{number:1}]}]};
 assert.deepEqual(catalogChanges(before,after),{seasons:1,episodes:2});
 assert.deepEqual(catalogChanges(after,after),{seasons:0,episodes:0});
 });
