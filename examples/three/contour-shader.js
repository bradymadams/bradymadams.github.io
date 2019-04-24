var container;
var camera, scene, renderer;
var uniforms;
var clock = new THREE.Clock();

function init() {
  container = document.getElementById('canvas-container');
  
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 3000);
  camera.position.set(0.5, 0.5, 4);
  
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcccccc)
  
  //var geometry = new THREE.BoxGeometry(0.75, 0.75, 0.75);
  var geometry = new THREE.BufferGeometry();

  var vertices = new Float32Array([
    0, 0, 0,
    1, 0, 0,
    1, 1, 0,

    1, 1, 0,
    0, 1, 0,
    0, 0, 0
  ]);

  var displacement = new Float32Array([
    0, 0, 0,
    0.4, 0, 0,
    0.6, 0, 0,
    0.6, 0, 0,
    -0.2, -0.1, 0,
    0, 0, 0
  ]);

  var contour = new Float32Array([
    //0, 0.4, 0.6, 0.6, -0.2, 0
    0.25, 0.5, 1.0, 1.0, 0.0, 0.25
  ]);

  geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.addAttribute('displacement', new THREE.BufferAttribute(displacement, 3));
  geometry.addAttribute('contour', new THREE.BufferAttribute(contour, 1));
  
  uniforms = {
    time: {
      type: "f",
      value: 1.0
    },
    deformationScale: {
      type: "f",
      value: 0.0
    }
    /*resolution: {
      type: "v2",
      value: new THREE.Vector2()
    }*/
  };

  var material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: uniforms,
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('fragment_shader4').textContent
  });

  var mesh = new THREE.Mesh(geometry, material);

  scene.add(mesh);

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  
  container.appendChild(renderer.domElement);
  
  onWindowResize();
  window.addEventListener('resize', onWindowResize, false);

  animate();
}

function onWindowResize(event) {
  //uniforms.resolution.value.x = window.innerWidth;
  //uniforms.resolution.value.y = window.innerHeight;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
//
function animate() {
  requestAnimationFrame(animate);
  render();
}

function render() {
  var delta = clock.getDelta();
  
  uniforms.time.value += delta;

  //console.log(uniforms.time.value);
  
  for (var i = 0; i < scene.children.length; i++) {
    var object = scene.children[i];
    //object.rotation.y += delta * 0.5 * (i % 2 ? 1 : -1);
    //object.rotation.x += delta * 0.5 * (i % 2 ? -1 : 1);
  }
  
  renderer.render(scene, camera);
}