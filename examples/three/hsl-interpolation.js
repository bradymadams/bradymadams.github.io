var container;
var camera, scene, renderer;

THREE.ShaderLib.lambert = { // this is a cut-and-paste of the lambert shader -- modified to accommodate instancing for this app
  uniforms: THREE.UniformsUtils.merge(
    [
      THREE.ShaderLib.lambert.uniforms,
      {
        contourColors: { value: 12 }
      }
    ]
  ),
  
  vertexShader: `
    #define LAMBERT
    
    varying vec3 vLightFront;
    varying vec3 vIndirectFront;
    
    #ifdef DOUBLE_SIDED
      varying vec3 vLightBack;
      varying vec3 vIndirectBack;
    #endif
    
    #include <common>
    #include <uv_pars_vertex>
    #include <uv2_pars_vertex>
    #include <envmap_pars_vertex>
    #include <bsdfs>
    #include <lights_pars_begin>
    #include <color_pars_vertex>
    #include <fog_pars_vertex>
    #include <morphtarget_pars_vertex>
    #include <skinning_pars_vertex>
    #include <shadowmap_pars_vertex>
    #include <logdepthbuf_pars_vertex>
    #include <clipping_planes_pars_vertex>

    vec3 rgb2hsl(vec3 rgbColor) {
      float rgbMin = min( min( rgbColor.r, rgbColor.g ), rgbColor.b );
      float rgbMax = max( max( rgbColor.r, rgbColor.g ), rgbColor.b );
    
      float L = 0.5 * ( rgbMin + rgbMax );
      float S = 1.0;
      float C = rgbMax - rgbMin;
    
      if ( L < 0.5 ) {
        S = C / (rgbMax + rgbMin);
      } else {
        S = C / (2.0 - rgbMax - rgbMin);
      }
    
      float H = 0.0;
    
      if ( C != 0.0 ) {
        if ( rgbColor.r > rgbColor.g && rgbColor.r > rgbColor.b ) {
          H = ( rgbColor.g - rgbColor.b ) / C;
          if ( H < 0.0 ) { H = H + 6.0; }
        } else if ( rgbColor.g > rgbColor.r && rgbColor.g > rgbColor.b ) {
          H = 2.0 + ( rgbColor.b - rgbColor.r ) / C;
        } else {
          H = 4.0 + ( rgbColor.r - rgbColor.g ) / C;
        }
      }
    
      H = min( H, 6.0 );
      H = max( H, 0.0 );
    
      return vec3( H * 60.0, S, L );
    }
    
    void main() {
    
      #include <uv_vertex>
      #include <uv2_vertex>
      
      //#include <color_vertex>

      #ifdef USE_COLOR
        #ifdef HSL_COLOR_SPACE
          vColor = rgb2hsl(color);
        #else
          vColor.xyz = color.xyz;
        #endif
      #endif
    
      #include <beginnormal_vertex>
      #include <morphnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <defaultnormal_vertex>
    
      #include <begin_vertex>
      #include <morphtarget_vertex>
      #include <skinning_vertex>
      #include <project_vertex>
      #include <logdepthbuf_vertex>
      #include <clipping_planes_vertex>
    
      #include <worldpos_vertex>
      #include <envmap_vertex>
      #include <lights_lambert_vertex>
      #include <shadowmap_vertex>
      #include <fog_vertex>
    }
  `,

  fragmentShader: `
    uniform vec3 diffuse;
    uniform vec3 emissive;
    uniform float opacity;
    
    varying vec3 vLightFront;
    varying vec3 vIndirectFront;
    
    #ifdef DOUBLE_SIDED
      varying vec3 vLightBack;
      varying vec3 vIndirectBack;
    #endif
    
    
    #include <common>
    #include <packing>
    #include <dithering_pars_fragment>
    #include <color_pars_fragment>
    #include <uv_pars_fragment>
    #include <uv2_pars_fragment>
    #include <map_pars_fragment>
    #include <alphamap_pars_fragment>
    #include <aomap_pars_fragment>
    #include <lightmap_pars_fragment>
    #include <emissivemap_pars_fragment>
    #include <envmap_pars_fragment>
    #include <bsdfs>
    #include <lights_pars_begin>
    #include <fog_pars_fragment>
    #include <shadowmap_pars_fragment>
    #include <shadowmask_pars_fragment>
    #include <specularmap_pars_fragment>
    #include <logdepthbuf_pars_fragment>
    #include <clipping_planes_pars_fragment>

    /*
    vec3 contour2hsl(float contour) {
      const float saturation = 1.0;
      const float lightness = 0.5;

      contour = clamp(contour, 0.0, 1.0);

      float hue = (1.0 - contour) * 3.0 / 2.0;

      vec3 cp;
    
      float C = ( 1.0 - abs( 2.0 * lightness - 1.0 )) * saturation;
      float D = hue / 6.0 - 2.0 * floor( hue / 3.0 );
      float X = C * ( 1.0 - abs( D - 1.0 ) );
      float M = lightness - 0.5 * C;
    
      if ( hue < 1.0 / 6.0 ) {
        cp.r = C; cp.g = X;
      } else if ( hue > 1.0 / 6.0 && hue < 1.0 / 3.0 ) {
        cp.r = X; cp.g = C;
      } else if ( hue >= 1.0 / 3.0 && hue < 1.0 / 2.0 ) {
        cp.g = C; cp.b = X;
      } else {
        cp.g = X; cp.b = C;
      }
    
      return cp + M;
    }
    */

    vec3 hsl2rgb(vec3 hslColor, float ncolors) {
      float H = clamp(hslColor.x, 0.0, 240.0);
      float S = hslColor.y;
      float L = hslColor.z;
    
      if (ncolors > 1.0) {
        float fcontour = H / 240.0;
        float rounded = floor((ncolors - 1.0) * fcontour + 0.5) / (ncolors - 1.0);
        H = 240.0 * rounded; //(1.0 - rounded);
      }
    
      float C = ( 1.0 - abs( 2.0 * L - 1.0 )) * S;
      float D = H / 60.0 - 2.0 * floor( H / 120.0 );
      float X = C * ( 1.0 - abs( D - 1.0 ) );
      float M = L - 0.5 * C;
    
      vec3 cp;
    
      if ( H >= 0.0 && H < 60.0 ) {
        cp.r = C; cp.g = X;
      } else if ( H >= 60.0 && H < 120.0 ) {
        cp.r = X; cp.g = C;
      } else if ( H >= 120.0 && H < 180.0 ) {
        cp.g = C; cp.b = X;
      } else if ( H >= 180.0 && H < 240.0 ) {
        cp.g = X; cp.b = C;
      } else if ( H >= 240.0 && H < 300.0 ) {
        cp.r = X; cp.b = C;
      } else {
        cp.r = C; cp.b = X;
      }
    
      return cp + M;
    }

    #ifdef HSL_COLOR_SPACE
      uniform float contourColors;
    #endif
    
    void main() {
    
      #include <clipping_planes_fragment>
    
      vec4 diffuseColor = vec4( diffuse, opacity );
      ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
      vec3 totalEmissiveRadiance = emissive;
    
      #include <logdepthbuf_fragment>
      #include <map_fragment>

      //#include <color_fragment>

      #ifdef USE_COLOR
        #ifdef HSL_COLOR_SPACE
          diffuseColor.rgb *= hsl2rgb(vColor, contourColors);
        #else
          diffuseColor.rgb *= vColor;
        #endif
      #endif

      #include <alphamap_fragment>
      #include <alphatest_fragment>
      #include <specularmap_fragment>
      #include <emissivemap_fragment>
    
      // accumulation
      reflectedLight.indirectDiffuse = getAmbientLightIrradiance( ambientLightColor );
    
      #ifdef DOUBLE_SIDED
    
        reflectedLight.indirectDiffuse += ( gl_FrontFacing ) ? vIndirectFront : vIndirectBack;
    
      #else
    
        reflectedLight.indirectDiffuse += vIndirectFront;
    
      #endif
    
      #include <lightmap_fragment>
    
      reflectedLight.indirectDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb );
    
      #ifdef DOUBLE_SIDED
    
        reflectedLight.directDiffuse = ( gl_FrontFacing ) ? vLightFront : vLightBack;
    
      #else
    
        reflectedLight.directDiffuse = vLightFront;
    
      #endif
    
      reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();
    
      // modulation
      #include <aomap_fragment>
    
      vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
    
      #include <envmap_fragment>
    
      gl_FragColor = vec4( outgoingLight, diffuseColor.a );
    
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      #include <fog_fragment>
      #include <premultiplied_alpha_fragment>
      #include <dithering_fragment>
    }
  `
};

function newMesh(material, dx) {
  var geometry = new THREE.PlaneGeometry(1, 1);

  let f1 = geometry.faces[0];
  let f2 = geometry.faces[1];

  let red = new THREE.Color();
  let blue = new THREE.Color();
  
  red.setHSL(0, 1, 0.5);
  blue.setHSL(2/3, 1, 0.5);

  f1.vertexColors.push(red);
  f1.vertexColors.push(red);
  f1.vertexColors.push(blue);

  f2.vertexColors.push(red);
  f2.vertexColors.push(red);
  f2.vertexColors.push(blue);

  //let bgeom = new THREE.BufferGeometry();
  //bgeom.fromGeometry(geometry);

  var mesh = new THREE.Mesh(geometry, material);

  mesh.translateX(dx);
  
  return mesh;
}

function init() {
  container = document.getElementById('canvas-container');
  
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 3000);
  camera.position.set(1.5, 0, 4);
  
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  scene.add(new THREE.AmbientLight(0xffffff));

  let mesh1 = newMesh(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: THREE.VertexColors }), 0);
  //let mesh2 = newMesh(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: THREE.VertexColorsHSL }), 1.25);

  let customMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: THREE.VertexColors });

  customMat.defines = customMat.defines || {};
  customMat.defines['HSL_COLOR_SPACE'] = '';

  let mesh3 = newMesh(customMat, 2.5);

  scene.add(mesh1);
  //scene.add(mesh2);
  scene.add(mesh3);

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  
  container.appendChild(renderer.domElement);
  
  onWindowResize();
  window.addEventListener('resize', onWindowResize, false);

  animate();
}

function onWindowResize(event) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  render();
}

function render() {
  renderer.render(scene, camera);
}