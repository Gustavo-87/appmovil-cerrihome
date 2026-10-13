const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const profile='/tmp/cerritos-offline-browser-profile';
const url=process.env.CERRITOS_TEST_URL||'http://127.0.0.1:5176';
(async()=>{
 const options={headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']};
 let context=await chromium.launchPersistentContext(profile,options);
 try{
  const page=await context.newPage();await page.goto(url);
  await page.evaluate(async()=>{window.offline=await import('/src/offline.ts');});
  await context.setOffline(true);
  const id=await page.evaluate(async()=>{
   const entry=await window.offline.enqueue('browser-user','enter_vehicle',{p_plate:'XYZ987',p_driver:'Ana',p_unit:'Casa 9',p_reason:'Visita',p_note:'Novedad sin conexión'});
   const data=window.offline.projectQueue({reservations:[],vehicles:[],incidents:[]},await window.offline.getQueue('browser-user'));
   if(!data.vehicles.some(row=>row.id===entry.id&&row.syncStatus==='pending'))throw new Error('Missing local vehicle');
   return entry.id;
  });
  await context.close();context=await chromium.launchPersistentContext(profile,options);
  const reopened=await context.newPage();await reopened.goto(url);
  const result=await reopened.evaluate(async(id)=>{
   const store=await import('/src/offline.ts'),queue=await store.getQueue('browser-user');
   const exists=queue.some(entry=>entry.id===id&&entry.status==='pending');
   await store.synchronize('browser-user',async()=>{});
   const confirmed=(await store.getQueue('browser-user')).find(entry=>entry.id===id)?.status==='confirmed';
   return {exists,confirmed,other:await store.getQueue('another-user')};
  },id);
  assert.equal(result.exists,true);assert.equal(result.confirmed,true);assert.deepEqual(result.other,[]);
  console.log('PASS: IndexedDB real en Chromium, registro con red desactivada, cierre y reapertura del navegador, aislamiento y sincronización simulada');
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exit(1);});
