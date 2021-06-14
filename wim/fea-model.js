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
  voxelMaterial: new THREE.MeshLambertMaterial({
    side: THREE.FrontSide,
    color: new THREE.Color(0xf0f0f0),
    opacity: 0.5,
    transparent: true
  }),
  edgeMaterial: new THREE.LineBasicMaterial({
    color: 0x000000,
    opacity: 0.5,
    transparent: true
  }),
  regionMaterials: {
    'None': new THREE.MeshBasicMaterial({color: 0x444444, side: THREE.DoubleSide}),
    'Unknown': new THREE.MeshBasicMaterial({color: 0x000000, side: THREE.DoubleSide}),
    'Skin': new THREE.MeshBasicMaterial({color: 0x0000ff, side: THREE.DoubleSide}),
    'Wall': new THREE.MeshBasicMaterial({color: 0xffa500, side: THREE.DoubleSide}),
    'Infill': new THREE.MeshBasicMaterial({color: 0x00ff00, side: THREE.DoubleSide}),
  },
  materialAxisMaterial: new THREE.LineBasicMaterial({
    color: 0xff0000,
    linewidth: 2
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

  let material = new THREE.MeshLambertMaterial({
    side: THREE.FrontSide,
    //color: new THREE.Color(0xf0f0f0),
    vertexColors: THREE.FaceColors
  });

  let mesh = new THREE.Mesh(geometry, material);

  env.modelGroup.add(mesh);

  env.scene.add(env.camera);
  env.scene.add(ambient);
  env.scene.add(env.headlamp);
  env.scene.add(env.modelGroup);
  env.scene.add(env.axes);

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
      processModel(jmodel);
    } catch (exc) {
      $('.dropzone').find('p').text(exc);
    }
  };

  fr.readAsText(file);
}

function processModel(jmodel) {
  while (env.modelGroup.children.length) {
      env.modelGroup.remove(env.modelGroup.children[0]);
  }

  env.model = new Model(jmodel);

  $('#toggle-mesh').checked = env.model.voxels.visible;
  $('#toggle-mesh-edges').checked = env.model.voxelEdges.visible;
  $('#toggle-regions').checked = env.model.layer.visible;
  $('#toggle-axes').checked = env.model.axes.visible;

  env.modelGroup.add(env.model.group);

  let bbox = new THREE.Box3().setFromObject(env.model.group);

  bbox.getCenter(env.controls.target);

  $('.name').text(env.model.wim.name);

  let slider = $('.layer-slider')[0];
  slider.min = 0;
  slider.max = env.model.layers.size - 1;
  slider.value = 0;

  moveLayer(0);
}

function moveLayer(inc) {
  let slider = $('.layer-slider')[0];
  slider.value = parseInt(slider.value) + inc;

  const keysIt = env.model.layers.keys();

  const keys = [];

  for (let k of keysIt) {
    keys.push(k);
  }

  let layerHeights = keys.sort(
    function(lhs, rhs) {
      lhs = parseFloat(lhs);
      rhs = parseFloat(rhs);

      if (lhs < rhs) {
        return -1;
      } else if (lhs > rhs) {
        return 1;
      }

      return 0;
    }
  );

  let layerHeight = layerHeights[slider.value];

  env.model.showLayer(layerHeight);

  $('.layer-selector label').text(`Layer: ${parseFloat(layerHeight).toFixed(2)}`);
}

class VoxelIndex {
  constructor(i, j, k, flatIndex, activeIndex, origin) {
    this.i = i;
    this.j = j;
    this.k = k;
    this.flatIndex = flatIndex;
    this.activeIndex = activeIndex;
    this.origin = origin;
  }
}

class VoxelIterator {
  constructor(voxelMesh) {
    this.voxelMesh = voxelMesh;
  }

  iterate(callback) {
    let size = this.voxelMesh.size;
    let origin = this.voxelMesh.origin;
    let res = this.voxelMesh.resolution;

    let U = size[0];
    let V = size[1];
    let W = size[2];

    let i = -1;
    let j = 0;
    let k = 0;

    let nextVoxel = function() {
      i += 1;
      if (i === U) {
        i = 0;
        j += 1;

        if (j === V) {
          j = 0;
          k += 1;

          if (k === W) {
            return false;
          }
        }
      }

      return true;
    };

    let voxels = this.voxelMesh.voxels;

    let flatIndex = -1;
    let activeIndex = -1;
    while (nextVoxel()) {
      flatIndex++;

      if (voxels[flatIndex] === 0) {
        continue;
      }

      activeIndex++;

      let x = origin[0] + res[0] * i;
      let y = origin[1] + res[1] * j;
      let z = origin[2] + res[2] * k;

      callback(new VoxelIndex(i, j, k, flatIndex, activeIndex, new THREE.Vector3(x, y, z)));
    }
  }


}

class Layer {
  constructor(z, thickness) {
    this.z = z;
    this.thickness = thickness;

    this.regions = new THREE.Group();
    this.axes = new THREE.Group();
    this._axesVertices = [];

    this.wall = new THREE.Mesh(
      new THREE.Geometry(),
      env.regionMaterials.Wall
    );

    this.infill = new THREE.Mesh(
      new THREE.Geometry(),
      env.regionMaterials.Infill
    );

    this.skin = new THREE.Mesh(
      new THREE.Geometry(),
      env.regionMaterials.Skin
    );

    this.none = new THREE.Mesh(
      new THREE.Geometry(),
      env.regionMaterials.None
    );

    this.regions.add(this.wall);
    this.regions.add(this.infill);
    this.regions.add(this.skin);
    this.regions.add(this.none);
  }

  addAxes(directions, centers, length, z) {
    for (let i = 0; i < directions.length; i++) {
      const dir = directions[i];
      const center = centers[i];

      const v1 = new THREE.Vector3();
      const v2 = new THREE.Vector3();

      v1.add(center);
      v2.add(center);

      v1.addScaledVector(dir, -length/3);
      v2.addScaledVector(dir, length/3);

      if (isNaN(v1.x) || isNaN(v1.y) || isNaN(v1.z)) {
        continue;
      }

      if (isNaN(v2.x) || isNaN(v2.y) || isNaN(v2.z)) {
        continue;
      }

      this._axesVertices.push(v1, v2);
    }
  }

  setAxes() {
    while (this.axes.children.length) {
      this.axes.remove(this.axes.children[0]);
    }

    const positions = new Float32Array(this._axesVertices.length * 3);

    for (var i = 0; i < this._axesVertices.length; i++) {
        const v = this._axesVertices[i];

        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    //geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2000);

    this.axes.add(new THREE.LineSegments(geometry, env.materialAxisMaterial));
  }
}

class Model {
  constructor(wim) {
    this.wim = wim;
    this.layers = new Map();
    this.group = new THREE.Group();
    this.voxels = new THREE.Group();
    this.voxelEdges = new THREE.Group();
    this.layer = new THREE.Group();
    this.axes = new THREE.Group();

    this.voxels.visible = true;
    this.voxelEdges.visible = true;

    this.group.add(this.voxels);
    this.group.add(this.voxelEdges);
    this.group.add(this.layer);
    this.group.add(this.axes);

    this._createVoxelMesh();
    this._createLayers();
  }

  _createVoxelMesh() {
    let voxelMesh = this.wim.voxel_mesh;

    let res = voxelMesh.resolution;

    let cube = new THREE.BoxBufferGeometry(res[0], res[1], res[2]);
    let edges = new THREE.EdgesGeometry(cube);

    let voxels = this.voxels;
    let voxelEdges = this.voxelEdges;

    let makeVoxelGeometry = function(index) {
      let mesh = new THREE.Mesh(cube, env.voxelMaterial);
      let lines = new THREE.LineSegments(edges, env.edgeMaterial);

      let offset = new THREE.Vector3(
        index.origin.x + res[0] / 2,
        index.origin.y + res[1] / 2,
        index.origin.z + res[2] / 2
      )

      mesh.position.copy(offset);
      lines.position.copy(offset);

      voxels.add(mesh);
      voxelEdges.add(lines);
    }

    let it = new VoxelIterator(voxelMesh);

    it.iterate(makeVoxelGeometry);
  }

  _createLayers() {
    let voxelMesh = this.wim.voxel_mesh;
    let layers = this.layers;
    let regionGridSize = voxelMesh.region_grid_size;
    let regionGridRes = voxelMesh.region_grid_resolution;
    let csyses = voxelMesh.coordinate_systems;

    let makeVoxelLayers = function(index) {
      let thisVoxelLayers = voxelMesh.layers[index.activeIndex];

      let thickness = 0.0;

      for (let vlayer of thisVoxelLayers) {
        thickness += vlayer[0];
        let z = index.origin.z + thickness - vlayer[0] / 2;

        if (!layers.has(z)) {
          layers.set(z, new Layer());
        }

        let layer = layers.get(z);

        const matAxesDirs = [];
        const matAxesCenters = [];

        for (let region of vlayer[6]) {
          let matType = materialTypes[region[0]];
          let csys = csyses[region[2]];
          let pixels = region[3];

          for (let pixelFlatIndex of pixels) {
            let j = Math.floor(pixelFlatIndex / regionGridSize[0]);
            let i = pixelFlatIndex - j * regionGridSize[0];

            let nodeCoords = function(ii, jj) {
              return new THREE.Vector3(
                index.origin.x + ii * regionGridRes[0],
                index.origin.y + jj * regionGridRes[1],
                z
              );
            }

            let addPixelFaces = function(mesh) {
              let geom = mesh.geometry;

              geom.vertices.push(nodeCoords(i, j));
              geom.vertices.push(nodeCoords(i+1, j));
              geom.vertices.push(nodeCoords(i+1, j+1));
              geom.vertices.push(nodeCoords(i, j+1));

              let nverts = geom.vertices.length;

              geom.faces.push(new THREE.Face3(nverts-4, nverts-3, nverts-1));
              geom.faces.push(new THREE.Face3(nverts-2, nverts-1, nverts-3));
            }

            if (matType === 'None') {
              addPixelFaces(layer.none);
            } else if (matType === 'Wall') {
              addPixelFaces(layer.wall);
            } else if (matType === 'Skin') {
              addPixelFaces(layer.skin);
            } else if (matType === 'Infill') {
              addPixelFaces(layer.infill);
            }

            if (matType !== 'None') {
              if (csys.type !== 'three_points') {
                console.warn(`Unrecognized coordinate system type ${csys.type}`);
              } else {
                const xaxis = new THREE.Vector3(
                  csys.xaxis[0] - csys.origin[0],
                  csys.xaxis[1] - csys.origin[1],
                  csys.xaxis[2] - csys.origin[2]
                );

                xaxis.normalize();

                matAxesDirs.push(xaxis);
                matAxesCenters.push(nodeCoords(i+0.5, j+0.5));
              }
            }
          }
        }

        layer.addAxes(matAxesDirs, matAxesCenters, regionGridRes[0], z);
      }
    }

    let it = new VoxelIterator(voxelMesh);

    it.iterate(makeVoxelLayers);

    this.layers.forEach(
      (l, k, m) => l.setAxes()
    );
  }

  showLayer(z) {
    while (this.layer.children.length) {
      this.layer.remove(this.layer.children[0]);
    }

    while (this.axes.children.length) {
      this.axes.remove(this.axes.children[0]);
    }

    if (this.layers.has(z)) {
      this.layer.add(this.layers.get(z).regions);
      this.axes.add(this.layers.get(z).axes);
    } else {
      console.error(z + ' does not match any layer heights');
    }
  }
}
