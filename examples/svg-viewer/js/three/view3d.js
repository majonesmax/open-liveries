// A scheme on a 3D aircraft, for the detail panel: built from the shape it's drawn on (a measured type's lines, or a
// built-in shape), wearing the renderer's textures. Drag to turn it, scroll to zoom. Loaded only when the panel
// first shows it, so the list doesn't wait for three.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { isMeasuredShape, renderTexture, schemeOn } from '../../../../renderer/dist/index.js';
import { buildMeasuredAircraft } from './measured-model.js';
import { buildAircraft } from './model.js';
/** ?angle=180&elevation=-20&zoom=3&look=4,1,17 (meters from the aircraft's middle: along, up, out to its left). */
export function cameraFromUrl(params) {
    const [x = 0, y = 0, z = 0] = (params.get('look') ?? '').split(',').map((n) => Number(n) || 0);
    return {
        angle: Number(params.get('angle') ?? 0) || 0,
        elevation: Number(params.get('elevation') ?? 16) || 0,
        zoom: Math.max(Number(params.get('zoom') ?? 1) || 1, 0.1),
        look: [x, y, z],
        still: params.has('angle'),
    };
}
/** An SVG drawn into a canvas `width` pixels wide, as a texture. */
async function svgTexture(svg, width, renderer) {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = Math.round((width * image.naturalHeight) / image.naturalWidth);
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return texture;
    }
    finally {
        URL.revokeObjectURL(url);
    }
}
async function texturesFor(scheme, shape, drawnOn, renderer) {
    const [fuselage, finLeft, finRight, engine, wingletLeft, wingletRight] = await Promise.all([
        svgTexture(renderTexture(scheme, 'fuselage', { shape, drawnOn }), 4096, renderer),
        svgTexture(renderTexture(scheme, 'fin', { shape, side: 'left', drawnOn }), 3000, renderer),
        svgTexture(renderTexture(scheme, 'fin', { shape, side: 'right', drawnOn }), 3000, renderer),
        svgTexture(renderTexture(scheme, 'engine', { shape }), 1024, renderer),
        svgTexture(renderTexture(scheme, 'winglet', { shape, side: 'left', drawnOn }), 512, renderer),
        svgTexture(renderTexture(scheme, 'winglet', { shape, side: 'right', drawnOn }), 512, renderer),
    ]);
    return { fuselage, finLeft, finRight, engine, wingletLeft, wingletRight };
}
/** Frees an aircraft's meshes and textures. */
function dispose(object) {
    object.traverse((node) => {
        if (!(node instanceof THREE.Mesh))
            return;
        node.geometry.dispose();
        for (const material of [node.material].flat()) {
            material.map?.dispose();
            material.dispose();
        }
    });
}
/** One WebGL view, moved into whichever box the panel gives it. */
export class View3D {
    start;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.5, 2000);
    controls = new OrbitControls(this.camera, this.renderer.domElement);
    resizer = new ResizeObserver(() => {
        this.resize();
    });
    box;
    current;
    framed = '';
    request = 0;
    constructor(start) {
        this.start = start;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.scene.add(new THREE.HemisphereLight(0xdfeeff, 0x8a8f96, 2.0));
        const sun = new THREE.DirectionalLight(0xffffff, 2.2);
        sun.position.set(-30, 60, 40);
        this.scene.add(sun);
        this.controls.enableDamping = true;
        this.controls.autoRotateSpeed = 0.8;
    }
    get spinning() {
        return this.controls.autoRotate;
    }
    set spinning(on) {
        this.controls.autoRotate = on;
    }
    /**
     * Paints `base` on `shape` in `box`, fitted from `drawnOn` (the shape it was measured on) by their landmarks; a
     * later call supersedes one still loading.
     */
    async show(box, base, shape, drawnOn) {
        const ticket = ++this.request;
        // The scheme's paint for this type (its `types`), for the model's colors; the textures fit and lay it over.
        const scheme = schemeOn(base, shape);
        const textures = await texturesFor(base, shape, drawnOn, this.renderer);
        if (ticket !== this.request)
            return;
        this.mount(box);
        if (this.current) {
            this.scene.remove(this.current);
            dispose(this.current);
        }
        this.current = isMeasuredShape(shape)
            ? buildMeasuredAircraft(scheme, shape, textures)
            : buildAircraft(scheme, shape, textures);
        this.scene.add(this.current);
        if (this.framed !== shape.name)
            this.frame(shape);
    }
    /** Stops drawing (the panel closed or the 3D view is off). */
    stop() {
        this.request++;
        this.renderer.setAnimationLoop(null);
        this.resizer.disconnect();
        this.renderer.domElement.remove();
        this.box = undefined;
    }
    mount(box) {
        if (this.box === box)
            return;
        this.resizer.disconnect();
        box.replaceChildren(this.renderer.domElement);
        this.box = box;
        this.resizer.observe(box);
        this.resize();
        this.renderer.setAnimationLoop(() => {
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        });
    }
    resize() {
        if (!this.box)
            return;
        const { clientWidth: w, clientHeight: h } = this.box;
        if (!w || !h)
            return;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }
    /** A new shape from the front left, a little above, or where the URL said. */
    frame(shape) {
        const { angle, elevation, zoom, look } = this.start;
        const up = (elevation * Math.PI) / 180;
        const distance = (1.35 * shape.fuselage.length) / zoom;
        const around = Math.atan2(-0.75, 1.05) + (angle * Math.PI) / 180;
        const [x, y, z] = look;
        this.camera.position.set(x + distance * Math.cos(up) * Math.sin(around), y + distance * Math.sin(up), z + distance * Math.cos(up) * Math.cos(around));
        this.controls.target.set(x, y, z);
        this.framed = shape.name;
    }
}
