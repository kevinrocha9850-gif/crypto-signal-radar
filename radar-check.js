const SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','DOTUSDT'];

function ema(a,p){const k=2/(p+1),out=[a[0]];let e=a[0];for(let i=1;i<a.length;i++){e=a[i]*k+e*(1-k);out.push(e)}return out}
function rsi(a,p=14){
  if(a.length<p+1)return a.map(()=>50);
  let g=0,l=0;
  for(let i=1;i<=p;i++){const d=a[i]-a[i-1];g+=Math.max(d,0);l+=Math.max(-d,0)}
  g/=p;l/=p;
  const out=Array(p).fill(50);
  out.push(100-100/(1+g/(l||1e-9)));
  for(let i=p+1;i<a.length;i++){
    const d=a[i]-a[i-1];
    g=(g*(p-1)+Math.max(d,0))/p;
    l=(l*(p-1)+Math.max(-d,0))/p;
    out.push(100-100/(1+g/(l||1e-9)));
  }
  return out
}
function macd(a){
  const f=ema(a,12),s=ema(a,26),m=a.map((_,i)=>f[i]-s[i]),sig=ema(m,9);
  return {m,sig,h:m.map((x,i)=>x-sig[i])}
}
function structureState(c){
  if(c.length<16)return 'NEUTRAL';
  const a=c.slice(-8),b=c.slice(-16,-8);
  const ah=Math.max(...a),bh=Math.max(...b),al=Math.min(...a),bl=Math.min(...b);
  if(ah>bh&&al>bl)return 'ALCISTA';
  if(ah<bh&&al<bl)return 'BAJISTA';
  return 'NEUTRAL'
}
function analyze(rows){
  if(!rows||rows.length<80)return null;
  const closed=rows.filter(x=>x.closed);
  if(closed.length<80)return null;
  const c=closed.map(x=>+x.close),v=closed.map(x=>+x.volume),i=c.length-1;
  const e20=ema(c,20),e50=ema(c,50),R=rsi(c),M=macd(c);
  const prior=v.slice(Math.max(0,i-20),i);
  const avg=prior.reduce((a,b)=>a+b,0)/(prior.length||1);
  const vr=v[i]/(avg||1);
  const trend=c[i]>e20[i]&&e20[i]>e50[i]?'ALCISTA':c[i]<e20[i]&&e20[i]<e50[i]?'BAJISTA':'LATERAL';
  const structure=structureState(c);
  const priceAbove=c[i]>e20[i], emaAligned=c[i]>e20[i]&&e20[i]>e50[i], emaUp=e20[i]>e20[i-3];
  const bull=M.m[i]>M.sig[i], histUp=M.h[i]>M.h[i-1], rsiValue=R[i];
  const recentLow=Math.min(...c.slice(-20,-1)),recentHigh=Math.max(...c.slice(-20,-1));
  const nearSupport=c[i]<=recentLow*1.012&&c[i]>c[Math.max(0,i-1)];
  const nearResistance=c[i]>=recentHigh*0.988;
  const ret4=c[i-4]?c[i]/c[i-4]-1:0;
  const ret12=c[i-12]?c[i]/c[i-12]-1:0;
  const distEma20=c[i]/e20[i]-1;
  const range20=Math.max(...c.slice(-20))-Math.min(...c.slice(-20));
  const position20=range20>0?(c[i]-Math.min(...c.slice(-20)))/range20:0.5;
  const recentHigh12=Math.max(...c.slice(-12,-1));
  const breakoutRecent=c[i]>recentHigh12;
  const pullbackReclaim=nearSupport&&c[i]>c[Math.max(0,i-1)];
  const earlyMomentum=ret4>=0.0015&&ret4<=0.028&&ret12<=0.055;
  const notExtended=distEma20<=0.025&&position20<=0.88&&rsiValue<=70;
  const notLate=ret12<=0.06&&!(nearResistance&&ret4>0.02);
  const earlyEntry=(earlyMomentum||pullbackReclaim||breakoutRecent)&&notExtended&&notLate;

  let score=0;
  score+=trend==='ALCISTA'?25:trend==='LATERAL'?10:0;
  score+=structure==='ALCISTA'?15:structure==='NEUTRAL'?7:0;
  score+=emaAligned?10:(priceAbove||emaUp?6:0);
  score+=nearSupport?10:(priceAbove?5:0);
  score+=bull?10:4;
  score+=histUp?5:0;
  const volumeState=vr>=1.5?'FUERTE':vr>=1.0?'CONFIRMA':vr>=0.65?'NEUTRO':'DEBIL';
  score+=volumeState==='FUERTE'?10:(volumeState==='CONFIRMA'?7:(volumeState==='NEUTRO'?4:0));
  score+=(rsiValue>=50&&rsiValue<=68)?10:((rsiValue>=40&&rsiValue<50)||(rsiValue>68&&rsiValue<=72)?5:0);
  if(!earlyEntry)score-=12;
  score=Math.min(100,Math.max(0,Math.round(score)));

  const criticalBearish=trend==='BAJISTA'&&structure==='BAJISTA'&&!bull&&vr>=1.2;
  const weakStructureAgainst=trend==='BAJISTA'&&structure==='BAJISTA';
  const invalid=criticalBearish||(weakStructureAgainst&&rsiValue<46);
  return {p:c[i],R:rsiValue,trend,structure,vr,score,earlyEntry,
    entryStage:earlyEntry?'TEMPRANA':'AVANZADA',volumeState,criticalBearish,invalid,time:closed[i].time}
}
async function fetchMarket(symbol,tf,limit=220){
  const bases=[
    'https://data-api.binance.vision/api/v3',
    'https://api.binance.com/api/v3',
    'https://api1.binance.com/api/v3',
    'https://api2.binance.com/api/v3',
    'https://api3.binance.com/api/v3'
  ];
  let last='';
  for(const base of bases){
    try{
      const u=base+'/klines?symbol='+encodeURIComponent(symbol)+'&interval='+tf+'&limit='+limit;
      const r=await fetch(u,{cache:'no-store'});
      if(!r.ok){last='HTTP '+r.status;continue}
      const d=await r.json();
      if(!Array.isArray(d)||!d.length)throw Error('Respuesta vacía');
      return d.map(x=>({time:x[0],open:x[1],high:x[2],low:x[3],close:x[4],volume:x[5],closed:Date.now()>x[6]}));
    }catch(e){last=e.message||String(e)}
  }
  throw Error('Binance: '+last);
}
function combined(h,m){
  if(!h||!m)return null;
  const confidence=Math.round(h.score*.60+m.score*.40);
  const critical=h.invalid||(h.trend==='BAJISTA'&&m.trend==='BAJISTA'&&h.structure==='BAJISTA'&&m.structure==='BAJISTA');
  const buy=confidence>=70&&h.score>=60&&m.score>=65&&m.earlyEntry&&!critical;
  const invalid=critical;
  let signal=buy?'🟢 COMPRAR':'🟡 MANTENER';
  if(invalid)signal='🔴 SALIR';
  return {signal,buy,invalid,confidence,p:m.p,hScore:h.score,mScore:m.score,
    rsi:m.R,volume:m.vr,entry:m.entryStage,time:m.time,
    reason:buy
      ?`Confluencia favorable: 1h ${h.score}/100 + 15m ${m.score}/100 + entrada temprana.`
      :invalid
        ?'La hipótesis alcista perdió validez por una contradicción estructural relevante.'
        :`Confluencia insuficiente, entrada tardía o sin configuración completa: 1h ${h.score}/100 + 15m ${m.score}/100.`
  }
}

export default async function handler(req,res){
  const secret=process.env.NTFY_CRON_SECRET;
  if(secret && req.headers['x-cron-secret']!==secret)
    return res.status(401).json({ok:false,error:'Unauthorized'});

  const results={};
  const errors=[];
  for(const s of SYMBOLS){
    try{
      const [hRows,mRows]=await Promise.all([fetchMarket(s,'1h',220),fetchMarket(s,'15m',220)]);
      const h=analyze(hRows),m=analyze(mRows);
      results[s]=combined(h,m);
    }catch(e){errors.push(`${s}: ${e.message||e}`)}
  }
  return res.status(200).json({ok:true,generatedAt:Date.now(),results,errors});
}
