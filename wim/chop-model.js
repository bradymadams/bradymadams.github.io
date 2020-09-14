var materialTypes = {
  '-1': 'None',
  '0': 'Unknown',
  '1': 'Skin',
  '2': 'Wall',
  '3': 'Infill'
}

var env = {
  container: null,
  camera: null,
  scene: null,
  renderer: null,
  controls: null,
  headlamp: null,
  axes: new THREE.AxesHelper(10),
  printBed: new THREE.GridHelper(300, 10),
  meshTypeMaterials: {
    normal: new THREE.MeshLambertMaterial({
      side: THREE.FrontSide,
      color: new THREE.Color(0xf0f0f0),
      opacity: 1.0,
      transparent: true
    }),
    infill: new THREE.MeshLambertMaterial({
      side: THREE.FrontSide,
      color: new THREE.Color(0xffffa0),
      opacity: 0.5,
      transparent: true
    })
  },
  edgeMaterial: new THREE.LineBasicMaterial({
    color: 0x000000,
    opacity: 1.0,
    transparent: true
  }),
  model: null,
  modelGroup: new THREE.Group()
}

function init() {
  env.container = document.getElementById('canvas-container');

  env.renderer = new THREE.WebGLRenderer({ antialias: true });
  env.renderer.setPixelRatio(window.devicePixelRatio);

  env.container.appendChild(env.renderer.domElement);

  env.camera = new THREE.PerspectiveCamera(10, window.innerWidth / window.innerHeight, 1, 10000);
  env.camera.position.set(-550, -428, 560);

  env.controls = new THREE.TrackballControls(env.camera, env.renderer.domElement);

  env.controls.staticMoving = true;
  env.controls.dynamicDampingFactor = 0.25;
  env.controls.rotateSpeed = 3.0;
  env.controls.zoomSpeed = 2.0;
  env.controls.panSpeed = 0.04;

  ambient = new THREE.AmbientLight(0x555555);
  env.headlamp = new THREE.DirectionalLight(0xffffff, 0.5);

  env.scene = new THREE.Scene();
  env.scene.background = new THREE.Color(0xffffff)

  let geometry = new THREE.BoxGeometry(0.75, 0.75, 0.75);

  let mesh = new THREE.Mesh(geometry, env.normalMaterial);

  env.modelGroup.add(mesh);

  env.scene.add(env.camera);
  env.scene.add(ambient);
  env.scene.add(env.headlamp);
  env.scene.add(env.modelGroup);
  env.scene.add(env.axes);
  env.scene.add(env.printBed);

  env.printBed.rotateX(Math.PI / 2);

  let printBedSize = new THREE.Vector3();

  env.printBed.geometry.computeBoundingBox();
  env.printBed.geometry.boundingBox.getSize(printBedSize);

  env.printBed.translateX(printBedSize.x / 2);
  env.printBed.translateZ(-printBedSize.z / 2);

  onWindowResize();
  window.addEventListener('resize', onWindowResize, false);

  animate();
}

function onWindowResize(event) {
  env.renderer.domElement.style.width = (0.95 * env.container.clientWidth) + 'px';
  env.renderer.domElement.style.height = (0.95 * env.container.clientHeight) + 'px';

  let w = env.renderer.domElement.clientWidth;
  let h = env.renderer.domElement.clientHeight;

  env.camera.aspect = w / h;
  env.camera.updateProjectionMatrix();
  env.renderer.setSize(w, h);
}

function animate() {
  requestAnimationFrame(animate);
  render();
}

function render() {
  env.controls.update();
  env.headlamp.position.set(env.camera.position.x, env.camera.position.y, env.camera.position.z);
  env.renderer.render(env.scene, env.camera);
}

function dragOverHandler(event) {
  event.preventDefault();
}

function dropHandler(event) {
  event.preventDefault();

  if (event.dataTransfer.items) {
    var file = event.dataTransfer.items[0].getAsFile();
  } else {
    var file = event.dataTransfer.files[0];
  }

  $('.dropzone').find('p').text(file.name);

  let fr = new FileReader();

  fr.onload = e => {
    try {
      let jmodel = JSON.parse(e.target.result);
      processModel(jmodel, file.name);
    } catch (exc) {
      $('.dropzone').find('p').text(exc);
    }
  };

  fr.readAsText(file);
}

function processModel(jmodel, name) {
  while (env.modelGroup.children.length) {
      env.modelGroup.remove(env.modelGroup.children[0]);
  }

  env.model = new Model(jmodel);

  env.modelGroup.add(env.model.group);

  let bbox = new THREE.Box3().setFromObject(env.model.group);

  bbox.getCenter(env.controls.target);

  $('.name').text(name);
}

class Model {
  constructor(wim) {
    this.wim = wim;
    this.group = new THREE.Group();

    //this._createVoxelMesh();
    this._createMeshes();
  }

  _createMeshes() {
    for (let chopmesh of this.wim.meshes) {
      this._createMesh(chopmesh);
    }
  }

  _createMesh(chopmesh) {
    let geom = new THREE.Geometry();

    for (let v of chopmesh.vertices) {
      geom.vertices.push(new THREE.Vector3(...v));
    }

    for (let f of chopmesh.triangles) {
      geom.faces.push(new THREE.Face3(...f));
    }

    geom.computeVertexNormals();

    let mesh = new THREE.Mesh(geom, env.meshTypeMaterials[chopmesh.type]);

    let alpha = new THREE.Matrix4();

    alpha.set(...chopmesh.transform);

    mesh.applyMatrix4(alpha);

    this.group.add(mesh);
  }
}
