const modelInput = document.getElementById('model-input');
const convertButton = document.getElementById('convert-button');
const viewerContainer = document.getElementById('viewer-container');

let scene, camera, renderer, model, controls, modelFilename;
let minecraftBlocks = [];

async function initPalette() {
    await fetchBlocks();
    const addPaletteEntryButton = document.getElementById('add-palette-entry');
    addPaletteEntryButton.addEventListener('click', () => createPaletteEntry());
    const autoDetectButton = document.getElementById('auto-detect-colors');
    autoDetectButton.addEventListener('click', () => autoDetectColors());
    createPaletteEntry('#ffffff', 'minecraft:stone');
}

async function fetchBlocks() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/MCMrARM/minecraft-block-ids/master/blocks_271.json');
        const blocks = await response.json();
        minecraftBlocks = blocks.map(block => block.name);

        const blockList = document.getElementById('block-list');
        minecraftBlocks.forEach(blockName => {
            const option = document.createElement('option');
            option.value = blockName;
            blockList.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching Minecraft blocks:', error);
    }
}

function createPaletteEntry(color = '#ffffff', block = '') {
    const paletteEntries = document.getElementById('palette-entries');
    const entryDiv = document.createElement('div');
    entryDiv.classList.add('palette-entry');

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = color;

    const blockInput = document.createElement('input');
    blockInput.type = 'text';
    blockInput.setAttribute('list', 'block-list');
    blockInput.placeholder = 'Search block...';
    blockInput.value = block;

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
        entryDiv.remove();
    });

    entryDiv.appendChild(colorInput);
    entryDiv.appendChild(blockInput);
    entryDiv.appendChild(removeButton);
    paletteEntries.appendChild(entryDiv);
}

function autoDetectColors() {
    if (!model) {
        alert('Please load a 3D model first.');
        return;
    }

    const uniqueColors = new Set();
    model.traverse((child) => {
        if (child.isMesh) {
            // Check for material color
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                    if (mat.color) uniqueColors.add(mat.color.getHex());
                });
            } else if (child.material && child.material.color) {
                uniqueColors.add(child.material.color.getHex());
            }

            // Check for vertex colors
            const colors = child.geometry.attributes.color;
            if (colors) {
                for (let i = 0; i < colors.count; i++) {
                    const color = new THREE.Color().fromBufferAttribute(colors, i);
                    uniqueColors.add(color.getHex());
                }
            }
        }
    });

    if (uniqueColors.size === 0) {
        alert('No colors detected in the model.');
        return;
    }

    // Clear existing palette except for a default stone entry if needed
    // const paletteEntries = document.getElementById('palette-entries');
    // paletteEntries.innerHTML = '';

    uniqueColors.forEach(hex => {
        createPaletteEntry('#' + hex.toString(16).padStart(6, '0'), 'minecraft:stone');
    });
}

function initViewer() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, viewerContainer.clientWidth / viewerContainer.clientHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor(0xdddddd);
    renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    viewerContainer.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    camera.position.z = 5;

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

modelInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    modelFilename = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            if (model) {
                scene.remove(model);
            }
            const contents = e.target.result;
            const loader = new THREE.OBJLoader();
            model = loader.parse(contents);
            scene.add(model);
            renderer.render(scene, camera);
            document.body.setAttribute('data-model-loaded', 'true');
        } catch (error) {
            alert('Error loading model: ' + error.message);
        }
    };
    reader.readAsText(file);
});

convertButton.addEventListener('click', () => {
    if (model) {
        convertToSchematic(model);
    } else {
        alert('Please load a 3D model first.');
    }
});

function getPalette() {
    const paletteEntries = document.getElementById('palette-entries').children;
    const palette = [];
    for (const entry of paletteEntries) {
        const color = entry.children[0].value;
        const block = entry.children[1].value;
        palette.push({
            color: new THREE.Color(color).getHex(),
            block
        });
    }
    return palette;
}

function findClosestBlock(color, palette) {
    let minDistance = Infinity;
    let index = 0;
    const targetColor = new THREE.Color(color);

    for (let i = 0; i < palette.length; i++) {
        const paletteColor = new THREE.Color(palette[i].color);
        const distance = targetColor.distanceToSquared(paletteColor);
        if (distance < minDistance) {
            minDistance = distance;
            index = i;
        }
    }
    return index;
}

async function convertToSchematic(model) {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';

    // Use a timeout to allow the UI to update before the heavy computation
    setTimeout(async () => {
        try {
            console.log('Starting conversion...');
            const resolutionInput = document.getElementById('resolution-input');
            const resolution = parseInt(resolutionInput.value, 10);
            const palette = getPalette();
            console.log('Resolution:', resolution, 'Palette:', palette);

            const voxels = voxelize(model, resolution, palette);
            console.log('Voxelization complete. Voxels:', voxels.length);

            const nbtData = createNBT(voxels, resolution, palette);
            console.log('NBT data created.');

            const compressedNbt = await nbtify.write(nbtData, { compressed: true });
            console.log('NBT data compressed.');

            const outputFilename = modelFilename.replace(/\.[^/.]+$/, "") + ".litematic";
            downloadFile(compressedNbt, outputFilename);
            console.log('File download initiated.');
        } catch (error) {
            console.error('Conversion failed:', error);
            alert('An error occurred during conversion. See console for details.');
        } finally {
            loading.style.display = 'none';
        }
    }, 10);
}

function createNBT(voxels, resolution, palette) {
    const {
        Root, Compound, List, Int, String, Long, IntArray, LongArray
    } = nbtify;

    const nbtPalette = [new Compound({
        "Name": new String("minecraft:air")
    })];
    for (const entry of palette) {
        nbtPalette.push(new Compound({
            "Name": new String(entry.block)
        }));
    }

    const packedBlockStates = new LongArray(packBlockStates(voxels, nbtPalette.length));

    return new Root({
        "MinecraftDataVersion": new Int(2730),
        "Version": new Int(5),
        "Regions": new Compound({
            "Unnamed": new Compound({
                "BlockStatePalette": new List(nbtPalette),
                "BlockStates": packedBlockStates,
                "Position": new IntArray([0, 0, 0]),
                "Size": new IntArray([resolution, resolution, resolution])
            })
        }),
        "Metadata": new Compound({
            "Author": new String("3D-to-Schematic"),
            "Description": new String("A schematic generated from a 3D model"),
            "Name": new String("My Schematic"),
            "RegionCount": new Int(1),
            "TimeCreated": new Long(Date.now()),
            "TimeModified": new Long(Date.now()),
            "TotalBlocks": new Int(voxels.length),
            "TotalVolume": new Int(voxels.length)
        })
    });
}

function packBlockStates(blockStates, paletteSize) {
    const bitsPerEntry = Math.max(2, Math.ceil(Math.log2(paletteSize)));
    const entriesPerLong = Math.floor(64 / bitsPerEntry);
    const longArray = new BigInt64Array(Math.ceil(blockStates.length / entriesPerLong));

    for (let i = 0; i < blockStates.length; i++) {
        const longIndex = Math.floor(i / entriesPerLong);
        const bitIndex = (i % entriesPerLong) * bitsPerEntry;
        longArray[longIndex] |= BigInt(blockStates[i]) << BigInt(bitIndex);
    }
    return longArray;
}

function downloadFile(data, filename) {
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function toIndexed(bufferGeometry) {
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', bufferGeometry.getAttribute('position'));
    if (bufferGeometry.getAttribute('color')) {
        newGeometry.setAttribute('color', bufferGeometry.getAttribute('color'));
    }
    if (bufferGeometry.index) {
        newGeometry.setIndex(bufferGeometry.index);
    } else {
        const index = new Uint32Array(bufferGeometry.getAttribute('position').count);
        for (let i = 0; i < index.length; i++) {
            index[i] = i;
        }
        newGeometry.setIndex(new THREE.BufferAttribute(index, 1));
    }
    return newGeometry;
}

function voxelize(model, resolution, palette) {
    const mergedMesh = mergeGeometries(model);
    if (!mergedMesh) return [];
    mergedMesh.geometry.computeBoundsTree();
    const box = new THREE.Box3().setFromObject(mergedMesh);
    const size = new THREE.Vector3();
    box.getSize(size);

    const step = Math.max(size.x, size.y, size.z) / resolution;

    const center = new THREE.Vector3();
    box.getCenter(center);

    const half = resolution / 2;

    const start = new THREE.Vector3(
        center.x - half * step,
        center.y - half * step,
        center.z - half * step
    );

    const voxels = new Uint8Array(resolution * resolution * resolution);
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3(0, 0, 1);

    for (let x = 0; x < resolution; x++) {
        for (let y = 0; y < resolution; y++) {
            for (let z = 0; z < resolution; z++) {
                const point = new THREE.Vector3(
                    start.x + x * step,
                    start.y + y * step,
                    start.z + z * step
                );

                if (isInsideMesh(point, mergedMesh, raycaster, direction)) {
                    const color = getVoxelColor(point, mergedMesh);
                    const blockIndex = findClosestBlock(color, palette);
                    voxels[x + y * resolution + z * resolution * resolution] = blockIndex + 1;
                } else {
                    voxels[x + y * resolution + z * resolution * resolution] = 0;
                }
            }
        }
    }
    return voxels;
}

function getVoxelColor(point, mesh) {
    const bvh = mesh.geometry.boundsTree;
    const target = {};
    const closestPoint = bvh.closestPointToPoint(point, target);

    const pos = mesh.geometry.attributes.position;
    const colors = mesh.geometry.attributes.color;

    if (!colors) {
        let materialColor;
        if (Array.isArray(mesh.material)) {
            const materialIndex = mesh.geometry.groups.find(group =>
                target.faceIndex >= group.start / 3 &&
                target.faceIndex < (group.start + group.count) / 3
            )?.materialIndex || 0;
            materialColor = mesh.material[materialIndex].color;
        } else {
            materialColor = mesh.material.color;
        }
        return materialColor ? materialColor.getHex() : 0xffffff;
    }

    const {
        a, b, c
    } = target.triangle;
    const vA = new THREE.Vector3().fromBufferAttribute(pos, a);
    const vB = new THREE.Vector3().fromBufferAttribute(pos, b);
    const vC = new THREE.Vector3().fromBufferAttribute(pos, c);

    const barycentric = new THREE.Vector3();
    THREE.Triangle.getBarycoord(closestPoint, vA, vB, vC, barycentric);

    const cA = new THREE.Color().fromBufferAttribute(colors, a);
    const cB = new THREE.Color().fromBufferAttribute(colors, b);
    const cC = new THREE.Color().fromBufferAttribute(colors, c);

    const mixedColor = new THREE.Color(0, 0, 0);
    mixedColor.add(cA.multiplyScalar(barycentric.x));
    mixedColor.add(cB.multiplyScalar(barycentric.y));
    mixedColor.add(cC.multiplyScalar(barycentric.z));

    return mixedColor.getHex();
}

function mergeGeometries(model) {
    console.log('Merging geometries...');
    const geometries = [];
    const materials = [];
    model.traverse((child) => {
        if (child.isMesh) {
            const indexedGeometry = toIndexed(child.geometry);
            indexedGeometry.applyMatrix4(child.matrixWorld);
            geometries.push(indexedGeometry);
            materials.push(child.material);
        }
    });

    if (geometries.length === 0) {
        console.log('No geometries found to merge.');
        return null;
    }

    console.log(`Found ${geometries.length} geometries to merge.`);
    const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries, true);
    const mesh = new THREE.Mesh(mergedGeometry, materials);

    console.log('Initializing MeshBVH...');
    mesh.geometry.boundsTree = new window.MeshBVHLib.MeshBVH(mesh.geometry);
    console.log('MeshBVH initialized:', !!mesh.geometry.boundsTree);
    return mesh;
}

function isInsideMesh(point, mesh, raycaster, direction) {
    raycaster.set(point, direction);
    const hits = mesh.geometry.boundsTree.intersectRay(raycaster.ray);
    return hits.length % 2 === 1;
}

initPalette();
initViewer();
