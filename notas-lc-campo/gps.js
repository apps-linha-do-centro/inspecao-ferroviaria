/* The browser can obtain GPS without internet; availability depends on the device.
   Never turn a manual position or an old stored fix into a new GPS reading. */
(function(g){
function once(geolocation,options){return new Promise((resolve,reject)=>{
 let settled=false;const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value)};
 const timer=setTimeout(()=>finish(reject,{code:3,message:'Tempo de localização excedido'}),options.timeout+100);
 try{geolocation.getCurrentPosition(p=>{
  const c=p?.coords;if(!Number.isFinite(c?.latitude)||!Number.isFinite(c?.longitude)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||!Number.isFinite(c.accuracy)||c.accuracy<0){finish(reject,{code:2,message:'Leitura GPS inválida'});return}
  finish(resolve,p);
 },e=>finish(reject,e),options)}catch(e){finish(reject,e)}
})}
async function read({allowRecent=false,timeout=25000,recentTimeout=8000,maxAge=60000}={}){
 const geo=g.navigator?.geolocation;if(!geo)throw {code:2,message:'GPS indisponível'};
 try{return {fix:await once(geo,{enableHighAccuracy:true,timeout,maximumAge:0}),reused:false}}
 catch(error){
  if(error.code===1||!allowRecent)throw error;
  // A recent browser fix is offered explicitly for confirmation; never silent reuse.
  const fix=await once(geo,{enableHighAccuracy:false,timeout:recentTimeout,maximumAge:maxAge});
  const age=Date.now()-Number(fix.timestamp);
  if(!Number.isFinite(age)||age< -5000||age>maxAge)throw {code:3,message:'A última leitura GPS está antiga'};
  return {fix,reused:true};
 }
}
g.LCGPS={read};
})(typeof globalThis!=='undefined'?globalThis:window);
