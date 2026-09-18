import * as THREE from './vendor/three-0.186.0/three.module.js';

// A procedural studio environment and a depth-aware lens pass. The DOM overlay
// is intentionally outside this pass so navigation and copy remain crisp.
export function createArchiveOptics(renderer,scene,camera){
  const studio=new THREE.Scene();studio.background=new THREE.Color(0xbdb9b0);
  const studioGeometry=new THREE.BoxGeometry(1,1,1),studioMaterials=[];
  function card(position,size,color){const material=new THREE.MeshBasicMaterial({color});studioMaterials.push(material);const mesh=new THREE.Mesh(studioGeometry,material);mesh.position.set(...position);mesh.scale.set(...size);studio.add(mesh);}
  card([-7,8,1],[1,12,16],new THREE.Color(3.6,3.3,3.0));
  card([3,12,-3],[17,.2,9],new THREE.Color(4.2,4.0,3.6));
  card([9,4,5],[.3,9,12],new THREE.Color(.35,.38,.32));
  card([0,4,-11],[12,8,.2],new THREE.Color(1.5,1.25,1.12));
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.06,.1,60);
  scene.environment=environment.texture;scene.environmentIntensity=.72;
  pmrem.dispose();studioGeometry.dispose();studioMaterials.forEach(m=>m.dispose());
  const target=new THREE.WebGLRenderTarget(1,1,{type:renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:true,samples:0});
  target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const uniforms={sceneColor:{value:target.texture},sceneDepth:{value:target.depthTexture},pixel:{value:new THREE.Vector2(1,1)},focus:{value:new THREE.Vector3(.5,.5,.3)},aspect:{value:1},strength:{value:1}};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
    vertexShader:`varying vec2 lensUV;void main(){lensUV=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`
      uniform sampler2D sceneColor,sceneDepth;
      uniform vec2 pixel;uniform vec3 focus;uniform float aspect,strength;
      varying vec2 lensUV;
      void main(){
        float depth=texture2D(sceneDepth,lensUV).r;
        vec2 distanceUV=(lensUV-focus.xy)*vec2(min(aspect,1.65),1.);
        float peripheral=smoothstep(.12,.72,length(distanceUV));
        float defocus=smoothstep(.018,.105,abs(depth-focus.z));
        float blur=max(peripheral*.88,defocus*.65)*strength;
        vec2 radius=pixel*(.35+blur*4.2);
        vec3 color=texture2D(sceneColor,lensUV).rgb*2.;float total=2.;
        for(int i=0;i<12;i++){
          float a=float(i)*.523598776;
          vec2 sampleUV=clamp(lensUV+vec2(cos(a),sin(a))*radius,.001,.999);
          float sampleDepth=texture2D(sceneDepth,sampleUV).r;
          float weight=mix(.3,1.,1.-smoothstep(.01,.055,abs(sampleDepth-depth)));
          color+=texture2D(sceneColor,sampleUV).rgb*weight;total+=weight;
        }
        color/=total;
        float occlusion=0.;
        for(int i=0;i<4;i++){
          float a=float(i)*1.570796327;
          float neighbor=texture2D(sceneDepth,clamp(lensUV+vec2(cos(a),sin(a))*pixel*4.5,.001,.999)).r;
          float delta=depth-neighbor;
          occlusion+=smoothstep(.001,.007,delta)*(1.-smoothstep(.016,.045,delta));
        }
        color*=1.-occlusion*.065*(1.-peripheral*.4);
        // Gentle contrast around focus, atmospheric fill at the image perimeter.
        color=(color-vec3(.42))*mix(1.09,.85,peripheral)+vec3(.42);
        color=mix(color,vec3(.91,.875,.82),peripheral*.12);
        gl_FragColor=vec4(max(color,vec3(0.)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb=clamp((gl_FragColor.rgb-vec3(.86))*mix(1.12,.94,peripheral)+vec3(.86),0.,1.);
      }`});
  const geometry=new THREE.PlaneGeometry(2,2),quad=new THREE.Mesh(geometry,material),postScene=new THREE.Scene(),postCamera=new THREE.Camera();postScene.add(quad);
  const projected=new THREE.Vector3();
  return {
    resize(width,height){const ratio=renderer.getPixelRatio();target.setSize(Math.round(width*ratio),Math.round(height*ratio));uniforms.pixel.value.set(1/target.width,1/target.height);uniforms.aspect.value=width/height;uniforms.strength.value=width<760?.72:1;},
    render(point){projected.copy(point).project(camera);uniforms.focus.value.set(projected.x*.5+.5,projected.y*.5+.5,projected.z*.5+.5);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);},
    dispose(){target.depthTexture.dispose();target.dispose();geometry.dispose();material.dispose();environment.dispose();scene.environment=null;}
  };
}
