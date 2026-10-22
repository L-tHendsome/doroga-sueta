// Прототип: маршрут (GPX/KML/GeoJSON или массив точек) -> массивы curv/grade для class Track.
// Шаг SEG=4 м, как в игре. Не подключён к index.html.
function parseRoute(text){
  text=text.trim();
  if(text[0]==='{'||text[0]==='['){ // GeoJSON
    const j=JSON.parse(text),pts=[];
    const walk=g=>{if(!g)return;if(g.type==='FeatureCollection')g.features.forEach(f=>walk(f.geometry));else if(g.type==='Feature')walk(g.geometry);
      else if(g.type==='LineString')g.coordinates.forEach(c=>pts.push({lat:c[1],lon:c[0],ele:c[2]}));
      else if(g.type==='MultiLineString')g.coordinates.flat().forEach(c=>pts.push({lat:c[1],lon:c[0],ele:c[2]}))};
    walk(j);return pts}
  const pts=[];
  if(/<gpx/i.test(text)){ // GPX: trkpt/rtept с <ele>
    const re=/<(?:trkpt|rtept)[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/(?:trkpt|rtept)>/g;let m;
    while((m=re.exec(text))){const e=/<ele>([-\d.]+)<\/ele>/.exec(m[3]);pts.push({lat:+m[1],lon:+m[2],ele:e?+e[1]:undefined})}
    return pts}
  const c=/<coordinates>([\s\S]*?)<\/coordinates>/i.exec(text); // KML (в т.ч. экспорт Конструктора Яндекс Карт)
  if(c)c[1].trim().split(/\s+/).forEach(t=>{const [lon,lat,ele]=t.split(',').map(Number);pts.push({lat,lon,ele})});
  return pts}

function routeToTrack(pts,{SEG=4,minRadius=30,maxGrade=.12,maxLen=12000}={}){
  // 1) в локальные метры (равнопромежуточная проекция — для маршрутов до сотен км хватает)
  const R=6371000,lat0=pts[0].lat*Math.PI/180;
  let P=pts.map(p=>({x:(p.lon-pts[0].lon)*Math.PI/180*R*Math.cos(lat0),z:-(p.lat-pts[0].lat)*Math.PI/180*R,e:p.ele}));
  // 2) равномерная перевыборка через каждые SEG м
  const out=[P[0]];let acc=0;
  for(let i=1;i<P.length&&out.length*SEG<maxLen;i++){let a=P[i-1],b=P[i],d=Math.hypot(b.x-a.x,b.z-a.z);
    while(acc+d>=SEG){const t=(SEG-acc)/d;const q={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,e:a.e!=null&&b.e!=null?a.e+(b.e-a.e)*t:undefined};out.push(q);a=q;d=Math.hypot(b.x-a.x,b.z-a.z);acc=0}
    acc+=d}
  const N=out.length-1;
  // 3) курс -> кривизна, сглаживание и ограничение радиуса (городские 90° превращаем в проходимые дуги)
  const h=[];for(let i=0;i<N;i++)h.push(Math.atan2(out[i+1].x-out[i].x,-(out[i+1].z-out[i].z)));
  let curv=new Float32Array(N+1);
  for(let i=1;i<N;i++){let d=h[i]-h[i-1];d=Math.atan2(Math.sin(d),Math.cos(d));curv[i]=d/SEG}
  const smooth=(a,w)=>{const r=new Float32Array(a.length);for(let i=0;i<a.length;i++){let s=0,n=0;for(let k=-w;k<=w;k++){const j=i+k;if(j>=0&&j<a.length){s+=a[j];n++}}r[i]=s/n}return r};
  curv=smooth(smooth(curv,4),4);
  const cmax=1/minRadius;for(let i=0;i<=N;i++)curv[i]=Math.max(-cmax,Math.min(cmax,curv[i]));
  // 4) высоты -> уклон; нет высот — плоско (можно добавить процедурные холмы)
  let grade=new Float32Array(N+1);
  if(out.every(p=>p.e!=null)){for(let i=0;i<N;i++)grade[i]=(out[i+1].e-out[i].e)/SEG;grade=smooth(smooth(grade,8),8);
    for(let i=0;i<=N;i++)grade[i]=Math.max(-maxGrade,Math.min(maxGrade,grade[i]))}
  return {length:N*SEG,curv,grade}}

if(typeof module!=='undefined')module.exports={parseRoute,routeToTrack};
