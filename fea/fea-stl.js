var container;
var camera, scene, renderer;
var controls;
var headlamp;
var stlloader;
var stlgroup;
var stlmesh;
var faceSelector;

var logSelectedFaces = false; // if true, selected faces will log to console

var voxelloader;
var voxelgroup;
var voxelthor;

function init() {
  container = document.getElementById('canvas-container');

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  
  container.appendChild(renderer.domElement);
  
  camera = new THREE.PerspectiveCamera(10, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.set(100, 100, 100);

  controls = new THREE.TrackballControls(camera, renderer.domElement);

  controls.staticMoving = true;
  controls.dynamicDampingFactor = 0.25;
  controls.rotateSpeed = 3.0;
  controls.zoomSpeed = 2.0;
  controls.panSpeed = 0.04;
  
  ambient = new THREE.AmbientLight(0xa0a0a0);
  headlamp = new THREE.DirectionalLight(0xffffff, 0.5);
  
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff)
  
  let geometry = new THREE.BoxGeometry(0.75, 0.75, 0.75);

  var material = new THREE.MeshLambertMaterial({
    side: THREE.FrontSide,
    //color: new THREE.Color(0xf0f0f0),
    vertexColors: THREE.FaceColors
  });

  stlmesh = new THREE.Mesh(geometry, material);

  stlloader = new THREE.STLLoader();
  stlloader.load(
    '/models/dogbone.stl',
    function(g) {
      stlmesh.geometry = g;
      processStlGeometry(scene, stlmesh.geometry);
    }
  );

  voxelloader = new THREE.FileLoader();

  /*voxelloader.load(
    '/models/dogbone.json',
    function(data) {
      let jmodel = JSON.parse(data);
      let model = new thor.UI.Model(jmodel);
      voxelthor = new thor.UI.ModelGroup(model.name, model);
      voxelgroup.add(voxelthor.group);
      
      //voxelthor.surface.visible = false;
      voxelthor.wireframe.visible = true;

      voxelgroup.translateX(-1);
      voxelgroup.translateY(-1);
    }
  )*/

  stlgroup = new THREE.Group();
  voxelgroup = new THREE.Group();

  scene.add(camera);
  scene.add(ambient);
  scene.add(headlamp);
  scene.add(stlgroup);
  scene.add(voxelgroup);

  faceSelector = null;
  
  onWindowResize();
  window.addEventListener('resize', onWindowResize, false);

  renderer.domElement.onclick = function(e) {
    faceSelector.click(e.clientX, e.clientY);
  }

  animate();
}

function onWindowResize(event) {
  renderer.domElement.style.width = (0.95 * container.clientWidth) + 'px';
  renderer.domElement.style.height = (0.95 * container.clientHeight) + 'px';

  let w = renderer.domElement.clientWidth;
  let h = renderer.domElement.clientHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
//
function animate() {
  requestAnimationFrame(animate);
  render();
}

function render() {
  if (faceSelector !== null) {
    faceSelector.check(camera);
  }
  controls.update();
  headlamp.position.set(camera.position.x, camera.position.y, camera.position.z);
  renderer.render(scene, camera);
}

function processStlGeometry(scene, geometry) {
  geometry.mergeVertices();
  geometry.computeBoundingBox();
  let center = new THREE.Vector3();
  geometry.boundingBox.getCenter(center);
  controls.target.copy(center);

  if (faceSelector === null) {
    faceSelector = new FaceSelector(stlmesh);
  } else {
    faceSelector._createInternalMaps(true);
  }

  let wireframeGeom = new THREE.WireframeGeometry(geometry);

  let lineMat = new THREE.LineBasicMaterial(
    {
      color: 0x000000,
      linewidth: 1,
      lights: false,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 4,
      polygonOffsetUnits: 0
    }
  );

  let line = new THREE.LineSegments(wireframeGeom, lineMat);

  for (let i = stlgroup.children.length - 1; i >= 0; i--) {
    stlgroup.remove(stlgroup.children[i]);
  }

  stlgroup.add(stlmesh);
  stlgroup.add(line);
}

function onMouseMove(event) {
  faceSelector.updateMouse(event.clientX, event.clientY);
}

class FaceSelector {
  constructor(mesh, mustShareEdge=true) {
    this.mesh = mesh;
    this.raycaster = new THREE.Raycaster();
    this.maxAngle = 10;
    this.mouse = new THREE.Vector2();
    this.clampAngle = true;
    this.selected = new Set();

    this._lastFaces = new Set();

    this._createInternalMaps(mustShareEdge);
  }

  updateMouse(x, y) {
    this.mouse = this.getMouse(x, y);
  }

  getMouse(x, y) {
    let cX = x - renderer.domElement.offsetLeft;
    let cY = y - renderer.domElement.offsetTop;
    let mX = (cX / renderer.domElement.clientWidth) * 2 - 1;
    let mY = - (cY / renderer.domElement.clientHeight) * 2 + 1;
    return new THREE.Vector2(mX, mY);
  }

  check(camera) {
    this.raycaster.setFromCamera(this.mouse, camera);

    let intersects = this.raycaster.intersectObject(this.mesh);

    if (intersects.length > 0) {
      // only look at closest
      let faces = this.getFaces(intersects[0].faceIndex);

      for (let f = 0; f < this.mesh.geometry.faces.length; f++) {
        if (this.selected.has(f)) {
          continue;
        }

        if (faces.has(f)) {
          this.mesh.geometry.faces[f].color.setRGB(0, 1, 0);
        } else {
          this.mesh.geometry.faces[f].color.setRGB(0.6, 0.6, 0.6);
        }
      }

      if (!this.selected.has(intersects[0].faceIndex)) {
        this.mesh.geometry.faces[intersects[0].faceIndex].color.setRGB(0, 0, 1);
      }

      this.mesh.geometry.colorsNeedUpdate = true;

      this._lastFaces = faces;

    } else if (this._lastFaces.size > 0) {
      
      for (let f = 0; f < this.mesh.geometry.faces.length; f++) {
        if (this.selected.has(f)) {
          continue;
        }
        this.mesh.geometry.faces[f].color.setRGB(0.6, 0.6, 0.6);
      }

      this.mesh.geometry.colorsNeedUpdate = true;

      this._lastFaces = new Set();
    }
  }

  click(x, y) {
    let mouse = this.getMouse(x, y);

    this.raycaster.setFromCamera(mouse, camera);

    let intersects = this.raycaster.intersectObject(this.mesh);

    if (intersects.length > 0) {
      // only look at closest
      let faces = this.getFaces(intersects[0].faceIndex);

      if (logSelectedFaces) {
        console.log('(' + Array.from(faces).join(', ') + ')');
      }

      this.selected = new Set(faces);

      for (let f = 0; f < this.mesh.geometry.faces.length; f++) {
        if (faces.has(f)) {
          this.mesh.geometry.faces[f].color.setRGB(1, 1, 0);
        }
      }

      this.mesh.geometry.colorsNeedUpdate = true;

      //mapFacesToVoxelNodes(stlmesh.geometry, faces, voxelthor.surface.geometry, 0.5);
    }
  }

  getFaces(faceIndex) {
    let geom = this.mesh.geometry;
    let faces = geom.faces;

    let fwalker = new FaceWalker(this._edgeFaces, this._faceEdges, faceIndex, this.clampAngle);

    let maxAngleRadians = this.maxAngle * Math.PI / 180.0;

    let checkForFaceContinuity = (face1, face2) => Math.abs(face1.normal.angleTo(face2.normal)) <= maxAngleRadians;

    while (!fwalker.done()) {
      let faceIndices = fwalker.nextFace();

      let nextFaceIndex = faceIndices[0];
      let currentFaceIndex = this.clampAngle ? faceIndex : faceIndices[1];

      let partOfContinuousFace = false;

      partOfContinuousFace = checkForFaceContinuity(faces[currentFaceIndex], faces[nextFaceIndex]);

      if (partOfContinuousFace) {
        fwalker.include(nextFaceIndex, currentFaceIndex);
      } else {
        fwalker.exclude(nextFaceIndex, currentFaceIndex);
      }
    }

    //return continuousFaces;
    return fwalker.allFaces;
  }

  _createInternalMaps(mustShareEdge) {
    if (!mustShareEdge) {
      throw 'FaceSelector does not support mustSharedEdge=false yet';
    }

    let geom = this.mesh.geometry;
    let vertexToFaces = []

    for (let v = 0; v < geom.vertices.length; v++) {
      vertexToFaces.push([]);
    }

    let edges = new Map();
    let faceEdges = [];

    for (let f = 0; f < geom.faces.length; f++) {
      let face = geom.faces[f];
      vertexToFaces[face.a].push(f);
      vertexToFaces[face.b].push(f);
      vertexToFaces[face.c].push(f);

      let thisFaceEdges = [];

      for (let edge of [[face.a, face.b], [face.a, face.c], [face.b, face.c]]) {
        edge.sort();
        let edgeKey = edge[0] + '-' + edge[1];
        if (!edges.has(edgeKey)) {
          edges.set(edgeKey, []);
        }
        edges.get(edgeKey).push(f);

        thisFaceEdges.push(edgeKey);
      }

      faceEdges.push(thisFaceEdges);
    }

    this._edgeFaces = edges; // edge keys to connected faces (2 faces)
    this._faceEdges = faceEdges; // face index to edge keys
  }
}

class FaceWalker {
  constructor(edgeFaces, faceEdges, startingFace, fromStartingFace) {
    this.edgeFaces = edgeFaces;
    this.faceEdges = faceEdges;
    this.startingFace = startingFace;
    this.fromStartingFace = fromStartingFace;

    this.allFaces = new Set([this.startingFace]);

    this._facesToCheck = new Map();
    this._checkedFaces = new Map();

    this._addFacesConnectedToEdgeToCheckList(this.startingFace);
  }

  _addFacesConnectedToEdgeToCheckList(faceIndex) {
    let edges = this.faceEdges[faceIndex];
    for (let e of edges) {
      let faces = this.edgeFaces.get(e);
      for (let f of faces) {

        let fromFace = this.fromStartingFace ? this.startingFace : faceIndex;
        
        if (!this._checkedFaces.has(f)) {

          this._addFaceToCheck(f, fromFace);

        } else {

          if (!this._checkedFaces.get(f).has(fromFace)) {
            this._addFaceToCheck(f, fromFace);
          }

        }

      }
    }
  }

  _addFaceToCheck(face, fromFace) {
    if (face === fromFace) {
      return;
    }
    if (!this._facesToCheck.has(face)) {
      this._facesToCheck.set(face, new Set([fromFace]));
    } else {
      this._facesToCheck.get(face).add(fromFace);
    }
  }

  _removeFaceToCheck(face, fromFace) {
    let faces = this._facesToCheck.get(face);
    faces.delete(fromFace);
    if (faces.size === 0) {
      this._facesToCheck.delete(face);
    }
  }

  _addCheckedFace(face, fromFace) {
    if (!this._checkedFaces.has(face)) {
      this._checkedFaces.set(face, new Set([fromFace]));
    } else {
      this._checkedFaces.get(face).add(fromFace);
    }
  }

  done() {
    return this._facesToCheck.size === 0;
  }

  nextFace() {
    let face = this._facesToCheck.keys().next().value;
    let fromFace = this._facesToCheck.get(face).values().next().value;
    return [face, fromFace];
  }

  include(face, fromFace) {
    this._removeFaceToCheck(face, fromFace);
    this._addCheckedFace(face, fromFace);
    this.allFaces.add(face);
    this._addFacesConnectedToEdgeToCheckList(face);
  }

  exclude(face, fromFace) {
    this._removeFaceToCheck(face, fromFace);
    this._addCheckedFace(face, fromFace);
  }
}

// UI functions

function toggleTriangleEdges(visible) {
  stlgroup.children[1].visible = visible;
}

function changeMaxAngle(angle) {
  faceSelector.maxAngle = angle;
  $('.max-angle-label').text(faceSelector.maxAngle);
}

function toggleClampAngle(on) {
  faceSelector.clampAngle = on;
}

// drag and drop STL

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
      stlloader = new THREE.STLLoader();
      stlmesh.geometry = stlloader.parse(e.target.result);
    } catch (exc) {
      $('.dropzone').find('p').text(exc);
      stlmesh.geometry = new THREE.Geometry();
    }
    processStlGeometry(scene, stlmesh.geometry);
  };

  fr.readAsBinaryString(file);
}
