import * as THREE from './vendor/three-0.186.0/three.module.js';

/* An original field of thin, freestanding folios. Shared instances keep the dense
   geometry inexpensive; distance-delayed springs produce the traveling wave. */
export function createArchiveScene(host, projects, callbacks) {
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.setClearColor(0xeeeDE7,0);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;
  renderer.domElement.setAttribute('aria-hidden','true');host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xf1f2e9,25,65);
  const camera=new THREE.OrthographicCamera(-10,10,6,-6,.1,100);
  const aim=new THREE.Vector3(0,1,0);camera.position.set(12,13,17);camera.lookAt(aim);
  scene.add(new THREE.HemisphereLight(0xffffff,0xa8a699,3.2));
  const sun=new THREE.DirectionalLight(0xfffcf1,3.1);sun.position.set(-9,18,8);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-22,right:22,top:25,bottom:-25,near:1,far:65});
  sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;scene.add(sun);
  const floorMaterial=new THREE.MeshStandardMaterial({color:0xe9e9df,roughness:1});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),floorMaterial);
  floor.rotation.x=-Math.PI/2;floor.position.y=-.08;floor.receiveShadow=true;scene.add(floor);
  const outline=new THREE.Shape();
  outline.moveTo(-.065,-1.3);outline.lineTo(.065,-1.3);outline.lineTo(.065,1.3);outline.lineTo(-.065,1.3);outline.closePath();
  const bodyGeometry=new THREE.ExtrudeGeometry(outline,{depth:5.25,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,steps:1});
  bodyGeometry.translate(0,0,-2.625);
  const capGeometry=new THREE.BoxGeometry(.185,.035,5.28);
  const bodyMaterial=new THREE.MeshPhysicalMaterial({color:0xf3f1e6,roughness:.63,metalness:0,clearcoat:.12});
  const capMaterial=new THREE.MeshStandardMaterial({color:0xe3e6d7,roughness:.7});
  const cells=[];
  for(let lane=-3;lane<=3;lane++)for(let col=-24;col<=24;col++)
    cells.push({col,lane,x:col*.52,z:lane*5.95,id:null,y:1.325,lift:0});
  const bodies=new THREE.InstancedMesh(bodyGeometry,bodyMaterial,cells.length);
  bodies.castShadow=true;bodies.receiveShadow=true;bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);bodies.frustumCulled=false;scene.add(bodies);
  const caps=new THREE.InstancedMesh(capGeometry,capMaterial,cells.length);
  caps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);caps.frustumCulled=false;scene.add(caps);
  const dummy=new THREE.Object3D(),neutral=new THREE.Color(0xffffff),acid=new THREE.Color(0xd0f500);
  const en=document.documentElement.lang==='en',reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const events=new AbortController(),{signal}=events;
  const textures=[],labelMaterials=[];
  // Small printed labels sit on the broad side, instead of framed cover posters.
  const labelGeometry=new THREE.PlaneGeometry(3.5,1.65);
  const labelMeshes=[];
  const labelFor=project=>{
    const canvas=document.createElement('canvas');canvas.width=700;canvas.height=330;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,700,330);
    ctx.fillStyle='#50564a';ctx.font='18px monospace';ctx.fillText('CJ / SELECTED WORKS',25,40);
    ctx.fillStyle='#20271b';ctx.font='bold 55px monospace';ctx.fillText(project?`FILE / ${project.number}`:'-- / --',25,115);
    ctx.font='bold 28px "Segoe UI","Microsoft YaHei",sans-serif';
    const title=project?project.title:(en?'UNEXPLORED':'待探索');let line='',y=173;
    for(const char of title){if(ctx.measureText(line+char).width>650){ctx.fillText(line,25,y);line='';y+=37;}line+=char;}ctx.fillText(line,25,y);
    ctx.fillStyle='#aabc25';ctx.fillRect(25,280,86,5);
    ctx.fillStyle='#79806b';ctx.font='16px monospace';ctx.fillText(project?'DESIGN / EXPERIENCE / PLAY':'THE NEXT POSSIBILITY',130,287);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false});
    labelMaterials.push(material);return material;
  };
  const labels=new Map(projects.map(p=>[p.id,labelFor(p)])),emptyLabel=labelFor(null);
  for(const cell of cells){
    const mesh=new THREE.Mesh(labelGeometry,emptyLabel);mesh.rotation.y=Math.PI/2;scene.add(mesh);labelMeshes.push(mesh);
  }
  let selected=projects[0].id,available=projects.map(p=>p.id),selectedCell=null;
  let active=true,inViewport=true,disposed=false,raf=0,previousTime=0,clock=0,pointerX=0,hovered=-1;
  let wave={x:0,z:0,start:0},pendingIntro=true,narrow=false;
  const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
  const wrap=(i,n)=>(i%n+n)%n;
  function assign(){
    const middle=Math.floor(available.length/2),chosen=available.indexOf(selected);
    cells.forEach((cell,i)=>{
      const primary=cell.lane===0&&cell.col>=-middle&&cell.col<available.length-middle;
      cell.id=primary?available[cell.col+middle] : ((cell.col+cell.lane)%4===0?null:available[wrap(cell.col+middle+cell.lane*2,available.length)]);
      cell.chosen=primary&&cell.col===chosen-middle;
      if(cell.chosen)selectedCell=cell;
      labelMeshes[i].material=labels.get(cell.id)||emptyLabel;
      caps.setColorAt(i,cell.chosen?acid:neutral);
    });
    caps.instanceColor.needsUpdate=true;
  }
  function ripple(x,z){wave={x,z,start:clock};wake();}
  function update(time){
    raf=0;if(disposed||!active||!inViewport||document.hidden)return;
    const dt=Math.min((time-previousTime)/1000||.016,.04);previousTime=time;clock+=dt;
    const amount=reduce.matches?1:1-Math.exp(-dt*8.5);
    let moving=false;
    const age=clock-wave.start;
    cells.forEach((cell,i)=>{
      const focus=selectedCell||cells[0];
      const dx=cell.x-focus.x,dz=cell.z-focus.z;
      const crest=2.15*Math.exp(-dx*dx/1.55-dz*dz/20)+(cell.chosen ? .55 : 0);
      const distance=Math.hypot((cell.x-wave.x)*.9,(cell.z-wave.z)*.65);
      const t=age-distance*.075;
      const pulse=!reduce.matches&&t>0&&t<2.6 ? Math.sin(t*5.8)*Math.exp(-t*2)*.85 : 0;
      const hover=i === hovered ? .16 : 0;
      const target=crest+pulse+hover;
      cell.lift+=(target-cell.lift)*amount;
      if(Math.abs(target-cell.lift)>.002)moving=true;
      cell.y=1.325+cell.lift;
      dummy.position.set(cell.x,cell.y,cell.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);
      dummy.position.y=cell.y+1.34;dummy.updateMatrix();caps.setMatrixAt(i,dummy.matrix);
      labelMeshes[i].position.set(cell.x+.094,cell.y+(cell.chosen ? .55 : .05),cell.z);
    });
    bodies.instanceMatrix.needsUpdate=true;caps.instanceMatrix.needsUpdate=true;
    const wanted=12+(reduce.matches?0:pointerX*.22);camera.position.x+=(wanted-camera.position.x)*amount;camera.lookAt(aim);
    moving ||= Math.abs(wanted-camera.position.x)>.002;
    const waveAlive=!reduce.matches&&age<4.4;
    host.dataset.waveState=waveAlive?'traveling':(moving?'settling':'still');
    renderer.render(scene,camera);host.dataset.ready='true';
    if(waveAlive||moving)wake();
  }
  function wake(){if(!raf&&!disposed&&active&&inViewport&&!document.hidden)raf=requestAnimationFrame(update);}
  function stop(){cancelAnimationFrame(raf);raf=0;previousTime=0;}
  function resize(){
    const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
    narrow=width<760;renderer.setSize(width,height,false);
    const span=narrow?17:13,aspect=width/height;
    aim.set(narrow ? -1 : 0,narrow ? .8 : 1,0);
    camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();wake();
  }
  function pick(event){
    const rect=host.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    ray.setFromCamera(mouse,camera);return ray.intersectObject(bodies,false)[0]?.instanceId;
  }
  let drag=null,lastWheel=0;
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;host.focus({preventScroll:true});
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};canvas.setPointerCapture(event.pointerId);
  },{signal});
  canvas.addEventListener('pointermove',event=>{
    if(drag?.id===event.pointerId){
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(Math.hypot(dx,dy)>8)drag.moved=true;
      const horizontal=Math.abs(dx)>Math.abs(dy),delta=horizontal?event.clientX-drag.lastX:event.clientY-drag.lastY;
      if(Math.abs(delta)>60){callbacks.onStep(delta<0?1:-1);drag.lastX=event.clientX;drag.lastY=event.clientY;}
      return;
    }
    pointerX=event.clientX/host.clientWidth*2-1;
    const hit=pick(event)??-1;
    if(hit!==hovered){hovered=hit;if(hit>=0)ripple(cells[hit].x,cells[hit].z);else wake();}
  },{signal});
  canvas.addEventListener('pointerup',event=>{
    if(drag?.id!==event.pointerId)return;
    if(!drag.moved){const hit=pick(event);if(hit!==undefined){const cell=cells[hit];ripple(cell.x,cell.z);if(cell.id)callbacks.onSelect(cell.id);}}
    drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  },{signal});
  for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drag=null;},{signal});
  canvas.addEventListener('pointerleave',()=>{hovered=-1;pointerX=0;wake();},{signal});
  canvas.addEventListener('wheel',event=>{
    if(event.ctrlKey||available.length<2)return;event.preventDefault();const now=performance.now();
    if(now-lastWheel>320&&Math.abs(event.deltaY)+Math.abs(event.deltaX)>8){callbacks.onStep((event.deltaY||event.deltaX)>0?1:-1);lastWheel=now;}
  },{passive:false,signal});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stop();active=false;callbacks.onFailure();},{signal});
  const observer=new ResizeObserver(resize);observer.observe(host);
  const intersection=new IntersectionObserver(entries=>{inViewport=entries[0].isIntersecting;if(inViewport)wake();else stop();});intersection.observe(host);
  document.addEventListener('visibilitychange',()=>document.hidden?stop():wake(),{signal});
  reduce.addEventListener('change',()=>wake(),{signal});
  window.addEventListener('pagehide',event=>{stop();if(!event.persisted)dispose();},{signal});
  window.addEventListener('pageshow',()=>{resize();wake();},{signal});
  function dispose(){
    if(disposed)return;disposed=true;stop();events.abort();observer.disconnect();intersection.disconnect();
    for(const geometry of [bodyGeometry,capGeometry,labelGeometry,floor.geometry])geometry.dispose();
    for(const material of [bodyMaterial,capMaterial,floorMaterial,...labelMaterials])material.dispose();
    textures.forEach(t=>t.dispose());bodies.dispose();caps.dispose();renderer.dispose();
  }
  assign();resize();
  return {
    select(id){const changed=selected!==id;selected=id;assign();if(changed||pendingIntro){pendingIntro=false;ripple(selectedCell?.x||0,0);}else wake();},
    filter(ids){available=ids;assign();wake();},
    setVisible(value){active=value;if(value){resize();wake();}else stop();},dispose
  };
}
