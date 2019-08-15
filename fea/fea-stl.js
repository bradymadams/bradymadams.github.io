var container;
var camera, scene, renderer;
var controls;
var headlamp;
var stlloader;
var stlgroup;
var stlmesh;
var faceSelector;

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

  stlgroup = new THREE.Group();

  scene.add(camera);
  scene.add(ambient);
  scene.add(headlamp);
  scene.add(stlgroup);

  faceSelector = null;
  
  onWindowResize();
  window.addEventListener('resize', onWindowResize, false);

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
    faceSelector.check(scene, camera);
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
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.maxAngle = 10;
    this.clampAngle = true;

    this._lastFaces = new Set();

    this._createInternalMaps(mustShareEdge);
  }

  updateMouse(x, y) {
    let cX = x - renderer.domElement.offsetLeft;
    let cY = y - renderer.domElement.offsetTop;
    this.mouse.x = (cX / renderer.domElement.clientWidth) * 2 - 1;
    this.mouse.y = - (cY / renderer.domElement.clientHeight) * 2 + 1;
  }

  check(scene, camera) {
    this.raycaster.setFromCamera(this.mouse, camera);

    let intersects = this.raycaster.intersectObject(this.mesh);

    if (intersects.length > 0) {
      // only look at closest
      let faces = this.getFaces(intersects[0].faceIndex);

      for (let f = 0; f < this.mesh.geometry.faces.length; f++) {
        if (faces.has(f)) {
          this.mesh.geometry.faces[f].color.setRGB(0, 1, 0);
        } else {
          this.mesh.geometry.faces[f].color.setRGB(0.6, 0.6, 0.6);
        }
      }

      this.mesh.geometry.faces[intersects[0].faceIndex].color.setRGB(0, 0, 1);

      this.mesh.geometry.colorsNeedUpdate = true;

      this._lastFaces = faces;

    } else if (this._lastFaces.size > 0) {
      
      for (let f = 0; f < this.mesh.geometry.faces.length; f++) {
        this.mesh.geometry.faces[f].color.setRGB(0.6, 0.6, 0.6);
      }

      this.mesh.geometry.colorsNeedUpdate = true;

      this._lastFaces = new Set();
    }
  }

  getFaces(faceIndex) {
    let geom = this.mesh.geometry;
    let faces = geom.faces;
    let face0 = faces[faceIndex];

    let continuousFaces = new Set([faceIndex]); // will hold the final list of connected faces
    let facesToCheck = new Set();
    let facesChecked = new Set([faceIndex]);

    let currentFaceIndex = faceIndex;
    let nextFaceIndex = null;

    let maxAngleRadians = this.maxAngle * Math.PI / 180.0;

    let checkForFaceContinuity = (face1, face2) => Math.abs(face1.normal.angleTo(face2.normal)) < maxAngleRadians;

    while (true) {
      let currentEdges = this._faceEdges[currentFaceIndex];

      // for all of the edges that are part of the current face
      // get a list of all other face indices attached to the edge
      for (let e = 0; e < currentEdges.length; e++) {
        let connectedFaces = this._edgeFaces.get(currentEdges[e]);

        for (let f = 0; f < connectedFaces.length; f++) {
          let fi = connectedFaces[f];

          // if this face has already been checked do not add it to
          // the list of faces to check and continue on
          if (this.clampAngle && facesChecked.has(fi)) {
            continue;
          }

          facesToCheck.add(fi);
        }
      }

      // if facesToCheck is empty there's nothing left to check
      // so we exit the loop and we're done
      if (facesToCheck.size == 0) {
        break;
      }
      
      nextFaceIndex = facesToCheck.values().next().value;
      
      facesToCheck.delete(nextFaceIndex);
      facesChecked.add(nextFaceIndex);

      let partOfContinuousFace = false;

      if (this.clampAngle) {
        // compare nextFace normal to face0 normal
        partOfContinuousFace = checkForFaceContinuity(faces[faceIndex], faces[nextFaceIndex]);
      } else {
        // compare nextFace normal to connected face normal
      }

      if (partOfContinuousFace) {
        continuousFaces.add(nextFaceIndex);
        currentFaceIndex = nextFaceIndex;
      }
    }

    return continuousFaces;
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

// UI functions

function toggleTriangleEdges(visible) {
  stlgroup.children[1].visible = visible;
}

function changeMaxAngle(angle) {
  faceSelector.maxAngle = angle;
  $('.max-angle-label').text(faceSelector.maxAngle);
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
