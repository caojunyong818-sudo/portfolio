import * as THREE from './vendor/three-0.186.0/three.module.js';

/* Original cartridge geometry and lighting, built from the portfolio's own media. */
export function createArchiveScene(host, projects, callbacks) {
  const renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xebece5, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.setAttribute('aria-hidden','true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6,6,4,-4,.1,80);
  const aim = new THREE.Vector3(0,2.4,0);
  camera.position.set(6,7.8,15);
  camera.lookAt(aim);
  scene.add(new THREE.HemisphereLight(0xffffff,0x849077,3));
  const sun = new THREE.DirectionalLight(0xfff9e7,4.2);
  sun.position.set(-4,9,5);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-18,right:18,top:14,bottom:-14,near:1,far:45});
  sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xedffe0,1.2);fill.position.set(5,4,-3);scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({opacity:.16}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.08;floor.receiveShadow=true;scene.add(floor);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(42,.12,1.25),new THREE.MeshStandardMaterial({color:0xc6cabe,roughness:.72}));
  rail.position.set(0,0,-1.4);rail.receiveShadow=true;scene.add(rail);
  const railLine = new THREE.Mesh(new THREE.BoxGeometry(42,.018,.025),new THREE.MeshBasicMaterial({color:0x666f59}));
  railLine.position.set(0,.07,-.81);scene.add(railLine);

  const bodyMaterial = new THREE.MeshPhysicalMaterial({color:0xf1f1df,roughness:.32,metalness:.08,clearcoat:.35});
  const paperMaterial = new THREE.MeshStandardMaterial({color:0xfcf9eb,roughness:.84});
  const darkMaterial = new THREE.MeshStandardMaterial({color:0x30392d,roughness:.6});
  const trimMaterial = new THREE.MeshStandardMaterial({color:0xb5beaa,roughness:.46,metalness:.3});
  const acidMaterial = new THREE.MeshStandardMaterial({color:0xd0f500,roughness:.45,emissive:0x334000,emissiveIntensity:.12});
  const bodyGeometry = new THREE.BoxGeometry(2.5,3.45,.24);
  const faceGeometry = new THREE.PlaneGeometry(2.1,2.52);
  const textures = [], ownGeometries = [], ownMaterials = [];
  const en = document.documentElement.lang === 'en';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = projects[0].id, available=projects.map(p=>p.id), raf=0, previousTime=0;
  let active=true, inViewport=true, disposed=false, hovered=null, pointerX=0;
  let narrow=host.clientWidth<760;
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const events = new AbortController(), signal = events.signal;
  const objects = projects.map((project,index) => {
    const group = new THREE.Group();
    group.userData.projectId=project.id;
    const body = new THREE.Mesh(bodyGeometry,bodyMaterial);
    body.castShadow=true;body.receiveShadow=true;group.add(body);
    function box(w,h,d,x,y,z,material) {
      const geometry=new THREE.BoxGeometry(w,h,d);ownGeometries.push(geometry);
      const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);group.add(mesh);return mesh;
    }
    box(2.23,2.67,.04,0,.03,.145,paperMaterial);
    box(.09,3.24,.045,-1.19,0,.15,trimMaterial);
    box(.09,3.24,.045,1.19,0,.15,trimMaterial);
    const tab=box(.72,.21,.26,.74,1.81,0,acidMaterial);
    box(2.5,.07,.28,0,-1.63,0,trimMaterial);
    const strip=box(1.55,.06,.045,-.18,-1.43,.155,darkMaterial);
    const canvas=document.createElement('canvas');canvas.width=630;canvas.height=756;
    const ctx=canvas.getContext('2d');
    function draw(image) {
      ctx.fillStyle='#f8f7eb';ctx.fillRect(0,0,630,756);
      ctx.fillStyle='#283025';ctx.font='bold 25px monospace';ctx.fillText(`CJ / ARCHIVE ${project.number}`,30,50);
      ctx.fillStyle='#7b826f';ctx.font='15px monospace';ctx.fillText('DESIGN / EXPERIENCE / PLAY',30,78);
      ctx.fillStyle='#20261e';ctx.fillRect(30,108,570,324);
      if(image) {
        const scale=Math.min(570/image.width,324/image.height);
        ctx.drawImage(image,30+(570-image.width*scale)/2,108+(324-image.height*scale)/2,image.width*scale,image.height*scale);
      } else {
        ctx.fillStyle='#d0f500';ctx.font='bold 43px monospace';ctx.fillText('TEXT → MOTION',58,292);
      }
      ctx.fillStyle='#22281e';ctx.font=`bold ${en ? 29 : 34}px "Segoe UI","Microsoft YaHei",sans-serif`;
      let y=493,line='';
      for(const letter of project.title) {
        if(ctx.measureText(line+letter).width>560){ctx.fillText(line,30,y);y+=42;line='';}
        line+=letter;
      }
      ctx.fillText(line,30,y);
      ctx.fillStyle='#77806b';ctx.font='16px monospace';
      ctx.fillText(project.code.slice(0,35),30,617);
      ctx.fillStyle='#d0f500';ctx.fillRect(30,648,570,64);
      ctx.fillStyle='#22281e';ctx.font='bold 25px monospace';ctx.fillText(`FILE ${project.number}   /   SELECT TO EXPLORE`,45,689);
      for(let b=0;b<52;b++){ctx.fillStyle='#30392b';ctx.fillRect(30+b*6,727,1+(b*7%3),15);}
    }
    draw();
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.push(texture);
    const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});ownMaterials.push(material);
    const face=new THREE.Mesh(faceGeometry,material);face.position.set(0,0,.178);group.add(face);
    if(project.image) {
      const image=new Image();image.decoding='async';
      image.onload=()=>{if(disposed)return;draw(image);texture.needsUpdate=true;wake();};
      image.src=project.image;
    }
    const target={x:(index-(projects.length-1)/2)*.64,y:1.85,z:-1.4,rotation:-.44,scale:.82};
    group.position.set(target.x,target.y-1.4,target.z);group.rotation.y=target.rotation;group.scale.setScalar(.82);
    scene.add(group);
    return {id:project.id,group,body,tab,strip,target};
  });

  // Repeated real files and clearly marked empty slots extend beyond the viewport.
  // Copies share geometry and textures with the original files.
  const emptyCanvas=document.createElement('canvas');emptyCanvas.width=630;emptyCanvas.height=756;
  const ec=emptyCanvas.getContext('2d');
  ec.fillStyle='#e9ecdf';ec.fillRect(0,0,630,756);
  ec.strokeStyle='#b1b8a1';ec.lineWidth=2;
  for(let y=100;y<710;y+=50){ec.beginPath();ec.moveTo(35,y);ec.lineTo(595,y);ec.stroke();}
  ec.fillStyle='#68715b';ec.font='22px monospace';ec.fillText('CJ / OPEN ARCHIVE',35,60);
  ec.fillStyle='#303a27';ec.font='bold 68px "Segoe UI","Microsoft YaHei",sans-serif';ec.fillText(en?'UNEXPLORED':'待探索',35,350);
  ec.font='22px monospace';ec.fillText('THE NEXT POSSIBILITY',35,401);
  ec.fillStyle='#d0f500';ec.fillRect(35,626,560,64);
  ec.fillStyle='#303a27';ec.font='23px monospace';ec.fillText('FUTURE / --',52,668);
  const emptyTexture=new THREE.CanvasTexture(emptyCanvas);emptyTexture.colorSpace=THREE.SRGBColorSpace;textures.push(emptyTexture);
  const emptyMaterial=new THREE.MeshBasicMaterial({map:emptyTexture,toneMapped:false});ownMaterials.push(emptyMaterial);
  const extensions=[];
  for(const row of [-1,0,1]) {
    for(let slot=-15;slot<=15;slot++) {
      const source=objects[((slot+30+row*3)%objects.length+objects.length)%objects.length];
      const group=source.group.clone(true),empty=(slot+row)%3===0;
      group.userData.projectId=empty?null:source.id;
      group.children[4].material=trimMaterial;
      if(empty)group.children.at(-1).material=emptyMaterial;
      scene.add(group);
      extensions.push({group,body:group.children[0],id:empty?null:source.id,sourceId:empty?null:source.id,faceMaterial:source.group.children.at(-1).material,slot,row});
    }
    if(row!==0){const shelf=rail.clone();shelf.position.y=row*4.55;scene.add(shelf);}
  }
  function targets(snap=false) {
    const selectedIndex=Math.max(0,available.indexOf(selected));
    objects.forEach(object => {
      const index=available.indexOf(object.id),chosen=object.id===selected;
      object.group.visible=index>=0;
      if(index<0)return;
      let offset=index-selectedIndex;
      if(offset>available.length/2)offset-=available.length;
      if(offset<-available.length/2)offset+=available.length;
      object.target={x:chosen ? (narrow?-.25:.25) : offset*1.55,
        y:chosen ? 2.2 : 1.62+(object.id === hovered ? .15 : 0),z:chosen ? 2.5 : -1.45,
        rotation:chosen ? .04 : -.5,scale:chosen ? 1.16 : .86};
      object.tab.material=chosen ? acidMaterial : trimMaterial;
      if(snap||reduce.matches) {
        object.group.position.set(object.target.x,object.target.y,object.target.z);
        object.group.rotation.y=object.target.rotation;object.group.scale.setScalar(object.target.scale);
      }
    });
    const occupied=objects.filter(o=>o.group.visible).map(o=>Math.round(o.target.x/1.55));
    extensions.forEach(object=>{
      const {group,sourceId,faceMaterial,slot,row}=object;
      object.id=available.includes(sourceId)?sourceId:null;
      group.userData.projectId=object.id;
      group.children.at(-1).material=object.id?faceMaterial:emptyMaterial;
      group.visible=row!==0||!occupied.includes(slot);
      group.position.set(slot*1.55,1.62+row*4.55,-1.45);
      group.rotation.y=-.5;group.scale.setScalar(.86);
    });
    wake();
  }
  function draw(time) {
    raf=0;
    if(disposed||!active||!inViewport||document.hidden)return;
    const dt=Math.min((time-previousTime)/1000||.016,.05);previousTime=time;
    const amount=reduce.matches?1:1-Math.exp(-dt*9.5);
    let moving=false;
    objects.forEach(({group,target})=>{
      if(!group.visible)return;
      for(const axis of ['x','y','z']) {
        group.position[axis]+=(target[axis]-group.position[axis])*amount;
        moving ||= Math.abs(target[axis]-group.position[axis])>.001;
      }
      group.rotation.y+=(target.rotation-group.rotation.y)*amount;
      group.scale.setScalar(group.scale.x+(target.scale-group.scale.x)*amount);
      moving ||= Math.abs(target.rotation-group.rotation.y)>.001 || Math.abs(target.scale-group.scale.x)>.001;
    });
    const wanted=reduce.matches?6:6+pointerX*.32;
    camera.position.x+=(wanted-camera.position.x)*amount;camera.lookAt(aim);
    moving ||= Math.abs(wanted-camera.position.x)>.001;
    renderer.render(scene,camera);
    host.dataset.ready='true';
    if(moving)wake();
  }
  function wake() { if(!raf&&!disposed&&active&&inViewport&&!document.hidden)raf=requestAnimationFrame(draw); }
  function stop() {cancelAnimationFrame(raf);raf=0;previousTime=0;}
  function resize() {
    const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
    renderer.setSize(width,height,false);
    narrow=width<760;
    const aspect=width/height,span=narrow?15:11.5;
    aim.set(narrow?-.3:0,narrow?1.4:2.4,0);
    camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();wake();
  }
  function pick(event) {
    const rect=host.getBoundingClientRect();
    mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    ray.setFromCamera(mouse,camera);
    const hit=ray.intersectObjects([...objects,...extensions].filter(o=>o.group.visible&&o.id).map(o=>o.body),false)[0];
    return hit?.object.parent.userData.projectId;
  }
  let drag=null,lastWheel=0;
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    host.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,y:event.clientY,last:event.clientX,moved:false};
    canvas.setPointerCapture(event.pointerId);
  },{signal});
  canvas.addEventListener('pointermove',event=>{
    if(drag?.id===event.pointerId) {
      if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>8)drag.moved=true;
      const delta=event.clientX-drag.last;
      if(Math.abs(delta)>52 && Math.abs(event.clientX-drag.x)>Math.abs(event.clientY-drag.y)) {
        callbacks.onStep(delta<0?1:-1);drag.last=event.clientX;
      }
      return;
    }
    const rect=host.getBoundingClientRect();pointerX=(event.clientX-rect.left)/rect.width*2-1;
    const id=pick(event)||null;
    if(id!==hovered){hovered=id;targets();}else wake();
  },{signal});
  canvas.addEventListener('pointerup',event=>{
    if(drag?.id!==event.pointerId)return;
    if(!drag.moved){const id=pick(event);if(id)callbacks.onSelect(id);}
    drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  },{signal});
  for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drag=null;},{signal});
  canvas.addEventListener('pointerleave',()=>{hovered=null;pointerX=0;targets();},{signal});
  // Archive occupies the viewport; wheel input advances the selected file.
  canvas.addEventListener('wheel',event=>{
    if(event.ctrlKey||available.length<2)return;
    event.preventDefault();const time=performance.now();
    if(time-lastWheel>260&&Math.abs(event.deltaY)+Math.abs(event.deltaX)>8){callbacks.onStep((event.deltaY||event.deltaX)>0?1:-1);lastWheel=time;}
  },{passive:false,signal});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stop();active=false;callbacks.onFailure();},{signal});
  const observer=new ResizeObserver(resize);observer.observe(host);
  const intersection=new IntersectionObserver(entries=>{inViewport=entries[0].isIntersecting;if(inViewport)wake();else stop();});intersection.observe(host);
  document.addEventListener('visibilitychange',()=>document.hidden?stop():wake(),{signal});
  reduce.addEventListener('change',()=>targets(true),{signal});
  window.addEventListener('pagehide',event=>{stop();if(!event.persisted)dispose();},{signal});
  window.addEventListener('pageshow',()=>{resize();wake();},{signal});
  function dispose() {
    if(disposed)return;disposed=true;stop();events.abort();observer.disconnect();intersection.disconnect();
    const geometries=new Set([bodyGeometry,faceGeometry,floor.geometry,rail.geometry,railLine.geometry,...ownGeometries]);
    const materials=new Set([bodyMaterial,paperMaterial,darkMaterial,trimMaterial,acidMaterial,floor.material,rail.material,railLine.material,...ownMaterials]);
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();
  }
  resize();targets(reduce.matches);
  return {select(id,snap=false){selected=id;targets(snap);},filter(ids){available=ids;targets();},
    setVisible(value){active=value;if(active){resize();wake();}else stop();},dispose};
}
