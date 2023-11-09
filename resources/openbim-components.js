import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { Raycaster as Raycaster$1, Vector3, Quaternion, Euler, Matrix4, Object3D, MeshBasicMaterial, LineBasicMaterial, CylinderGeometry, BoxGeometry, BufferGeometry, Float32BufferAttribute, Mesh, OctahedronGeometry, Line, SphereGeometry, TorusGeometry, PlaneGeometry, DoubleSide, Vector2 } from 'https://unpkg.com/three@0.152.2/build/three.module.js';

class BufferManager {
    /** The current size of the buffers. */
    get size() {
        const firstAttribute = this.attributes[0];
        return firstAttribute.count * 3;
    }
    get attributes() {
        return Object.values(this.geometry.attributes);
    }
    constructor(geometry) {
        this.geometry = geometry;
        /** Buffer increment when geometry size is exceeded, multiple of 3. */
        this.bufferIncrease = 300;
        /**
         * The maximum capacity of the buffers. If exceeded by the {@link size},
         * the buffers will be rescaled.
         */
        this.capacity = 0;
    }
    addAttribute(attribute) {
        this.geometry.setAttribute(attribute.name, attribute);
    }
    resetAttributes() {
        for (const attribute of this.attributes) {
            this.createAttribute(attribute.name);
        }
        this.capacity = 0;
    }
    createAttribute(name) {
        if (this.geometry.hasAttribute(name)) {
            this.geometry.deleteAttribute(name);
        }
        const attribute = new THREE.BufferAttribute(new Float32Array(0), 3);
        attribute.name = name;
        this.geometry.setAttribute(name, attribute);
    }
    updateCount(size) {
        for (const attribute of this.attributes) {
            attribute.count = size;
            attribute.needsUpdate = true;
        }
    }
    resizeIfNeeded(increase) {
        const newSize = this.size + increase * 3;
        const difference = newSize - this.capacity;
        if (difference >= 0) {
            const increase = Math.max(difference, this.bufferIncrease);
            const oldCapacity = this.capacity;
            this.capacity += increase;
            for (const attribute of this.attributes) {
                this.resizeBuffers(attribute, oldCapacity);
            }
        }
    }
    resizeBuffers(attribute, oldCapacity) {
        this.geometry.deleteAttribute(attribute.name);
        const array = new Float32Array(this.capacity);
        const newAttribute = new THREE.BufferAttribute(array, 3);
        newAttribute.name = attribute.name;
        newAttribute.count = attribute.count;
        this.geometry.setAttribute(attribute.name, newAttribute);
        for (let i = 0; i < oldCapacity; i++) {
            const x = attribute.getX(i);
            const y = attribute.getY(i);
            const z = attribute.getZ(i);
            newAttribute.setXYZ(i, x, y, z);
        }
    }
}

/**
 * An object to keep track of entities and its position in a geometric buffer.
 */
class IdIndexMap {
    constructor() {
        this._idGenerator = 0;
        this._ids = [];
        this._indices = [];
    }
    /**
     * The number of items stored in this map
     */
    get size() {
        return this._ids.length;
    }
    /**
     * The list of IDs inside this map. IDs are generated as increasing natural
     * numbers starting from zero. The position of the ID in the array is
     * the index of that entity in the geometric buffer.
     * For instance, the ids of a map with 5 items would look like this:
     *
     * - [0, 1, 2, 3, 4]
     *
     * If the item with ID = 1 is deleted, the last item will replace the deleted
     * one to keep the continuity of the geometric buffer, resulting in this:
     *
     * - [0, 4, 2, 3]
     */
    get ids() {
        return this._ids;
    }
    /**
     * The list of indices of the geometric buffer. The position of the index in
     * the array is the ID of that entity. For instance, the ids of a map with 5
     * items would look like this:
     *
     * - [0, 1, 2, 3, 4]
     *
     * If the item with ID = 1 is deleted, the last item will replace the
     * deleted one to keep the continuity of the geometric buffer. The deleted
     * item will remain as null inside the array:
     *
     * - [0, null, 2, 3, 1]
     */
    get indices() {
        return this._indices;
    }
    /**
     * Adds a new item to the map, creating and assigning a new ID and a new index
     * to it. New items are assumed to be created at the end of the geometric
     * buffer.
     */
    add() {
        this._ids.push(this._idGenerator++);
        const index = this._ids.length - 1;
        this._indices.push(index);
        return index;
    }
    /**
     * Removes the specified item from the map and rearrange the indices to
     * keep the continuity of the geometric buffer.
     */
    remove(id) {
        const index = this.getIndex(id);
        if (index === null || index === undefined)
            return;
        const lastID = this._ids.pop();
        if (lastID === undefined) {
            throw new Error(`Error while removing item: ${id}`);
        }
        this._indices[id] = null;
        if (id === lastID)
            return;
        this._ids[index] = lastID;
        this._indices[lastID] = index;
    }
    /**
     * Resets this instance to the initial state.
     */
    reset() {
        this._idGenerator = 0;
        this._ids = [];
        this._indices = [];
    }
    /**
     * Gets the ID for the given index.
     * @param index index of the entity whose ID to find out.
     */
    getId(index) {
        return this._ids[index];
    }
    /**
     * Gets the index for the given ID.
     * @param id ID of the entity whose index to find out.
     */
    getIndex(id) {
        return this._indices[id];
    }
    /**
     * Gets the last index of the geometry buffer.
     */
    getLastIndex() {
        return this.size - 1;
    }
    /**
     * Gets the last ID in the geometry buffer.
     */
    getLastID() {
        return this._ids[this._ids.length - 1];
    }
}

class Selector {
    constructor() {
        this.data = new Set();
    }
    /**
     * Select or unselects the given faces.
     * @param active Whether to select or unselect.
     * @param ids List of faces IDs to select or unselect. If not
     * defined, all faces will be selected or deselected.
     * @param allItems all the existing items.
     */
    select(active, ids, allItems) {
        const all = new Set(allItems);
        const idsToUpdate = [];
        for (const id of ids) {
            const exists = all.has(id);
            if (!exists)
                continue;
            const isAlreadySelected = this.data.has(id);
            if (active) {
                if (isAlreadySelected)
                    continue;
                this.data.add(id);
                idsToUpdate.push(id);
            }
            else {
                if (!isAlreadySelected)
                    continue;
                this.data.delete(id);
                idsToUpdate.push(id);
            }
        }
        return idsToUpdate;
    }
    getUnselected(ids) {
        const notSelectedIDs = [];
        for (const id of ids) {
            if (!this.data.has(id)) {
                notSelectedIDs.push(id);
            }
        }
        return notSelectedIDs;
    }
}

class Vector {
    static get up() {
        return [0, 1, 0];
    }
    static round(vector, precission = 1000) {
        return [
            Math.round(vector[0] * precission) / precission,
            Math.round(vector[1] * precission) / precission,
            Math.round(vector[2] * precission) / precission,
        ];
    }
    static getNormal(points) {
        const a = Vector.subtract(points[0], points[1]);
        const b = Vector.subtract(points[1], points[2]);
        const [x, y, z] = this.multiply(a, b);
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        return [x / magnitude, y / magnitude, z / magnitude];
    }
    static dot(v1, v2) {
        return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    }
    static multiply(v1, v2) {
        const x = v1[1] * v2[2] - v1[2] * v2[1];
        const y = v1[2] * v2[0] - v1[0] * v2[2];
        const z = v1[0] * v2[1] - v1[1] * v2[0];
        return [x, y, z];
    }
    static normalize(vector) {
        const [x, y, z] = vector;
        const magnitude = Vector.magnitude(vector);
        return [x / magnitude, y / magnitude, z / magnitude];
    }
    static magnitude(vector) {
        const [x, y, z] = vector;
        return Math.sqrt(x * x + y * y + z * z);
    }
    static squaredMagnitude(vector) {
        const [x, y, z] = vector;
        return x * x + y * y + z * z;
    }
    static add(...vectors) {
        const result = [0, 0, 0];
        for (const vector of vectors) {
            result[0] += vector[0];
            result[1] += vector[1];
            result[2] += vector[2];
        }
        return result;
    }
    static subtract(v1, v2) {
        const [x1, y1, z1] = v1;
        const [x2, y2, z2] = v2;
        return [x2 - x1, y2 - y1, z2 - z1];
    }
    static multiplyScalar(vector, scalar) {
        return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
    }
}

class Raycaster {
    get trackMouse() {
        return this._trackMouse;
    }
    set trackMouse(active) {
        this._trackMouse = active;
        if (active) {
            window.addEventListener("mousemove", this.getMousePosition);
        }
        else {
            window.removeEventListener("mousemove", this.getMousePosition);
        }
    }
    constructor() {
        this._mouse = new THREE.Vector2();
        this._mouseEvent = new THREE.Vector2();
        this._trackMouse = false;
        this.getMousePosition = (event) => {
            this._mouseEvent.x = event.clientX;
            this._mouseEvent.y = event.clientY;
        };
        this.core = new THREE.Raycaster();
        if (!this.core.params.Points) {
            throw new Error("Raycaster has undefined Points");
        }
        this.core.params.Points.threshold = 0.2;
    }
    cast(items) {
        if (!this.domElement || !this.camera) {
            throw new Error("DOM element and camera must be initialized!");
        }
        const x = this._mouseEvent.x;
        const y = this._mouseEvent.y;
        const b = this.domElement.getBoundingClientRect();
        this._mouse.x = ((x - b.left) / (b.right - b.left)) * 2 - 1;
        this._mouse.y = -((y - b.top) / (b.bottom - b.top)) * 2 + 1;
        this.core.setFromCamera(this._mouse, this.camera);
        return this.core.intersectObjects(items);
    }
}

const _raycaster = new Raycaster$1();

const _tempVector = new Vector3();
const _tempVector2 = new Vector3();
const _tempQuaternion = new Quaternion();
const _unit = {
	X: new Vector3( 1, 0, 0 ),
	Y: new Vector3( 0, 1, 0 ),
	Z: new Vector3( 0, 0, 1 )
};

const _changeEvent = { type: 'change' };
const _mouseDownEvent = { type: 'mouseDown' };
const _mouseUpEvent = { type: 'mouseUp', mode: null };
const _objectChangeEvent = { type: 'objectChange' };

class TransformControls extends Object3D {

	constructor( camera, domElement ) {

		super();

		if ( domElement === undefined ) {

			console.warn( 'THREE.TransformControls: The second parameter "domElement" is now mandatory.' );
			domElement = document;

		}

		this.isTransformControls = true;

		this.visible = false;
		this.domElement = domElement;
		this.domElement.style.touchAction = 'none'; // disable touch scroll

		const _gizmo = new TransformControlsGizmo();
		this._gizmo = _gizmo;
		this.add( _gizmo );

		const _plane = new TransformControlsPlane();
		this._plane = _plane;
		this.add( _plane );

		const scope = this;

		// Defined getter, setter and store for a property
		function defineProperty( propName, defaultValue ) {

			let propValue = defaultValue;

			Object.defineProperty( scope, propName, {

				get: function () {

					return propValue !== undefined ? propValue : defaultValue;

				},

				set: function ( value ) {

					if ( propValue !== value ) {

						propValue = value;
						_plane[ propName ] = value;
						_gizmo[ propName ] = value;

						scope.dispatchEvent( { type: propName + '-changed', value: value } );
						scope.dispatchEvent( _changeEvent );

					}

				}

			} );

			scope[ propName ] = defaultValue;
			_plane[ propName ] = defaultValue;
			_gizmo[ propName ] = defaultValue;

		}

		// Define properties with getters/setter
		// Setting the defined property will automatically trigger change event
		// Defined properties are passed down to gizmo and plane

		defineProperty( 'camera', camera );
		defineProperty( 'object', undefined );
		defineProperty( 'enabled', true );
		defineProperty( 'axis', null );
		defineProperty( 'mode', 'translate' );
		defineProperty( 'translationSnap', null );
		defineProperty( 'rotationSnap', null );
		defineProperty( 'scaleSnap', null );
		defineProperty( 'space', 'world' );
		defineProperty( 'size', 1 );
		defineProperty( 'dragging', false );
		defineProperty( 'showX', true );
		defineProperty( 'showY', true );
		defineProperty( 'showZ', true );

		// Reusable utility variables

		const worldPosition = new Vector3();
		const worldPositionStart = new Vector3();
		const worldQuaternion = new Quaternion();
		const worldQuaternionStart = new Quaternion();
		const cameraPosition = new Vector3();
		const cameraQuaternion = new Quaternion();
		const pointStart = new Vector3();
		const pointEnd = new Vector3();
		const rotationAxis = new Vector3();
		const rotationAngle = 0;
		const eye = new Vector3();

		// TODO: remove properties unused in plane and gizmo

		defineProperty( 'worldPosition', worldPosition );
		defineProperty( 'worldPositionStart', worldPositionStart );
		defineProperty( 'worldQuaternion', worldQuaternion );
		defineProperty( 'worldQuaternionStart', worldQuaternionStart );
		defineProperty( 'cameraPosition', cameraPosition );
		defineProperty( 'cameraQuaternion', cameraQuaternion );
		defineProperty( 'pointStart', pointStart );
		defineProperty( 'pointEnd', pointEnd );
		defineProperty( 'rotationAxis', rotationAxis );
		defineProperty( 'rotationAngle', rotationAngle );
		defineProperty( 'eye', eye );

		this._offset = new Vector3();
		this._startNorm = new Vector3();
		this._endNorm = new Vector3();
		this._cameraScale = new Vector3();

		this._parentPosition = new Vector3();
		this._parentQuaternion = new Quaternion();
		this._parentQuaternionInv = new Quaternion();
		this._parentScale = new Vector3();

		this._worldScaleStart = new Vector3();
		this._worldQuaternionInv = new Quaternion();
		this._worldScale = new Vector3();

		this._positionStart = new Vector3();
		this._quaternionStart = new Quaternion();
		this._scaleStart = new Vector3();

		this._getPointer = getPointer.bind( this );
		this._onPointerDown = onPointerDown.bind( this );
		this._onPointerHover = onPointerHover.bind( this );
		this._onPointerMove = onPointerMove.bind( this );
		this._onPointerUp = onPointerUp.bind( this );

		this.domElement.addEventListener( 'pointerdown', this._onPointerDown );
		this.domElement.addEventListener( 'pointermove', this._onPointerHover );
		this.domElement.addEventListener( 'pointerup', this._onPointerUp );

	}

	// updateMatrixWorld  updates key transformation variables
	updateMatrixWorld() {

		if ( this.object !== undefined ) {

			this.object.updateMatrixWorld();

			if ( this.object.parent === null ) {

				console.error( 'TransformControls: The attached 3D object must be a part of the scene graph.' );

			} else {

				this.object.parent.matrixWorld.decompose( this._parentPosition, this._parentQuaternion, this._parentScale );

			}

			this.object.matrixWorld.decompose( this.worldPosition, this.worldQuaternion, this._worldScale );

			this._parentQuaternionInv.copy( this._parentQuaternion ).invert();
			this._worldQuaternionInv.copy( this.worldQuaternion ).invert();

		}

		this.camera.updateMatrixWorld();
		this.camera.matrixWorld.decompose( this.cameraPosition, this.cameraQuaternion, this._cameraScale );

		if ( this.camera.isOrthographicCamera ) {

			this.camera.getWorldDirection( this.eye ).negate();

		} else {

			this.eye.copy( this.cameraPosition ).sub( this.worldPosition ).normalize();

		}

		super.updateMatrixWorld( this );

	}

	pointerHover( pointer ) {

		if ( this.object === undefined || this.dragging === true ) return;

		_raycaster.setFromCamera( pointer, this.camera );

		const intersect = intersectObjectWithRay( this._gizmo.picker[ this.mode ], _raycaster );

		if ( intersect ) {

			this.axis = intersect.object.name;

		} else {

			this.axis = null;

		}

	}

	pointerDown( pointer ) {

		if ( this.object === undefined || this.dragging === true || pointer.button !== 0 ) return;

		if ( this.axis !== null ) {

			_raycaster.setFromCamera( pointer, this.camera );

			const planeIntersect = intersectObjectWithRay( this._plane, _raycaster, true );

			if ( planeIntersect ) {

				this.object.updateMatrixWorld();
				this.object.parent.updateMatrixWorld();

				this._positionStart.copy( this.object.position );
				this._quaternionStart.copy( this.object.quaternion );
				this._scaleStart.copy( this.object.scale );

				this.object.matrixWorld.decompose( this.worldPositionStart, this.worldQuaternionStart, this._worldScaleStart );

				this.pointStart.copy( planeIntersect.point ).sub( this.worldPositionStart );

			}

			this.dragging = true;
			_mouseDownEvent.mode = this.mode;
			this.dispatchEvent( _mouseDownEvent );

		}

	}

	pointerMove( pointer ) {

		const axis = this.axis;
		const mode = this.mode;
		const object = this.object;
		let space = this.space;

		if ( mode === 'scale' ) {

			space = 'local';

		} else if ( axis === 'E' || axis === 'XYZE' || axis === 'XYZ' ) {

			space = 'world';

		}

		if ( object === undefined || axis === null || this.dragging === false || pointer.button !== - 1 ) return;

		_raycaster.setFromCamera( pointer, this.camera );

		const planeIntersect = intersectObjectWithRay( this._plane, _raycaster, true );

		if ( ! planeIntersect ) return;

		this.pointEnd.copy( planeIntersect.point ).sub( this.worldPositionStart );

		if ( mode === 'translate' ) {

			// Apply translate

			this._offset.copy( this.pointEnd ).sub( this.pointStart );

			if ( space === 'local' && axis !== 'XYZ' ) {

				this._offset.applyQuaternion( this._worldQuaternionInv );

			}

			if ( axis.indexOf( 'X' ) === - 1 ) this._offset.x = 0;
			if ( axis.indexOf( 'Y' ) === - 1 ) this._offset.y = 0;
			if ( axis.indexOf( 'Z' ) === - 1 ) this._offset.z = 0;

			if ( space === 'local' && axis !== 'XYZ' ) {

				this._offset.applyQuaternion( this._quaternionStart ).divide( this._parentScale );

			} else {

				this._offset.applyQuaternion( this._parentQuaternionInv ).divide( this._parentScale );

			}

			object.position.copy( this._offset ).add( this._positionStart );

			// Apply translation snap

			if ( this.translationSnap ) {

				if ( space === 'local' ) {

					object.position.applyQuaternion( _tempQuaternion.copy( this._quaternionStart ).invert() );

					if ( axis.search( 'X' ) !== - 1 ) {

						object.position.x = Math.round( object.position.x / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Y' ) !== - 1 ) {

						object.position.y = Math.round( object.position.y / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Z' ) !== - 1 ) {

						object.position.z = Math.round( object.position.z / this.translationSnap ) * this.translationSnap;

					}

					object.position.applyQuaternion( this._quaternionStart );

				}

				if ( space === 'world' ) {

					if ( object.parent ) {

						object.position.add( _tempVector.setFromMatrixPosition( object.parent.matrixWorld ) );

					}

					if ( axis.search( 'X' ) !== - 1 ) {

						object.position.x = Math.round( object.position.x / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Y' ) !== - 1 ) {

						object.position.y = Math.round( object.position.y / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Z' ) !== - 1 ) {

						object.position.z = Math.round( object.position.z / this.translationSnap ) * this.translationSnap;

					}

					if ( object.parent ) {

						object.position.sub( _tempVector.setFromMatrixPosition( object.parent.matrixWorld ) );

					}

				}

			}

		} else if ( mode === 'scale' ) {

			if ( axis.search( 'XYZ' ) !== - 1 ) {

				let d = this.pointEnd.length() / this.pointStart.length();

				if ( this.pointEnd.dot( this.pointStart ) < 0 ) d *= - 1;

				_tempVector2.set( d, d, d );

			} else {

				_tempVector.copy( this.pointStart );
				_tempVector2.copy( this.pointEnd );

				_tempVector.applyQuaternion( this._worldQuaternionInv );
				_tempVector2.applyQuaternion( this._worldQuaternionInv );

				_tempVector2.divide( _tempVector );

				if ( axis.search( 'X' ) === - 1 ) {

					_tempVector2.x = 1;

				}

				if ( axis.search( 'Y' ) === - 1 ) {

					_tempVector2.y = 1;

				}

				if ( axis.search( 'Z' ) === - 1 ) {

					_tempVector2.z = 1;

				}

			}

			// Apply scale

			object.scale.copy( this._scaleStart ).multiply( _tempVector2 );

			if ( this.scaleSnap ) {

				if ( axis.search( 'X' ) !== - 1 ) {

					object.scale.x = Math.round( object.scale.x / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

				}

				if ( axis.search( 'Y' ) !== - 1 ) {

					object.scale.y = Math.round( object.scale.y / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

				}

				if ( axis.search( 'Z' ) !== - 1 ) {

					object.scale.z = Math.round( object.scale.z / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

				}

			}

		} else if ( mode === 'rotate' ) {

			this._offset.copy( this.pointEnd ).sub( this.pointStart );

			const ROTATION_SPEED = 20 / this.worldPosition.distanceTo( _tempVector.setFromMatrixPosition( this.camera.matrixWorld ) );

			if ( axis === 'E' ) {

				this.rotationAxis.copy( this.eye );
				this.rotationAngle = this.pointEnd.angleTo( this.pointStart );

				this._startNorm.copy( this.pointStart ).normalize();
				this._endNorm.copy( this.pointEnd ).normalize();

				this.rotationAngle *= ( this._endNorm.cross( this._startNorm ).dot( this.eye ) < 0 ? 1 : - 1 );

			} else if ( axis === 'XYZE' ) {

				this.rotationAxis.copy( this._offset ).cross( this.eye ).normalize();
				this.rotationAngle = this._offset.dot( _tempVector.copy( this.rotationAxis ).cross( this.eye ) ) * ROTATION_SPEED;

			} else if ( axis === 'X' || axis === 'Y' || axis === 'Z' ) {

				this.rotationAxis.copy( _unit[ axis ] );

				_tempVector.copy( _unit[ axis ] );

				if ( space === 'local' ) {

					_tempVector.applyQuaternion( this.worldQuaternion );

				}

				this.rotationAngle = this._offset.dot( _tempVector.cross( this.eye ).normalize() ) * ROTATION_SPEED;

			}

			// Apply rotation snap

			if ( this.rotationSnap ) this.rotationAngle = Math.round( this.rotationAngle / this.rotationSnap ) * this.rotationSnap;

			// Apply rotate
			if ( space === 'local' && axis !== 'E' && axis !== 'XYZE' ) {

				object.quaternion.copy( this._quaternionStart );
				object.quaternion.multiply( _tempQuaternion.setFromAxisAngle( this.rotationAxis, this.rotationAngle ) ).normalize();

			} else {

				this.rotationAxis.applyQuaternion( this._parentQuaternionInv );
				object.quaternion.copy( _tempQuaternion.setFromAxisAngle( this.rotationAxis, this.rotationAngle ) );
				object.quaternion.multiply( this._quaternionStart ).normalize();

			}

		}

		this.dispatchEvent( _changeEvent );
		this.dispatchEvent( _objectChangeEvent );

	}

	pointerUp( pointer ) {

		if ( pointer.button !== 0 ) return;

		if ( this.dragging && ( this.axis !== null ) ) {

			_mouseUpEvent.mode = this.mode;
			this.dispatchEvent( _mouseUpEvent );

		}

		this.dragging = false;
		this.axis = null;

	}

	dispose() {

		this.domElement.removeEventListener( 'pointerdown', this._onPointerDown );
		this.domElement.removeEventListener( 'pointermove', this._onPointerHover );
		this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
		this.domElement.removeEventListener( 'pointerup', this._onPointerUp );

		this.traverse( function ( child ) {

			if ( child.geometry ) child.geometry.dispose();
			if ( child.material ) child.material.dispose();

		} );

	}

	// Set current object
	attach( object ) {

		this.object = object;
		this.visible = true;

		return this;

	}

	// Detach from object
	detach() {

		this.object = undefined;
		this.visible = false;
		this.axis = null;

		return this;

	}

	reset() {

		if ( ! this.enabled ) return;

		if ( this.dragging ) {

			this.object.position.copy( this._positionStart );
			this.object.quaternion.copy( this._quaternionStart );
			this.object.scale.copy( this._scaleStart );

			this.dispatchEvent( _changeEvent );
			this.dispatchEvent( _objectChangeEvent );

			this.pointStart.copy( this.pointEnd );

		}

	}

	getRaycaster() {

		return _raycaster;

	}

	// TODO: deprecate

	getMode() {

		return this.mode;

	}

	setMode( mode ) {

		this.mode = mode;

	}

	setTranslationSnap( translationSnap ) {

		this.translationSnap = translationSnap;

	}

	setRotationSnap( rotationSnap ) {

		this.rotationSnap = rotationSnap;

	}

	setScaleSnap( scaleSnap ) {

		this.scaleSnap = scaleSnap;

	}

	setSize( size ) {

		this.size = size;

	}

	setSpace( space ) {

		this.space = space;

	}

}

// mouse / touch event handlers

function getPointer( event ) {

	if ( this.domElement.ownerDocument.pointerLockElement ) {

		return {
			x: 0,
			y: 0,
			button: event.button
		};

	} else {

		const rect = this.domElement.getBoundingClientRect();

		return {
			x: ( event.clientX - rect.left ) / rect.width * 2 - 1,
			y: - ( event.clientY - rect.top ) / rect.height * 2 + 1,
			button: event.button
		};

	}

}

function onPointerHover( event ) {

	if ( ! this.enabled ) return;

	switch ( event.pointerType ) {

		case 'mouse':
		case 'pen':
			this.pointerHover( this._getPointer( event ) );
			break;

	}

}

function onPointerDown( event ) {

	if ( ! this.enabled ) return;

	if ( ! document.pointerLockElement ) {

		this.domElement.setPointerCapture( event.pointerId );

	}

	this.domElement.addEventListener( 'pointermove', this._onPointerMove );

	this.pointerHover( this._getPointer( event ) );
	this.pointerDown( this._getPointer( event ) );

}

function onPointerMove( event ) {

	if ( ! this.enabled ) return;

	this.pointerMove( this._getPointer( event ) );

}

function onPointerUp( event ) {

	if ( ! this.enabled ) return;

	this.domElement.releasePointerCapture( event.pointerId );

	this.domElement.removeEventListener( 'pointermove', this._onPointerMove );

	this.pointerUp( this._getPointer( event ) );

}

function intersectObjectWithRay( object, raycaster, includeInvisible ) {

	const allIntersections = raycaster.intersectObject( object, true );

	for ( let i = 0; i < allIntersections.length; i ++ ) {

		if ( allIntersections[ i ].object.visible || includeInvisible ) {

			return allIntersections[ i ];

		}

	}

	return false;

}

//

// Reusable utility variables

const _tempEuler = new Euler();
const _alignVector = new Vector3( 0, 1, 0 );
const _zeroVector = new Vector3( 0, 0, 0 );
const _lookAtMatrix = new Matrix4();
const _tempQuaternion2 = new Quaternion();
const _identityQuaternion = new Quaternion();
const _dirVector = new Vector3();
const _tempMatrix = new Matrix4();

const _unitX = new Vector3( 1, 0, 0 );
const _unitY = new Vector3( 0, 1, 0 );
const _unitZ = new Vector3( 0, 0, 1 );

const _v1 = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();

class TransformControlsGizmo extends Object3D {

	constructor() {

		super();

		this.isTransformControlsGizmo = true;

		this.type = 'TransformControlsGizmo';

		// shared materials

		const gizmoMaterial = new MeshBasicMaterial( {
			depthTest: false,
			depthWrite: false,
			fog: false,
			toneMapped: false,
			transparent: true
		} );

		const gizmoLineMaterial = new LineBasicMaterial( {
			depthTest: false,
			depthWrite: false,
			fog: false,
			toneMapped: false,
			transparent: true
		} );

		// Make unique material for each axis/color

		const matInvisible = gizmoMaterial.clone();
		matInvisible.opacity = 0.15;

		const matHelper = gizmoLineMaterial.clone();
		matHelper.opacity = 0.5;

		const matRed = gizmoMaterial.clone();
		matRed.color.setHex( 0xff0000 );

		const matGreen = gizmoMaterial.clone();
		matGreen.color.setHex( 0x00ff00 );

		const matBlue = gizmoMaterial.clone();
		matBlue.color.setHex( 0x0000ff );

		const matRedTransparent = gizmoMaterial.clone();
		matRedTransparent.color.setHex( 0xff0000 );
		matRedTransparent.opacity = 0.5;

		const matGreenTransparent = gizmoMaterial.clone();
		matGreenTransparent.color.setHex( 0x00ff00 );
		matGreenTransparent.opacity = 0.5;

		const matBlueTransparent = gizmoMaterial.clone();
		matBlueTransparent.color.setHex( 0x0000ff );
		matBlueTransparent.opacity = 0.5;

		const matWhiteTransparent = gizmoMaterial.clone();
		matWhiteTransparent.opacity = 0.25;

		const matYellowTransparent = gizmoMaterial.clone();
		matYellowTransparent.color.setHex( 0xffff00 );
		matYellowTransparent.opacity = 0.25;

		const matYellow = gizmoMaterial.clone();
		matYellow.color.setHex( 0xffff00 );

		const matGray = gizmoMaterial.clone();
		matGray.color.setHex( 0x787878 );

		// reusable geometry

		const arrowGeometry = new CylinderGeometry( 0, 0.04, 0.1, 12 );
		arrowGeometry.translate( 0, 0.05, 0 );

		const scaleHandleGeometry = new BoxGeometry( 0.08, 0.08, 0.08 );
		scaleHandleGeometry.translate( 0, 0.04, 0 );

		const lineGeometry = new BufferGeometry();
		lineGeometry.setAttribute( 'position', new Float32BufferAttribute( [ 0, 0, 0,	1, 0, 0 ], 3 ) );

		const lineGeometry2 = new CylinderGeometry( 0.0075, 0.0075, 0.5, 3 );
		lineGeometry2.translate( 0, 0.25, 0 );

		function CircleGeometry( radius, arc ) {

			const geometry = new TorusGeometry( radius, 0.0075, 3, 64, arc * Math.PI * 2 );
			geometry.rotateY( Math.PI / 2 );
			geometry.rotateX( Math.PI / 2 );
			return geometry;

		}

		// Special geometry for transform helper. If scaled with position vector it spans from [0,0,0] to position

		function TranslateHelperGeometry() {

			const geometry = new BufferGeometry();

			geometry.setAttribute( 'position', new Float32BufferAttribute( [ 0, 0, 0, 1, 1, 1 ], 3 ) );

			return geometry;

		}

		// Gizmo definitions - custom hierarchy definitions for setupGizmo() function

		const gizmoTranslate = {
			X: [
				[ new Mesh( arrowGeometry, matRed ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
				[ new Mesh( arrowGeometry, matRed ), [ - 0.5, 0, 0 ], [ 0, 0, Math.PI / 2 ]],
				[ new Mesh( lineGeometry2, matRed ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]]
			],
			Y: [
				[ new Mesh( arrowGeometry, matGreen ), [ 0, 0.5, 0 ]],
				[ new Mesh( arrowGeometry, matGreen ), [ 0, - 0.5, 0 ], [ Math.PI, 0, 0 ]],
				[ new Mesh( lineGeometry2, matGreen ) ]
			],
			Z: [
				[ new Mesh( arrowGeometry, matBlue ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ]],
				[ new Mesh( arrowGeometry, matBlue ), [ 0, 0, - 0.5 ], [ - Math.PI / 2, 0, 0 ]],
				[ new Mesh( lineGeometry2, matBlue ), null, [ Math.PI / 2, 0, 0 ]]
			],
			XYZ: [
				[ new Mesh( new OctahedronGeometry( 0.1, 0 ), matWhiteTransparent.clone() ), [ 0, 0, 0 ]]
			],
			XY: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matBlueTransparent.clone() ), [ 0.15, 0.15, 0 ]]
			],
			YZ: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matRedTransparent.clone() ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]
			],
			XZ: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matGreenTransparent.clone() ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]
			]
		};

		const pickerTranslate = {
			X: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0.3, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ - 0.3, 0, 0 ], [ 0, 0, Math.PI / 2 ]]
			],
			Y: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0.3, 0 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, - 0.3, 0 ], [ 0, 0, Math.PI ]]
			],
			Z: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, 0.3 ], [ Math.PI / 2, 0, 0 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, - 0.3 ], [ - Math.PI / 2, 0, 0 ]]
			],
			XYZ: [
				[ new Mesh( new OctahedronGeometry( 0.2, 0 ), matInvisible ) ]
			],
			XY: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0.15, 0 ]]
			],
			YZ: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]
			],
			XZ: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]
			]
		};

		const helperTranslate = {
			START: [
				[ new Mesh( new OctahedronGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]
			],
			END: [
				[ new Mesh( new OctahedronGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]
			],
			DELTA: [
				[ new Line( TranslateHelperGeometry(), matHelper ), null, null, null, 'helper' ]
			],
			X: [
				[ new Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
			],
			Y: [
				[ new Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]
			],
			Z: [
				[ new Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]
			]
		};

		const gizmoRotate = {
			XYZE: [
				[ new Mesh( CircleGeometry( 0.5, 1 ), matGray ), null, [ 0, Math.PI / 2, 0 ]]
			],
			X: [
				[ new Mesh( CircleGeometry( 0.5, 0.5 ), matRed ) ]
			],
			Y: [
				[ new Mesh( CircleGeometry( 0.5, 0.5 ), matGreen ), null, [ 0, 0, - Math.PI / 2 ]]
			],
			Z: [
				[ new Mesh( CircleGeometry( 0.5, 0.5 ), matBlue ), null, [ 0, Math.PI / 2, 0 ]]
			],
			E: [
				[ new Mesh( CircleGeometry( 0.75, 1 ), matYellowTransparent ), null, [ 0, Math.PI / 2, 0 ]]
			]
		};

		const helperRotate = {
			AXIS: [
				[ new Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
			]
		};

		const pickerRotate = {
			XYZE: [
				[ new Mesh( new SphereGeometry( 0.25, 10, 8 ), matInvisible ) ]
			],
			X: [
				[ new Mesh( new TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, - Math.PI / 2, - Math.PI / 2 ]],
			],
			Y: [
				[ new Mesh( new TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ]],
			],
			Z: [
				[ new Mesh( new TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
			],
			E: [
				[ new Mesh( new TorusGeometry( 0.75, 0.1, 2, 24 ), matInvisible ) ]
			]
		};

		const gizmoScale = {
			X: [
				[ new Mesh( scaleHandleGeometry, matRed ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
				[ new Mesh( lineGeometry2, matRed ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
				[ new Mesh( scaleHandleGeometry, matRed ), [ - 0.5, 0, 0 ], [ 0, 0, Math.PI / 2 ]],
			],
			Y: [
				[ new Mesh( scaleHandleGeometry, matGreen ), [ 0, 0.5, 0 ]],
				[ new Mesh( lineGeometry2, matGreen ) ],
				[ new Mesh( scaleHandleGeometry, matGreen ), [ 0, - 0.5, 0 ], [ 0, 0, Math.PI ]],
			],
			Z: [
				[ new Mesh( scaleHandleGeometry, matBlue ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ]],
				[ new Mesh( lineGeometry2, matBlue ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ]],
				[ new Mesh( scaleHandleGeometry, matBlue ), [ 0, 0, - 0.5 ], [ - Math.PI / 2, 0, 0 ]]
			],
			XY: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matBlueTransparent ), [ 0.15, 0.15, 0 ]]
			],
			YZ: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matRedTransparent ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]
			],
			XZ: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matGreenTransparent ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]
			],
			XYZ: [
				[ new Mesh( new BoxGeometry( 0.1, 0.1, 0.1 ), matWhiteTransparent.clone() ) ],
			]
		};

		const pickerScale = {
			X: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0.3, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ - 0.3, 0, 0 ], [ 0, 0, Math.PI / 2 ]]
			],
			Y: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0.3, 0 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, - 0.3, 0 ], [ 0, 0, Math.PI ]]
			],
			Z: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, 0.3 ], [ Math.PI / 2, 0, 0 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, - 0.3 ], [ - Math.PI / 2, 0, 0 ]]
			],
			XY: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0.15, 0 ]],
			],
			YZ: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]],
			],
			XZ: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]],
			],
			XYZ: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.2 ), matInvisible ), [ 0, 0, 0 ]],
			]
		};

		const helperScale = {
			X: [
				[ new Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
			],
			Y: [
				[ new Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]
			],
			Z: [
				[ new Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]
			]
		};

		// Creates an Object3D with gizmos described in custom hierarchy definition.

		function setupGizmo( gizmoMap ) {

			const gizmo = new Object3D();

			for ( const name in gizmoMap ) {

				for ( let i = gizmoMap[ name ].length; i --; ) {

					const object = gizmoMap[ name ][ i ][ 0 ].clone();
					const position = gizmoMap[ name ][ i ][ 1 ];
					const rotation = gizmoMap[ name ][ i ][ 2 ];
					const scale = gizmoMap[ name ][ i ][ 3 ];
					const tag = gizmoMap[ name ][ i ][ 4 ];

					// name and tag properties are essential for picking and updating logic.
					object.name = name;
					object.tag = tag;

					if ( position ) {

						object.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );

					}

					if ( rotation ) {

						object.rotation.set( rotation[ 0 ], rotation[ 1 ], rotation[ 2 ] );

					}

					if ( scale ) {

						object.scale.set( scale[ 0 ], scale[ 1 ], scale[ 2 ] );

					}

					object.updateMatrix();

					const tempGeometry = object.geometry.clone();
					tempGeometry.applyMatrix4( object.matrix );
					object.geometry = tempGeometry;
					object.renderOrder = Infinity;

					object.position.set( 0, 0, 0 );
					object.rotation.set( 0, 0, 0 );
					object.scale.set( 1, 1, 1 );

					gizmo.add( object );

				}

			}

			return gizmo;

		}

		// Gizmo creation

		this.gizmo = {};
		this.picker = {};
		this.helper = {};

		this.add( this.gizmo[ 'translate' ] = setupGizmo( gizmoTranslate ) );
		this.add( this.gizmo[ 'rotate' ] = setupGizmo( gizmoRotate ) );
		this.add( this.gizmo[ 'scale' ] = setupGizmo( gizmoScale ) );
		this.add( this.picker[ 'translate' ] = setupGizmo( pickerTranslate ) );
		this.add( this.picker[ 'rotate' ] = setupGizmo( pickerRotate ) );
		this.add( this.picker[ 'scale' ] = setupGizmo( pickerScale ) );
		this.add( this.helper[ 'translate' ] = setupGizmo( helperTranslate ) );
		this.add( this.helper[ 'rotate' ] = setupGizmo( helperRotate ) );
		this.add( this.helper[ 'scale' ] = setupGizmo( helperScale ) );

		// Pickers should be hidden always

		this.picker[ 'translate' ].visible = false;
		this.picker[ 'rotate' ].visible = false;
		this.picker[ 'scale' ].visible = false;

	}

	// updateMatrixWorld will update transformations and appearance of individual handles

	updateMatrixWorld( force ) {

		const space = ( this.mode === 'scale' ) ? 'local' : this.space; // scale always oriented to local rotation

		const quaternion = ( space === 'local' ) ? this.worldQuaternion : _identityQuaternion;

		// Show only gizmos for current transform mode

		this.gizmo[ 'translate' ].visible = this.mode === 'translate';
		this.gizmo[ 'rotate' ].visible = this.mode === 'rotate';
		this.gizmo[ 'scale' ].visible = this.mode === 'scale';

		this.helper[ 'translate' ].visible = this.mode === 'translate';
		this.helper[ 'rotate' ].visible = this.mode === 'rotate';
		this.helper[ 'scale' ].visible = this.mode === 'scale';


		let handles = [];
		handles = handles.concat( this.picker[ this.mode ].children );
		handles = handles.concat( this.gizmo[ this.mode ].children );
		handles = handles.concat( this.helper[ this.mode ].children );

		for ( let i = 0; i < handles.length; i ++ ) {

			const handle = handles[ i ];

			// hide aligned to camera

			handle.visible = true;
			handle.rotation.set( 0, 0, 0 );
			handle.position.copy( this.worldPosition );

			let factor;

			if ( this.camera.isOrthographicCamera ) {

				factor = ( this.camera.top - this.camera.bottom ) / this.camera.zoom;

			} else {

				factor = this.worldPosition.distanceTo( this.cameraPosition ) * Math.min( 1.9 * Math.tan( Math.PI * this.camera.fov / 360 ) / this.camera.zoom, 7 );

			}

			handle.scale.set( 1, 1, 1 ).multiplyScalar( factor * this.size / 4 );

			// TODO: simplify helpers and consider decoupling from gizmo

			if ( handle.tag === 'helper' ) {

				handle.visible = false;

				if ( handle.name === 'AXIS' ) {

					handle.visible = !! this.axis;

					if ( this.axis === 'X' ) {

						_tempQuaternion.setFromEuler( _tempEuler.set( 0, 0, 0 ) );
						handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

						if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

							handle.visible = false;

						}

					}

					if ( this.axis === 'Y' ) {

						_tempQuaternion.setFromEuler( _tempEuler.set( 0, 0, Math.PI / 2 ) );
						handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

						if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

							handle.visible = false;

						}

					}

					if ( this.axis === 'Z' ) {

						_tempQuaternion.setFromEuler( _tempEuler.set( 0, Math.PI / 2, 0 ) );
						handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

						if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

							handle.visible = false;

						}

					}

					if ( this.axis === 'XYZE' ) {

						_tempQuaternion.setFromEuler( _tempEuler.set( 0, Math.PI / 2, 0 ) );
						_alignVector.copy( this.rotationAxis );
						handle.quaternion.setFromRotationMatrix( _lookAtMatrix.lookAt( _zeroVector, _alignVector, _unitY ) );
						handle.quaternion.multiply( _tempQuaternion );
						handle.visible = this.dragging;

					}

					if ( this.axis === 'E' ) {

						handle.visible = false;

					}


				} else if ( handle.name === 'START' ) {

					handle.position.copy( this.worldPositionStart );
					handle.visible = this.dragging;

				} else if ( handle.name === 'END' ) {

					handle.position.copy( this.worldPosition );
					handle.visible = this.dragging;

				} else if ( handle.name === 'DELTA' ) {

					handle.position.copy( this.worldPositionStart );
					handle.quaternion.copy( this.worldQuaternionStart );
					_tempVector.set( 1e-10, 1e-10, 1e-10 ).add( this.worldPositionStart ).sub( this.worldPosition ).multiplyScalar( - 1 );
					_tempVector.applyQuaternion( this.worldQuaternionStart.clone().invert() );
					handle.scale.copy( _tempVector );
					handle.visible = this.dragging;

				} else {

					handle.quaternion.copy( quaternion );

					if ( this.dragging ) {

						handle.position.copy( this.worldPositionStart );

					} else {

						handle.position.copy( this.worldPosition );

					}

					if ( this.axis ) {

						handle.visible = this.axis.search( handle.name ) !== - 1;

					}

				}

				// If updating helper, skip rest of the loop
				continue;

			}

			// Align handles to current local or world rotation

			handle.quaternion.copy( quaternion );

			if ( this.mode === 'translate' || this.mode === 'scale' ) {

				// Hide translate and scale axis facing the camera

				const AXIS_HIDE_THRESHOLD = 0.99;
				const PLANE_HIDE_THRESHOLD = 0.2;

				if ( handle.name === 'X' ) {

					if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_THRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'Y' ) {

					if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_THRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'Z' ) {

					if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_THRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'XY' ) {

					if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_THRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'YZ' ) {

					if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_THRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'XZ' ) {

					if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_THRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

			} else if ( this.mode === 'rotate' ) {

				// Align handles to current local or world rotation

				_tempQuaternion2.copy( quaternion );
				_alignVector.copy( this.eye ).applyQuaternion( _tempQuaternion.copy( quaternion ).invert() );

				if ( handle.name.search( 'E' ) !== - 1 ) {

					handle.quaternion.setFromRotationMatrix( _lookAtMatrix.lookAt( this.eye, _zeroVector, _unitY ) );

				}

				if ( handle.name === 'X' ) {

					_tempQuaternion.setFromAxisAngle( _unitX, Math.atan2( - _alignVector.y, _alignVector.z ) );
					_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );
					handle.quaternion.copy( _tempQuaternion );

				}

				if ( handle.name === 'Y' ) {

					_tempQuaternion.setFromAxisAngle( _unitY, Math.atan2( _alignVector.x, _alignVector.z ) );
					_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );
					handle.quaternion.copy( _tempQuaternion );

				}

				if ( handle.name === 'Z' ) {

					_tempQuaternion.setFromAxisAngle( _unitZ, Math.atan2( _alignVector.y, _alignVector.x ) );
					_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );
					handle.quaternion.copy( _tempQuaternion );

				}

			}

			// Hide disabled axes
			handle.visible = handle.visible && ( handle.name.indexOf( 'X' ) === - 1 || this.showX );
			handle.visible = handle.visible && ( handle.name.indexOf( 'Y' ) === - 1 || this.showY );
			handle.visible = handle.visible && ( handle.name.indexOf( 'Z' ) === - 1 || this.showZ );
			handle.visible = handle.visible && ( handle.name.indexOf( 'E' ) === - 1 || ( this.showX && this.showY && this.showZ ) );

			// highlight selected axis

			handle.material._color = handle.material._color || handle.material.color.clone();
			handle.material._opacity = handle.material._opacity || handle.material.opacity;

			handle.material.color.copy( handle.material._color );
			handle.material.opacity = handle.material._opacity;

			if ( this.enabled && this.axis ) {

				if ( handle.name === this.axis ) {

					handle.material.color.setHex( 0xffff00 );
					handle.material.opacity = 1.0;

				} else if ( this.axis.split( '' ).some( function ( a ) {

					return handle.name === a;

				} ) ) {

					handle.material.color.setHex( 0xffff00 );
					handle.material.opacity = 1.0;

				}

			}

		}

		super.updateMatrixWorld( force );

	}

}

//

class TransformControlsPlane extends Mesh {

	constructor() {

		super(
			new PlaneGeometry( 100000, 100000, 2, 2 ),
			new MeshBasicMaterial( { visible: false, wireframe: true, side: DoubleSide, transparent: true, opacity: 0.1, toneMapped: false } )
		);

		this.isTransformControlsPlane = true;

		this.type = 'TransformControlsPlane';

	}

	updateMatrixWorld( force ) {

		let space = this.space;

		this.position.copy( this.worldPosition );

		if ( this.mode === 'scale' ) space = 'local'; // scale always oriented to local rotation

		_v1.copy( _unitX ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );
		_v2.copy( _unitY ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );
		_v3.copy( _unitZ ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );

		// Align the plane for current transform mode, axis and space.

		_alignVector.copy( _v2 );

		switch ( this.mode ) {

			case 'translate':
			case 'scale':
				switch ( this.axis ) {

					case 'X':
						_alignVector.copy( this.eye ).cross( _v1 );
						_dirVector.copy( _v1 ).cross( _alignVector );
						break;
					case 'Y':
						_alignVector.copy( this.eye ).cross( _v2 );
						_dirVector.copy( _v2 ).cross( _alignVector );
						break;
					case 'Z':
						_alignVector.copy( this.eye ).cross( _v3 );
						_dirVector.copy( _v3 ).cross( _alignVector );
						break;
					case 'XY':
						_dirVector.copy( _v3 );
						break;
					case 'YZ':
						_dirVector.copy( _v1 );
						break;
					case 'XZ':
						_alignVector.copy( _v3 );
						_dirVector.copy( _v2 );
						break;
					case 'XYZ':
					case 'E':
						_dirVector.set( 0, 0, 0 );
						break;

				}

				break;
			case 'rotate':
			default:
				// special case for rotate
				_dirVector.set( 0, 0, 0 );

		}

		if ( _dirVector.length() === 0 ) {

			// If in rotate mode, make the plane parallel to camera
			this.quaternion.copy( this.cameraQuaternion );

		} else {

			_tempMatrix.lookAt( _tempVector.set( 0, 0, 0 ), _dirVector, _alignVector );

			this.quaternion.setFromRotationMatrix( _tempMatrix );

		}

		super.updateMatrixWorld( force );

	}

}

/**
 * Simple event handler by
 * [Jason Kleban](https://gist.github.com/JasonKleban/50cee44960c225ac1993c922563aa540).
 * Keep in mind that:
 * - If you want to remove it later, you might want to declare the callback as
 * an object.
 * - If you want to maintain the reference to `this`, you will need to declare
 * the callback as an arrow function.
 */
class Event {
    constructor() {
        /** Triggers all the callbacks assigned to this event. */
        this.trigger = async (data) => {
            const handlers = this.handlers.slice(0);
            for (const handler of handlers) {
                await handler(data);
            }
        };
        this.handlers = [];
    }
    /**
     * Add a callback to this event instance.
     * @param handler - the callback to be added to this event.
     */
    add(handler) {
        this.handlers.push(handler);
    }
    /**
     * Removes a callback from this event instance.
     * @param handler - the callback to be removed from this event.
     */
    remove(handler) {
        this.handlers = this.handlers.filter((h) => h !== handler);
    }
    /** Gets rid of all the suscribed events. */
    reset() {
        this.handlers.length = 0;
    }
}

class Control {
    get items() {
        return [this.helper, this.core];
    }
    constructor(camera, element) {
        this.transformed = new Event();
        this.controlsActivated = new Event();
        this.core = new TransformControls(camera, element);
        this.helper = new THREE.Object3D();
        let transform = new THREE.Matrix4();
        this.core.attach(this.helper);
        this.core.addEventListener("dragging-changed", () => {
            this.controlsActivated.trigger();
        });
        this.core.addEventListener("change", () => {
            this.helper.updateMatrix();
            const temp = this.helper.matrix.clone();
            temp.multiply(transform.invert());
            this.transformed.trigger(temp);
            transform = this.helper.matrix.clone();
        });
    }
}

class Primitive {
    constructor() {
        /**
         * All the selected items within this primitive.
         */
        this.selected = new Selector();
        this._baseColor = new THREE.Color(0.5, 0.5, 0.5);
        this._selectColor = new THREE.Color(1, 0, 0);
        this.list = {};
    }
    /**
     * The list of ids of the {@link list} of items.
     */
    get ids() {
        const ids = [];
        for (const id in this.list) {
            ids.push(this.list[id].id);
        }
        return ids;
    }
    /**
     * The color of all the points.
     */
    get baseColor() {
        return this._baseColor;
    }
    /**
     * The color of all the points.
     */
    set baseColor(color) {
        this._baseColor.copy(color);
    }
    /**
     * The color of all the selected points.
     */
    get selectColor() {
        return this._selectColor;
    }
    /**
     * The color of all the selected points.
     */
    set selectColor(color) {
        this._selectColor.copy(color);
    }
    get _positionBuffer() {
        return this.mesh.geometry.attributes.position;
    }
    get _colorBuffer() {
        return this.mesh.geometry.attributes.color;
    }
    get _normalBuffer() {
        return this.mesh.geometry.attributes.normal;
    }
    get _attributes() {
        return Object.values(this.mesh.geometry.attributes);
    }
}

class Vertices extends Primitive {
    /**
     * The color of all the points.
     */
    set baseColor(color) {
        super.baseColor = color;
        const allIDs = this.idMap.ids;
        const unselected = this.selected.getUnselected(allIDs);
        this.updateColor(unselected);
    }
    /**
     * The color of all the selected points.
     */
    set selectColor(color) {
        super.selectColor = color;
        this.updateColor(this.selected.data);
    }
    /**
     * Creates a new instance of vertices
     * @param size Visualization point size
     */
    constructor(size = 0.1) {
        super();
        /** The map between each vertex ID and its index. */
        this.idMap = new IdIndexMap();
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial({
            size,
            vertexColors: true,
        });
        this.mesh = new THREE.Points(geometry, material);
        this.mesh.frustumCulled = false;
        this._buffers = new BufferManager(geometry);
        this._buffers.createAttribute("position");
        this._buffers.createAttribute("color");
    }
    /**
     * Gets the coordinates of the vertex with the given ID.
     * @param id the id of the point to retrieve.
     */
    get(id) {
        const index = this.idMap.getIndex(id);
        if (index === null)
            return null;
        return [
            this._positionBuffer.getX(index),
            this._positionBuffer.getY(index),
            this._positionBuffer.getZ(index),
        ];
    }
    /**
     * Add new points
     * @param ids the vertices to edit.
     * @param coordinates the new coordinates for the vertex.
     */
    set(ids, coordinates) {
        const [x, y, z] = coordinates;
        for (const id of ids) {
            const index = this.idMap.getIndex(id);
            if (index === null)
                return;
            this._positionBuffer.setXYZ(index, x, y, z);
        }
        this._positionBuffer.needsUpdate = true;
    }
    /**
     * Add new points
     * @param coordinates Points to add.
     * @returns the list of ids of the created vertices.
     */
    add(coordinates) {
        this._buffers.resizeIfNeeded(coordinates.length);
        const ids = [];
        const { r, g, b } = this._baseColor;
        for (let i = 0; i < coordinates.length; i++) {
            const index = this.idMap.add();
            const id = this.idMap.getId(index);
            ids.push(id);
            const [x, y, z] = coordinates[i];
            this._positionBuffer.setXYZ(index, x, y, z);
            this._colorBuffer.setXYZ(index, r, g, b);
        }
        this._buffers.updateCount(this.idMap.size);
        this.mesh.geometry.computeBoundingSphere();
        this.mesh.geometry.computeBoundingBox();
        return ids;
    }
    /**
     * Select or unselects the given vertices.
     * @param active Whether to select or unselect.
     * @param ids List of vertices IDs to select or deselect. If not
     * defined, all vertices will be selected or deselected.
     */
    select(active, ids = this.idMap.ids) {
        const idsToUpdate = this.selected.select(active, ids, this.idMap.ids);
        this.updateColor(idsToUpdate);
    }
    /**
     * Applies a transformation to the selected vertices.
     * @param matrix Transformation matrix to apply.
     * @param ids IDs of the vertices to transform.
     */
    transform(matrix, ids = this.selected.data) {
        const vector = new THREE.Vector3();
        for (const id of ids) {
            const index = this.idMap.getIndex(id);
            if (index === null)
                continue;
            const x = this._positionBuffer.getX(index);
            const y = this._positionBuffer.getY(index);
            const z = this._positionBuffer.getZ(index);
            vector.set(x, y, z);
            vector.applyMatrix4(matrix);
            this._positionBuffer.setXYZ(index, vector.x, vector.y, vector.z);
        }
        this._positionBuffer.needsUpdate = true;
    }
    /**
     * Quickly removes all the points and releases all the memory used.
     */
    clear() {
        this._buffers.resetAttributes();
        this.selected.data.clear();
        this.idMap.reset();
    }
    /**
     * Removes the selected points from the list
     */
    remove(ids = this.selected.data) {
        for (const id of ids) {
            for (const attribute of this._attributes) {
                this.removeFromBuffer(id, attribute);
            }
            this.idMap.remove(id);
        }
        this.select(false, ids);
        this._buffers.updateCount(this.idMap.size);
    }
    addAttribute(attribute) {
        this._buffers.addAttribute(attribute);
    }
    removeFromBuffer(id, buffer) {
        const lastIndex = this.idMap.getLastIndex();
        const index = this.idMap.getIndex(id);
        if (index !== null) {
            buffer.setXYZ(index, buffer.getX(lastIndex), buffer.getY(lastIndex), buffer.getZ(lastIndex));
        }
    }
    updateColor(ids = this.idMap.ids) {
        const colorBuffer = this._colorBuffer;
        for (const id of ids) {
            const isSelected = this.selected.data.has(id);
            const index = this.idMap.getIndex(id);
            if (index === null)
                continue;
            const color = isSelected ? this._selectColor : this._baseColor;
            colorBuffer.setXYZ(index, color.r, color.g, color.b);
        }
        colorBuffer.needsUpdate = true;
    }
}

class Lines extends Primitive {
    /**
     * The color of all the points.
     */
    set baseColor(color) {
        super.baseColor = color;
        const allIDs = this.idMap.ids;
        const unselected = this.selected.getUnselected(allIDs);
        this.updateColor(unselected);
        this.vertices.baseColor = color;
    }
    /**
     * The color of all the selected points.
     */
    set selectColor(color) {
        super.selectColor = color;
        this.updateColor(this.selected.data);
        this.vertices.selectColor = color;
    }
    constructor() {
        super();
        /** {@link Primitive.mesh } */
        this.mesh = new THREE.LineSegments();
        /**
         * The list of segments.
         */
        this.list = {};
        /**
         * The geometric representation of the vertices that define this instance of lines.
         */
        this.vertices = new Vertices();
        /**
         * The map that keeps track of the segments ID and their position in the geometric buffer.
         */
        this.idMap = new IdIndexMap();
        /**
         * The list of points that define each line.
         */
        this.points = {};
        const material = new THREE.LineBasicMaterial({ vertexColors: true });
        const geometry = new THREE.BufferGeometry();
        this.mesh = new THREE.LineSegments(geometry, material);
        this._buffers = new BufferManager(geometry);
        this.setupAttributes();
    }
    /**
     * Quickly removes all the lines and releases all the memory used.
     */
    clear() {
        this.selected.data.clear();
        this.mesh.geometry.dispose();
        this.mesh.geometry = new THREE.BufferGeometry();
        this.setupAttributes();
        this.vertices.clear();
        this.idMap.reset();
        this.list = {};
        this.points = {};
    }
    /**
     * Adds a segment between two {@link points}.
     * @param ids - the IDs of the {@link points} that define the segments.
     */
    add(ids) {
        const createdIDs = [];
        const newVerticesCount = (ids.length - 1) * 2;
        this._buffers.resizeIfNeeded(newVerticesCount);
        const { r, g, b } = this._baseColor;
        for (let i = 0; i < ids.length - 1; i++) {
            const startID = ids[i];
            const endID = ids[i + 1];
            const start = this.vertices.get(startID);
            const end = this.vertices.get(endID);
            if (start === null || end === null)
                continue;
            const index = this.idMap.add();
            const id = this.idMap.getId(index);
            createdIDs.push(id);
            const startPoint = this.points[startID];
            const endPoint = this.points[endID];
            startPoint.start.add(id);
            endPoint.end.add(id);
            this._positionBuffer.setXYZ(index * 2, start[0], start[1], start[2]);
            this._positionBuffer.setXYZ(index * 2 + 1, end[0], end[1], end[2]);
            this._colorBuffer.setXYZ(index * 2, r, g, b);
            this._colorBuffer.setXYZ(index * 2 + 1, r, g, b);
            this.list[id] = { id, start: startID, end: endID };
        }
        const allVerticesCount = this.idMap.size * 2;
        this._buffers.updateCount(allVerticesCount);
        this.mesh.geometry.computeBoundingSphere();
        this.mesh.geometry.computeBoundingBox();
        return createdIDs;
    }
    get(id) {
        const line = this.list[id];
        const start = this.vertices.get(line.start);
        const end = this.vertices.get(line.end);
        if (!start || !end)
            return null;
        return [start, end];
    }
    /**
     * Adds the points that can be used by one or many lines.
     * @param points the list of (x, y, z) coordinates of the points.
     */
    addPoints(points) {
        const ids = this.vertices.add(points);
        for (const id of ids) {
            this.points[id] = { start: new Set(), end: new Set() };
        }
        return ids;
    }
    /**
     * Select or unselects the given lines.
     * @param active Whether to select or unselect.
     * @param ids List of lines IDs to select or unselect. If not
     * defined, all lines will be selected or deselected.
     */
    select(active, ids = this.ids) {
        const allLines = this.idMap.ids;
        const lineIDs = ids || allLines;
        const idsToUpdate = this.selected.select(active, lineIDs, allLines);
        this.updateColor(idsToUpdate);
        const points = [];
        for (const id of idsToUpdate) {
            const line = this.list[id];
            points.push(line.start);
            points.push(line.end);
        }
        this.selectPoints(active, points);
    }
    selectPoints(active, ids) {
        this.vertices.select(active, ids);
    }
    /**
     * Removes the specified lines.
     * @param ids List of lines to remove. If no line is specified,
     * removes all the selected lines.
     */
    remove(ids = this.selected.data) {
        const position = this._positionBuffer;
        const color = this._colorBuffer;
        const points = [];
        for (const id of ids) {
            const line = this.list[id];
            if (line === undefined)
                continue;
            this.removeFromBuffer(id, position);
            this.removeFromBuffer(id, color);
            this.idMap.remove(id);
            const startPoint = this.points[line.start];
            points.push(line.start, line.end);
            startPoint.start.delete(id);
            const endPoint = this.points[line.end];
            endPoint.end.delete(id);
            delete this.list[id];
            this.selected.data.delete(id);
        }
        position.needsUpdate = true;
        color.needsUpdate = true;
        this.selectPoints(false, points);
    }
    /**
     * Removes the specified points and all lines that use them.
     * @param ids List of points to remove. If no point is specified,
     * removes all the selected points.
     */
    removePoints(ids = this.vertices.selected.data) {
        const lines = new Set();
        for (const id of ids) {
            const point = this.points[id];
            if (!point)
                continue;
            for (const id of point.start) {
                lines.add(id);
            }
            for (const id of point.end) {
                lines.add(id);
            }
        }
        this.vertices.remove(ids);
        this.remove(lines);
    }
    /**
     * Sets a point of the line to a specific position.
     * @param id The point whose position to set.
     * @param coordinates The new coordinates of the point.
     */
    setPoint(id, coordinates) {
        const indices = new Set();
        this.getPointIndices(id, indices);
        this.setLines(coordinates, indices);
        this.vertices.set([id], coordinates);
    }
    transform(matrix) {
        const indices = new Set();
        const points = new Set();
        for (const id of this.vertices.selected.data) {
            points.add(id);
            this.getPointIndices(id, indices);
        }
        this.transformLines(matrix, indices);
        this.vertices.transform(matrix, points);
    }
    getPointIndices(id, indices) {
        const point = this.points[id];
        for (const id of point.start) {
            const index = this.idMap.getIndex(id);
            if (index === null) {
                continue;
            }
            indices.add(index * 2);
        }
        for (const id of point.end) {
            const index = this.idMap.getIndex(id);
            if (index === null) {
                continue;
            }
            indices.add(index * 2 + 1);
        }
    }
    setupAttributes() {
        this._buffers.createAttribute("position");
        this._buffers.createAttribute("color");
    }
    removeFromBuffer(id, buffer) {
        const index = this.idMap.getIndex(id);
        if (index === null)
            return;
        const lastIndex = this.idMap.getLastIndex();
        const indices = [index * 2, index * 2 + 1];
        const lastIndices = [lastIndex * 2, lastIndex * 2 + 1];
        for (let i = 0; i < 2; i++) {
            const x = buffer.getX(lastIndices[i]);
            const y = buffer.getY(lastIndices[i]);
            const z = buffer.getZ(lastIndices[i]);
            buffer.setXYZ(indices[i], x, y, z);
        }
        buffer.count -= 2;
    }
    transformLines(matrix, indices) {
        const vector = new THREE.Vector3();
        for (const index of indices) {
            const x = this._positionBuffer.getX(index);
            const y = this._positionBuffer.getY(index);
            const z = this._positionBuffer.getZ(index);
            vector.set(x, y, z);
            vector.applyMatrix4(matrix);
            this._positionBuffer.setXYZ(index, vector.x, vector.y, vector.z);
        }
        this._positionBuffer.needsUpdate = true;
    }
    setLines(coords, indices) {
        const [x, y, z] = coords;
        for (const index of indices) {
            this._positionBuffer.setXYZ(index, x, y, z);
        }
        this._positionBuffer.needsUpdate = true;
    }
    updateColor(ids = this.ids) {
        const colorAttribute = this._colorBuffer;
        for (const id of ids) {
            const line = this.list[id];
            const isSelected = this.selected.data.has(line.id);
            const { r, g, b } = isSelected ? this._selectColor : this._baseColor;
            const index = this.idMap.getIndex(id);
            if (index === null)
                continue;
            colorAttribute.setXYZ(index * 2, r, g, b);
            colorAttribute.setXYZ(index * 2 + 1, r, g, b);
        }
        colorAttribute.needsUpdate = true;
    }
}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var earcut$2 = {exports: {}};

earcut$2.exports = earcut;
earcut$2.exports.default = earcut;

function earcut(data, holeIndices, dim) {

    dim = dim || 2;

    var hasHoles = holeIndices && holeIndices.length,
        outerLen = hasHoles ? holeIndices[0] * dim : data.length,
        outerNode = linkedList(data, 0, outerLen, dim, true),
        triangles = [];

    if (!outerNode || outerNode.next === outerNode.prev) return triangles;

    var minX, minY, maxX, maxY, x, y, invSize;

    if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);

    // if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
    if (data.length > 80 * dim) {
        minX = maxX = data[0];
        minY = maxY = data[1];

        for (var i = dim; i < outerLen; i += dim) {
            x = data[i];
            y = data[i + 1];
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }

        // minX, minY and invSize are later used to transform coords into integers for z-order calculation
        invSize = Math.max(maxX - minX, maxY - minY);
        invSize = invSize !== 0 ? 32767 / invSize : 0;
    }

    earcutLinked(outerNode, triangles, dim, minX, minY, invSize, 0);

    return triangles;
}

// create a circular doubly linked list from polygon points in the specified winding order
function linkedList(data, start, end, dim, clockwise) {
    var i, last;

    if (clockwise === (signedArea(data, start, end, dim) > 0)) {
        for (i = start; i < end; i += dim) last = insertNode(i, data[i], data[i + 1], last);
    } else {
        for (i = end - dim; i >= start; i -= dim) last = insertNode(i, data[i], data[i + 1], last);
    }

    if (last && equals(last, last.next)) {
        removeNode(last);
        last = last.next;
    }

    return last;
}

// eliminate colinear or duplicate points
function filterPoints(start, end) {
    if (!start) return start;
    if (!end) end = start;

    var p = start,
        again;
    do {
        again = false;

        if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
            removeNode(p);
            p = end = p.prev;
            if (p === p.next) break;
            again = true;

        } else {
            p = p.next;
        }
    } while (again || p !== end);

    return end;
}

// main ear slicing loop which triangulates a polygon (given as a linked list)
function earcutLinked(ear, triangles, dim, minX, minY, invSize, pass) {
    if (!ear) return;

    // interlink polygon nodes in z-order
    if (!pass && invSize) indexCurve(ear, minX, minY, invSize);

    var stop = ear,
        prev, next;

    // iterate through ears, slicing them one by one
    while (ear.prev !== ear.next) {
        prev = ear.prev;
        next = ear.next;

        if (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear)) {
            // cut off the triangle
            triangles.push(prev.i / dim | 0);
            triangles.push(ear.i / dim | 0);
            triangles.push(next.i / dim | 0);

            removeNode(ear);

            // skipping the next vertex leads to less sliver triangles
            ear = next.next;
            stop = next.next;

            continue;
        }

        ear = next;

        // if we looped through the whole remaining polygon and can't find any more ears
        if (ear === stop) {
            // try filtering points and slicing again
            if (!pass) {
                earcutLinked(filterPoints(ear), triangles, dim, minX, minY, invSize, 1);

            // if this didn't work, try curing all small self-intersections locally
            } else if (pass === 1) {
                ear = cureLocalIntersections(filterPoints(ear), triangles, dim);
                earcutLinked(ear, triangles, dim, minX, minY, invSize, 2);

            // as a last resort, try splitting the remaining polygon into two
            } else if (pass === 2) {
                splitEarcut(ear, triangles, dim, minX, minY, invSize);
            }

            break;
        }
    }
}

// check whether a polygon node forms a valid ear with adjacent nodes
function isEar(ear) {
    var a = ear.prev,
        b = ear,
        c = ear.next;

    if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

    // now make sure we don't have other points inside the potential ear
    var ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;

    // triangle bbox; min & max are calculated like this for speed
    var x0 = ax < bx ? (ax < cx ? ax : cx) : (bx < cx ? bx : cx),
        y0 = ay < by ? (ay < cy ? ay : cy) : (by < cy ? by : cy),
        x1 = ax > bx ? (ax > cx ? ax : cx) : (bx > cx ? bx : cx),
        y1 = ay > by ? (ay > cy ? ay : cy) : (by > cy ? by : cy);

    var p = c.next;
    while (p !== a) {
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 &&
            pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) &&
            area(p.prev, p, p.next) >= 0) return false;
        p = p.next;
    }

    return true;
}

function isEarHashed(ear, minX, minY, invSize) {
    var a = ear.prev,
        b = ear,
        c = ear.next;

    if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

    var ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;

    // triangle bbox; min & max are calculated like this for speed
    var x0 = ax < bx ? (ax < cx ? ax : cx) : (bx < cx ? bx : cx),
        y0 = ay < by ? (ay < cy ? ay : cy) : (by < cy ? by : cy),
        x1 = ax > bx ? (ax > cx ? ax : cx) : (bx > cx ? bx : cx),
        y1 = ay > by ? (ay > cy ? ay : cy) : (by > cy ? by : cy);

    // z-order range for the current triangle bbox;
    var minZ = zOrder(x0, y0, minX, minY, invSize),
        maxZ = zOrder(x1, y1, minX, minY, invSize);

    var p = ear.prevZ,
        n = ear.nextZ;

    // look for points inside the triangle in both directions
    while (p && p.z >= minZ && n && n.z <= maxZ) {
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c &&
            pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
        p = p.prevZ;

        if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c &&
            pointInTriangle(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0) return false;
        n = n.nextZ;
    }

    // look for remaining points in decreasing z-order
    while (p && p.z >= minZ) {
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c &&
            pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
        p = p.prevZ;
    }

    // look for remaining points in increasing z-order
    while (n && n.z <= maxZ) {
        if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c &&
            pointInTriangle(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0) return false;
        n = n.nextZ;
    }

    return true;
}

// go through all polygon nodes and cure small local self-intersections
function cureLocalIntersections(start, triangles, dim) {
    var p = start;
    do {
        var a = p.prev,
            b = p.next.next;

        if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {

            triangles.push(a.i / dim | 0);
            triangles.push(p.i / dim | 0);
            triangles.push(b.i / dim | 0);

            // remove two nodes involved
            removeNode(p);
            removeNode(p.next);

            p = start = b;
        }
        p = p.next;
    } while (p !== start);

    return filterPoints(p);
}

// try splitting polygon into two and triangulate them independently
function splitEarcut(start, triangles, dim, minX, minY, invSize) {
    // look for a valid diagonal that divides the polygon into two
    var a = start;
    do {
        var b = a.next.next;
        while (b !== a.prev) {
            if (a.i !== b.i && isValidDiagonal(a, b)) {
                // split the polygon in two by the diagonal
                var c = splitPolygon(a, b);

                // filter colinear points around the cuts
                a = filterPoints(a, a.next);
                c = filterPoints(c, c.next);

                // run earcut on each half
                earcutLinked(a, triangles, dim, minX, minY, invSize, 0);
                earcutLinked(c, triangles, dim, minX, minY, invSize, 0);
                return;
            }
            b = b.next;
        }
        a = a.next;
    } while (a !== start);
}

// link every hole into the outer loop, producing a single-ring polygon without holes
function eliminateHoles(data, holeIndices, outerNode, dim) {
    var queue = [],
        i, len, start, end, list;

    for (i = 0, len = holeIndices.length; i < len; i++) {
        start = holeIndices[i] * dim;
        end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
        list = linkedList(data, start, end, dim, false);
        if (list === list.next) list.steiner = true;
        queue.push(getLeftmost(list));
    }

    queue.sort(compareX);

    // process holes from left to right
    for (i = 0; i < queue.length; i++) {
        outerNode = eliminateHole(queue[i], outerNode);
    }

    return outerNode;
}

function compareX(a, b) {
    return a.x - b.x;
}

// find a bridge between vertices that connects hole with an outer ring and and link it
function eliminateHole(hole, outerNode) {
    var bridge = findHoleBridge(hole, outerNode);
    if (!bridge) {
        return outerNode;
    }

    var bridgeReverse = splitPolygon(bridge, hole);

    // filter collinear points around the cuts
    filterPoints(bridgeReverse, bridgeReverse.next);
    return filterPoints(bridge, bridge.next);
}

// David Eberly's algorithm for finding a bridge between hole and outer polygon
function findHoleBridge(hole, outerNode) {
    var p = outerNode,
        hx = hole.x,
        hy = hole.y,
        qx = -Infinity,
        m;

    // find a segment intersected by a ray from the hole's leftmost point to the left;
    // segment's endpoint with lesser x will be potential connection point
    do {
        if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
            var x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
            if (x <= hx && x > qx) {
                qx = x;
                m = p.x < p.next.x ? p : p.next;
                if (x === hx) return m; // hole touches outer segment; pick leftmost endpoint
            }
        }
        p = p.next;
    } while (p !== outerNode);

    if (!m) return null;

    // look for points inside the triangle of hole point, segment intersection and endpoint;
    // if there are no points found, we have a valid connection;
    // otherwise choose the point of the minimum angle with the ray as connection point

    var stop = m,
        mx = m.x,
        my = m.y,
        tanMin = Infinity,
        tan;

    p = m;

    do {
        if (hx >= p.x && p.x >= mx && hx !== p.x &&
                pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {

            tan = Math.abs(hy - p.y) / (hx - p.x); // tangential

            if (locallyInside(p, hole) &&
                (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) {
                m = p;
                tanMin = tan;
            }
        }

        p = p.next;
    } while (p !== stop);

    return m;
}

// whether sector in vertex m contains sector in vertex p in the same coordinates
function sectorContainsSector(m, p) {
    return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0;
}

// interlink polygon nodes in z-order
function indexCurve(start, minX, minY, invSize) {
    var p = start;
    do {
        if (p.z === 0) p.z = zOrder(p.x, p.y, minX, minY, invSize);
        p.prevZ = p.prev;
        p.nextZ = p.next;
        p = p.next;
    } while (p !== start);

    p.prevZ.nextZ = null;
    p.prevZ = null;

    sortLinked(p);
}

// Simon Tatham's linked list merge sort algorithm
// http://www.chiark.greenend.org.uk/~sgtatham/algorithms/listsort.html
function sortLinked(list) {
    var i, p, q, e, tail, numMerges, pSize, qSize,
        inSize = 1;

    do {
        p = list;
        list = null;
        tail = null;
        numMerges = 0;

        while (p) {
            numMerges++;
            q = p;
            pSize = 0;
            for (i = 0; i < inSize; i++) {
                pSize++;
                q = q.nextZ;
                if (!q) break;
            }
            qSize = inSize;

            while (pSize > 0 || (qSize > 0 && q)) {

                if (pSize !== 0 && (qSize === 0 || !q || p.z <= q.z)) {
                    e = p;
                    p = p.nextZ;
                    pSize--;
                } else {
                    e = q;
                    q = q.nextZ;
                    qSize--;
                }

                if (tail) tail.nextZ = e;
                else list = e;

                e.prevZ = tail;
                tail = e;
            }

            p = q;
        }

        tail.nextZ = null;
        inSize *= 2;

    } while (numMerges > 1);

    return list;
}

// z-order of a point given coords and inverse of the longer side of data bbox
function zOrder(x, y, minX, minY, invSize) {
    // coords are transformed into non-negative 15-bit integer range
    x = (x - minX) * invSize | 0;
    y = (y - minY) * invSize | 0;

    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;

    y = (y | (y << 8)) & 0x00FF00FF;
    y = (y | (y << 4)) & 0x0F0F0F0F;
    y = (y | (y << 2)) & 0x33333333;
    y = (y | (y << 1)) & 0x55555555;

    return x | (y << 1);
}

// find the leftmost node of a polygon ring
function getLeftmost(start) {
    var p = start,
        leftmost = start;
    do {
        if (p.x < leftmost.x || (p.x === leftmost.x && p.y < leftmost.y)) leftmost = p;
        p = p.next;
    } while (p !== start);

    return leftmost;
}

// check if a point lies within a convex triangle
function pointInTriangle(ax, ay, bx, by, cx, cy, px, py) {
    return (cx - px) * (ay - py) >= (ax - px) * (cy - py) &&
           (ax - px) * (by - py) >= (bx - px) * (ay - py) &&
           (bx - px) * (cy - py) >= (cx - px) * (by - py);
}

// check if a diagonal between two polygon nodes is valid (lies in polygon interior)
function isValidDiagonal(a, b) {
    return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) && // dones't intersect other edges
           (locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) && // locally visible
            (area(a.prev, a, b.prev) || area(a, b.prev, b)) || // does not create opposite-facing sectors
            equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0); // special zero-length case
}

// signed area of a triangle
function area(p, q, r) {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

// check if two points are equal
function equals(p1, p2) {
    return p1.x === p2.x && p1.y === p2.y;
}

// check if two segments intersect
function intersects(p1, q1, p2, q2) {
    var o1 = sign(area(p1, q1, p2));
    var o2 = sign(area(p1, q1, q2));
    var o3 = sign(area(p2, q2, p1));
    var o4 = sign(area(p2, q2, q1));

    if (o1 !== o2 && o3 !== o4) return true; // general case

    if (o1 === 0 && onSegment(p1, p2, q1)) return true; // p1, q1 and p2 are collinear and p2 lies on p1q1
    if (o2 === 0 && onSegment(p1, q2, q1)) return true; // p1, q1 and q2 are collinear and q2 lies on p1q1
    if (o3 === 0 && onSegment(p2, p1, q2)) return true; // p2, q2 and p1 are collinear and p1 lies on p2q2
    if (o4 === 0 && onSegment(p2, q1, q2)) return true; // p2, q2 and q1 are collinear and q1 lies on p2q2

    return false;
}

// for collinear points p, q, r, check if point q lies on segment pr
function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

function sign(num) {
    return num > 0 ? 1 : num < 0 ? -1 : 0;
}

// check if a polygon diagonal intersects any polygon segments
function intersectsPolygon(a, b) {
    var p = a;
    do {
        if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i &&
                intersects(p, p.next, a, b)) return true;
        p = p.next;
    } while (p !== a);

    return false;
}

// check if a polygon diagonal is locally inside the polygon
function locallyInside(a, b) {
    return area(a.prev, a, a.next) < 0 ?
        area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 :
        area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
}

// check if the middle point of a polygon diagonal is inside the polygon
function middleInside(a, b) {
    var p = a,
        inside = false,
        px = (a.x + b.x) / 2,
        py = (a.y + b.y) / 2;
    do {
        if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y &&
                (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x))
            inside = !inside;
        p = p.next;
    } while (p !== a);

    return inside;
}

// link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
// if one belongs to the outer ring and another to a hole, it merges it into a single ring
function splitPolygon(a, b) {
    var a2 = new Node(a.i, a.x, a.y),
        b2 = new Node(b.i, b.x, b.y),
        an = a.next,
        bp = b.prev;

    a.next = b;
    b.prev = a;

    a2.next = an;
    an.prev = a2;

    b2.next = a2;
    a2.prev = b2;

    bp.next = b2;
    b2.prev = bp;

    return b2;
}

// create a node and optionally link it with previous one (in a circular doubly linked list)
function insertNode(i, x, y, last) {
    var p = new Node(i, x, y);

    if (!last) {
        p.prev = p;
        p.next = p;

    } else {
        p.next = last.next;
        p.prev = last;
        last.next.prev = p;
        last.next = p;
    }
    return p;
}

function removeNode(p) {
    p.next.prev = p.prev;
    p.prev.next = p.next;

    if (p.prevZ) p.prevZ.nextZ = p.nextZ;
    if (p.nextZ) p.nextZ.prevZ = p.prevZ;
}

function Node(i, x, y) {
    // vertex index in coordinates array
    this.i = i;

    // vertex coordinates
    this.x = x;
    this.y = y;

    // previous and next vertex nodes in a polygon ring
    this.prev = null;
    this.next = null;

    // z-order curve value
    this.z = 0;

    // previous and next nodes in z-order
    this.prevZ = null;
    this.nextZ = null;

    // indicates whether this is a steiner point
    this.steiner = false;
}

// return a percentage difference between the polygon area and its triangulation area;
// used to verify correctness of triangulation
earcut.deviation = function (data, holeIndices, dim, triangles) {
    var hasHoles = holeIndices && holeIndices.length;
    var outerLen = hasHoles ? holeIndices[0] * dim : data.length;

    var polygonArea = Math.abs(signedArea(data, 0, outerLen, dim));
    if (hasHoles) {
        for (var i = 0, len = holeIndices.length; i < len; i++) {
            var start = holeIndices[i] * dim;
            var end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
            polygonArea -= Math.abs(signedArea(data, start, end, dim));
        }
    }

    var trianglesArea = 0;
    for (i = 0; i < triangles.length; i += 3) {
        var a = triangles[i] * dim;
        var b = triangles[i + 1] * dim;
        var c = triangles[i + 2] * dim;
        trianglesArea += Math.abs(
            (data[a] - data[c]) * (data[b + 1] - data[a + 1]) -
            (data[a] - data[b]) * (data[c + 1] - data[a + 1]));
    }

    return polygonArea === 0 && trianglesArea === 0 ? 0 :
        Math.abs((trianglesArea - polygonArea) / polygonArea);
};

function signedArea(data, start, end, dim) {
    var sum = 0;
    for (var i = start, j = end - dim; i < end; i += dim) {
        sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
        j = i;
    }
    return sum;
}

// turn a polygon in a multi-dimensional array form (e.g. as in GeoJSON) into a form Earcut accepts
earcut.flatten = function (data) {
    var dim = data[0][0].length,
        result = {vertices: [], holes: [], dimensions: dim},
        holeIndex = 0;

    for (var i = 0; i < data.length; i++) {
        for (var j = 0; j < data[i].length; j++) {
            for (var d = 0; d < dim; d++) result.vertices.push(data[i][j][d]);
        }
        if (i > 0) {
            holeIndex += data[i - 1].length;
            result.holes.push(holeIndex);
        }
    }
    return result;
};

var earcutExports = earcut$2.exports;
var earcut$1 = /*@__PURE__*/getDefaultExportFromCjs(earcutExports);

class Faces extends Primitive {
    /**
     * The color of all the points.
     */
    set baseColor(color) {
        super.baseColor = color;
        const unselected = this.selected.getUnselected(this.ids);
        this.updateColor(unselected);
        this.vertices.baseColor = color;
    }
    /**
     * The color of all the selected points.
     */
    set selectColor(color) {
        super.selectColor = color;
        this.updateColor(this.selected.data);
        this.vertices.selectColor = color;
    }
    get _index() {
        if (!this.mesh.geometry.index) {
            throw new Error("Geometery must be indexed!");
        }
        return this.mesh.geometry.index;
    }
    constructor() {
        super();
        /** {@link Primitive.mesh } */
        this.mesh = new THREE.Mesh();
        /**
         * The list of points that define the faces. Each point corresponds to a set of {@link Vertices}. This way,
         * we can provide an API of faces that share vertices, but under the hood the vertices are duplicated per face
         * (and thus being able to contain the normals as a vertex attribute).
         */
        this.points = {};
        /**
         * The list of faces. Each face is defined by a list of outer points.
         */
        this.list = {};
        /**
         * The geometric representation of the vertices that define this instance of faces.
         */
        this.vertices = new Vertices();
        /**
         * The list of selected {@link points}.
         */
        this.selectedPoints = new Selector();
        this._vertexFaceMap = new Map();
        this._faceIdGenerator = 0;
        this._pointIdGenerator = 0;
        this._holeIdGenerator = 0;
        const material = new THREE.MeshLambertMaterial({
            side: THREE.DoubleSide,
            vertexColors: true,
        });
        const geometry = new THREE.BufferGeometry();
        this.mesh = new THREE.Mesh(geometry, material);
        geometry.setIndex([]);
        const normals = new THREE.BufferAttribute(new Float32Array(0), 3);
        normals.name = "normal";
        this.vertices.addAttribute(normals);
        this.updateBuffers();
    }
    /**
     * Quickly removes all the faces and releases all the memory used.
     */
    clear() {
        this.selected.data.clear();
        this.selectedPoints.data.clear();
        this.mesh.geometry.setIndex([]);
        this.vertices.clear();
        this.updateBuffers();
        this.list = {};
        this.points = {};
        this._faceIdGenerator = 0;
        this._pointIdGenerator = 0;
        this._holeIdGenerator = 0;
    }
    /**
     * Adds a face.
     * @param ids - the IDs of the {@link points} that define that face. It's assumed that they are coplanar.
     * @param holesPointsIDs - the IDs of the {@link points} that define the holes.
     */
    add(ids, holesPointsIDs = []) {
        const id = this._faceIdGenerator++;
        // Add face references to points
        for (const pointID of ids) {
            const point = this.points[pointID];
            point.faces.add(id);
        }
        const holes = {};
        for (const pointIDs of holesPointsIDs) {
            const id = this._holeIdGenerator++;
            const points = new Set(pointIDs);
            holes[id] = { id, points };
            for (const pointID of pointIDs) {
                const point = this.points[pointID];
                point.faces.add(id);
            }
        }
        const face = {
            id,
            holes,
            vertices: new Set(),
            points: new Set(ids),
        };
        // Create face vertices
        const coordinates = [];
        for (const pointID of face.points) {
            this.saveCoordinates(pointID, coordinates, face);
        }
        let holesCounter = coordinates.length / 3;
        const holeIndices = [];
        for (const holeID in face.holes) {
            holeIndices.push(holesCounter);
            const hole = face.holes[holeID];
            holesCounter += hole.points.size;
            for (const pointID of hole.points) {
                this.saveCoordinates(pointID, coordinates, face);
            }
        }
        // Generate face indices
        const allIndices = Array.from(this._index.array);
        const faceIndices = this.triangulate(coordinates, holeIndices);
        let offset = 0;
        for (const index of allIndices) {
            if (index >= offset)
                offset = index + 1;
        }
        for (const faceIndex of faceIndices) {
            const absoluteIndex = faceIndex + offset;
            allIndices.push(absoluteIndex);
        }
        this.mesh.geometry.setIndex(allIndices);
        this.list[id] = face;
        this.updateBuffers();
        this.updateColor([id]);
        // this.computeNormal([id]);
        this.mesh.geometry.computeVertexNormals();
        this.mesh.geometry.computeBoundingSphere();
        this.mesh.geometry.computeBoundingBox();
        return id;
    }
    /**
     * Removes faces.
     * @param ids List of faces to remove. If no face is specified,
     * removes all the selected faces.
     */
    remove(ids = this.selected.data) {
        const verticesToRemove = new Set();
        for (const id of ids) {
            const face = this.list[id];
            if (face === undefined)
                continue;
            for (const vertex of face.vertices) {
                verticesToRemove.add(vertex);
                this._vertexFaceMap.delete(vertex);
            }
            for (const pointID of face.points) {
                const point = this.points[pointID];
                if (point) {
                    point.faces.delete(id);
                }
            }
            delete this.list[id];
        }
        for (const id of ids) {
            this.selected.data.delete(id);
        }
        const idsArray = [];
        const oldIndex = this._index.array;
        for (const index of oldIndex) {
            const id = this.vertices.idMap.getId(index);
            idsArray.push(id);
        }
        this.vertices.remove(verticesToRemove);
        const newIndex = [];
        for (const id of idsArray) {
            const index = this.vertices.idMap.getIndex(id);
            if (index !== null) {
                newIndex.push(index);
            }
        }
        this.mesh.geometry.setIndex(newIndex);
        this.updateBuffers();
        this.updateColor();
    }
    /**
     * Adds the points that can be used by one or many faces
     */
    addPoints(points) {
        const newPoints = [];
        for (const [x, y, z] of points) {
            const id = this._pointIdGenerator++;
            this.points[id] = {
                id,
                coordinates: [x, y, z],
                vertices: new Set(),
                faces: new Set(),
            };
            newPoints.push(id);
        }
        return newPoints;
    }
    removePoints(ids = this.selectedPoints.data) {
        const facesToRemove = new Set();
        for (const id of ids) {
            const point = this.points[id];
            if (!point)
                continue;
            for (const face of point.faces) {
                facesToRemove.add(face);
            }
            delete this.points[id];
        }
        for (const id of ids) {
            this.selectedPoints.data.delete(id);
        }
        this.remove(facesToRemove);
    }
    /**
     * Select or unselects the given faces.
     * @param active Whether to select or unselect.
     * @param ids List of faces IDs to select or unselect. If not
     * defined, all faces will be selected or deselected.
     */
    select(active, ids = this.ids) {
        const idsToUpdate = this.selected.select(active, ids, this.ids);
        this.updateColor(idsToUpdate);
        const points = [];
        for (const id of ids) {
            const face = this.list[id];
            if (face) {
                points.push(...face.points);
                for (const holeID in face.holes) {
                    const hole = face.holes[holeID];
                    points.push(...hole.points);
                }
            }
        }
        this.selectPoints(active, points);
    }
    /**
     * Selects or unselects the given points.
     * @param active When true we will select, when false we will unselect
     * @param ids List of point IDs to add to the selected set. If not
     * defined, all points will be selected or deselected.
     */
    selectPoints(active, ids) {
        const allPoints = Object.values(this.points).map((p) => p.id);
        const pointsIDs = ids || allPoints;
        this.selectedPoints.select(active, pointsIDs, allPoints);
        const vertices = [];
        for (const id of pointsIDs) {
            const point = this.points[id];
            if (point === undefined)
                continue;
            for (const id of point.vertices) {
                vertices.push(id);
            }
        }
        this.vertices.select(active, vertices);
    }
    /**
     * Sets a point of the face to a specific position.
     * @param id The point whose position to set.
     * @param coordinates The new coordinates of the point.
     */
    setPoint(id, coordinates) {
        const point = this.points[id];
        if (point === undefined)
            return;
        point.coordinates = coordinates;
        this.vertices.set(point.vertices, coordinates);
    }
    /**
     * Applies a transformation to the selected vertices.
     * @param matrix Transformation matrix to apply.
     */
    transform(matrix) {
        const vertices = new Set();
        for (const id of this.selectedPoints.data) {
            const point = this.points[id];
            for (const vertex of point.vertices) {
                vertices.add(vertex);
            }
        }
        this.vertices.transform(matrix, vertices);
        for (const pointID of this.selectedPoints.data) {
            const point = this.points[pointID];
            const vertexID = point.vertices.values().next().value;
            const coords = this.vertices.get(vertexID);
            if (coords === null)
                continue;
            point.coordinates = coords;
        }
    }
    /**
     * Given a face index, returns the face ID.
     * @param faceIndex The index of the face whose ID to get.
     */
    getFromIndex(faceIndex) {
        const vertexIndex = this._index.array[faceIndex * 3];
        const vertexID = this.vertices.idMap.getId(vertexIndex);
        return this._vertexFaceMap.get(vertexID);
    }
    /**
     * Gets the center point of a face.
     * @param id The face whose center to get.
     */
    getCenter(id) {
        const face = this.list[id];
        if (!face)
            return null;
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        for (const pointID of face.points) {
            const point = this.points[pointID];
            const [x, y, z] = point.coordinates;
            sumX += x;
            sumY += y;
            sumZ += z;
        }
        const size = face.points.size;
        return [sumX / size, sumY / size, sumZ / size];
    }
    /**
     * Gets the normalVector of a face.
     * @param id The face whose normal vector to get.
     */
    getNormal(id) {
        const face = this.list[id];
        const firstVertex = Array.from(face.vertices)[0];
        const index = this.vertices.idMap.getIndex(firstVertex);
        if (index === null)
            return null;
        const normal = this.vertices.mesh.geometry.attributes.normal;
        const x = normal.getX(index);
        const y = normal.getY(index);
        const z = normal.getZ(index);
        return [x, y, z];
    }
    saveCoordinates(pointID, coordinates, face) {
        const point = this.points[pointID];
        coordinates.push(...point.coordinates);
        const [id] = this.vertices.add([point.coordinates]);
        this._vertexFaceMap.set(id, face.id);
        point.vertices.add(id);
        face.vertices.add(id);
    }
    updateBuffers() {
        const positionBuffer = this.vertices.mesh.geometry.attributes.position;
        const normalBuffer = this.vertices.mesh.geometry.attributes.normal;
        if (this._positionBuffer !== positionBuffer) {
            this.mesh.geometry.deleteAttribute("position");
            this.mesh.geometry.deleteAttribute("normal");
            this.mesh.geometry.deleteAttribute("color");
            this.mesh.geometry.setAttribute("position", positionBuffer);
            this.mesh.geometry.setAttribute("normal", normalBuffer);
            const colorBuffer = new Float32Array(positionBuffer.array.length * 3);
            const colorAttribute = new THREE.BufferAttribute(colorBuffer, 3);
            this.mesh.geometry.setAttribute("color", colorAttribute);
            this.updateColor();
        }
        this._colorBuffer.count = positionBuffer.count;
    }
    updateColor(ids = this.ids) {
        const colorAttribute = this._colorBuffer;
        for (const id of ids) {
            const face = this.list[id];
            const isSelected = this.selected.data.has(face.id);
            const { r, g, b } = isSelected ? this._selectColor : this._baseColor;
            for (const vertexID of face.vertices) {
                const index = this.vertices.idMap.getIndex(vertexID);
                if (index === null)
                    continue;
                colorAttribute.setXYZ(index, r, g, b);
            }
        }
        colorAttribute.needsUpdate = true;
    }
    triangulate(coordinates, holesIndices) {
        // Earcut only supports 2d triangulations, so let's project the face
        // into the cartesian plane that is more parallel to the face
        const dim = this.getProjectionDimension(coordinates);
        const projectedCoords = [];
        for (let i = 0; i < coordinates.length; i++) {
            if (i % 3 !== dim) {
                projectedCoords.push(coordinates[i]);
            }
        }
        return earcut$1(projectedCoords, holesIndices, 2);
    }
    getProjectionDimension(coordinates) {
        const [x1, y1, z1] = this.getCoordinate(0, coordinates);
        const [x2, y2, z2] = this.getCoordinate(1, coordinates);
        const [x3, y3, z3] = this.getCoordinate(2, coordinates);
        const a = [x2 - x1, y2 - y1, z2 - z1];
        const b = [x3 - x2, y3 - y2, z3 - z2];
        const crossProd = [
            Math.abs(a[1] * b[2] - a[2] * b[1]),
            Math.abs(a[2] * b[0] - a[0] * b[2]),
            Math.abs(a[0] * b[1] - a[1] * b[0]),
        ];
        const max = Math.max(...crossProd);
        return crossProd.indexOf(max);
    }
    getCoordinate(index, coordinates) {
        const x = coordinates[index * 3];
        const y = coordinates[index * 3 + 1];
        const z = coordinates[index * 3 + 2];
        return [x, y, z];
    }
}

// import { Vector3 } from "three";
class OffsetFaces extends Primitive {
    get knotsIDs() {
        const ids = [];
        for (const id in this.knots) {
            const idNumber = parseInt(id, 10);
            ids.push(idNumber);
        }
        return ids;
    }
    constructor() {
        super();
        this.faces = new Faces();
        this.lines = new Lines();
        // An axis that goes from A to B will define an OffsetFace like this. The
        // positive offset direction goes up.
        //       p2  +-------------------------------------------+ p3
        //          |                                           |
        //       A +-------------------------------------------+ B
        //        |                                           |
        //    p1 +-------------------------------------------+ p4
        /**
         * The list of axis. Points are p1, p2, p3, p4
         */
        this.list = {};
        /**
         * A knot is the encounter of multiple OffsetFaces at a point. It's made of
         * a point and, optionally, an extra face to fill the gap (if there are more
         * than 3 OffsetFaces).
         */
        this.knots = {};
        this.mesh = this.faces.mesh;
    }
    /**
     * Adds a new set of axes to this instance of OffsetFaces.
     * @param ids the ids of the points that define the axes ({@link Lines}).
     * @param width the width of the faces.
     * @param offset the offset of the faces to their respective axis.
     *
     */
    add(ids, width, offset = 0) {
        const linesIDs = this.lines.add(ids);
        const knotsToUpdate = new Set();
        for (const id of linesIDs) {
            this.list[id] = { id, width, offset, face: 0, points: [] };
            const result = this.getFacePoints(id, knotsToUpdate);
            if (result === null)
                continue;
            const points = this.faces.addPoints(result);
            this.list[id].points = points;
            this.list[id].face = this.faces.add(points);
        }
        this.updateKnots(knotsToUpdate);
        return linesIDs;
    }
    /**
     * Select or unselects the given OffsetFaces.
     * @param active Whether to select or unselect.
     * @param ids List of OffsetFaces IDs to select or unselect. If not
     * defined, all lines will be selected or deselected.
     */
    select(active, ids = this.ids) {
        const faces = [];
        for (const id of ids) {
            const item = this.list[id];
            if (item) {
                faces.push(item.face);
            }
        }
        this.faces.select(active, faces);
        this.lines.select(active, ids);
    }
    /**
     * Select or unselects the given knots.
     * @param active Whether to select or unselect.
     * @param ids List of knot IDs to select or unselect. If not
     * defined, all knots will be selected or deselected.
     */
    selectKnots(active, ids = this.knotsIDs) {
        const points = [];
        const faces = [];
        for (const id of ids) {
            const face = this.knots[id];
            if (face === undefined)
                continue;
            points.push(id);
            if (face !== null) {
                faces.push(face);
            }
        }
        this.lines.selectPoints(active, points);
        this.faces.select(active, faces);
    }
    /**
     * Removes OffsetFaces.
     * @param ids List of OffsetFaces to remove. If no face is specified,
     * removes all the selected OffsetFaces.
     */
    remove(ids = this.lines.selected.data) {
        const relatedKnots = this.getRelatedKnots(ids);
        const facePoints = [];
        for (const id of ids) {
            facePoints.push(...this.list[id].points);
            delete this.list[id];
        }
        this.faces.removePoints(facePoints);
        const linesToUpdate = this.getRelatedLines(relatedKnots);
        this.lines.remove(ids);
        this.updateOffsetFaces(linesToUpdate);
    }
    /**
     * Removes Knots and all the related OffsetFaces.
     * @param ids List of knots to remove. If no knot is specified,
     * removes all the selected knots.
     */
    removePoints(ids = this.lines.vertices.selected.data) {
        const pointsToRemove = new Set();
        const knotFacesToRemove = new Set();
        for (const id of ids) {
            pointsToRemove.add(id);
            const face = this.knots[id];
            if (face !== null && face !== undefined) {
                knotFacesToRemove.add(face);
            }
            delete this.knots[id];
        }
        this.faces.remove(knotFacesToRemove);
        const offsetFacesToRemove = this.getRelatedLines(ids);
        this.remove(offsetFacesToRemove);
        this.lines.removePoints(pointsToRemove);
    }
    /**
     * Sets the offset of the specified OffsetFaces.
     * @param offset The offset to set.
     * @param ids List of knot IDs whose offset to change. If not specified,
     * it will change the offset of the selected OffsetFaces.
     */
    setOffset(offset, ids = this.lines.selected.data) {
        for (const id of ids) {
            const offsetFace = this.list[id];
            offsetFace.offset = offset;
        }
        this.updateOffsetFaces(ids);
    }
    /**
     * Sets the width of the specified OffsetFaces.
     * @param width The width to set.
     * @param ids List of knot IDs whose width to change. If not specified,
     * it will change the width of the selected OffsetFaces.
     */
    setWidth(width, ids = this.lines.selected.data) {
        for (const id of ids) {
            const offsetFace = this.list[id];
            offsetFace.width = width;
        }
        this.updateOffsetFaces(ids);
    }
    /**
     * Applies a transformation to the selected vertices.
     * @param matrix Transformation matrix to apply.
     */
    transform(matrix) {
        this.lines.transform(matrix);
        const selectedPoints = this.lines.vertices.selected.data;
        const linesToUpdate = this.getRelatedLines(selectedPoints);
        this.updateOffsetFaces(linesToUpdate);
    }
    getRelatedKnots(lineIDs) {
        const relatedKnots = new Set();
        for (const id of lineIDs) {
            const line = this.lines.list[id];
            relatedKnots.add(line.start);
            relatedKnots.add(line.end);
        }
        return relatedKnots;
    }
    getRelatedLines(pointIDs, neighbors = false) {
        const linesToUpdate = new Set();
        this.getLinesOfPoints(pointIDs, linesToUpdate);
        if (neighbors) {
            const neighborPoints = new Set();
            for (const lineID of linesToUpdate) {
                const line = this.lines.list[lineID];
                neighborPoints.add(line.start);
                neighborPoints.add(line.end);
            }
            this.getLinesOfPoints(neighborPoints, linesToUpdate);
        }
        return linesToUpdate;
    }
    getLinesOfPoints(pointIDs, lines) {
        for (const id of pointIDs) {
            const point = this.lines.points[id];
            for (const lineID of point.start) {
                lines.add(lineID);
            }
            for (const lineID of point.end) {
                lines.add(lineID);
            }
        }
    }
    getFacePoints(id, knots) {
        const offsetFace = this.list[id];
        if (!offsetFace)
            return null;
        const line = this.lines.list[id];
        const start = this.lines.vertices.get(line.start);
        const end = this.lines.vertices.get(line.end);
        if (!start || !end)
            return null;
        knots.add(line.start);
        knots.add(line.end);
        const rawDirection = Vector.subtract(end, start);
        const direction = Vector.normalize(rawDirection);
        const { width, offset } = offsetFace;
        const normal = Vector.multiply(Vector.up, direction);
        const scaledNormal = Vector.multiplyScalar(normal, width / 2);
        const invScaledNormal = Vector.multiplyScalar(scaledNormal, -1);
        const offsetDirection = Vector.multiplyScalar(normal, offset);
        const p1 = Vector.add(start, scaledNormal, offsetDirection);
        const p2 = Vector.add(start, invScaledNormal, offsetDirection);
        const p3 = Vector.add(end, invScaledNormal, offsetDirection);
        const p4 = Vector.add(end, scaledNormal, offsetDirection);
        return [p1, p2, p3, p4];
    }
    updateOffsetFaces(ids) {
        const knotsToUpdate = new Set();
        for (const id of ids) {
            const offsetFace = this.list[id];
            if (offsetFace === undefined)
                continue;
            const result = this.getFacePoints(id, knotsToUpdate);
            if (result === null)
                continue;
            for (let i = 0; i < 4; i++) {
                const pointID = offsetFace.points[i];
                const coordinates = result[i];
                this.faces.setPoint(pointID, coordinates);
            }
        }
        this.updateKnots(knotsToUpdate);
    }
    updateKnots(ids) {
        for (const id of ids) {
            const point = this.lines.points[id];
            const coords = this.lines.vertices.get(id);
            if (coords === null)
                continue;
            const knotFace = this.knots[id];
            if (knotFace !== undefined && knotFace !== null) {
                const points = this.faces.list[knotFace].points;
                this.faces.removePoints(points);
                this.knots[id] = null;
            }
            if (point.start.size + point.end.size === 1) {
                continue;
            }
            // Strategy: traverse all points, sort lines by angle and find the intersection
            // of each outer line with the next one
            const vectors = this.getNormalVectorsSortedClockwise(id);
            if (vectors.length === 1) {
                continue;
            }
            const intersectionPoints = [];
            for (let i = 0; i < vectors.length; i++) {
                const currentLine = vectors[i];
                const currentVector = currentLine.vector;
                const currentOffsetFace = this.list[currentLine.lineID];
                const isCurrentStart = point.start.has(currentLine.lineID);
                const { width, offset } = currentOffsetFace;
                // If it's the last vector, the next one is the first one
                const isLastVector = i === vectors.length - 1;
                const j = isLastVector ? 0 : i + 1;
                const nextLine = vectors[j];
                const nextVector = nextLine.vector;
                const nextOffsetFace = this.list[nextLine.lineID];
                const isNextStart = point.start.has(nextLine.lineID);
                const nextWidth = nextOffsetFace.width;
                const nextOffset = nextOffsetFace.offset;
                // Express the outlines as a point and a direction
                // Beware the right-handed system for the direction
                const n1 = Vector.multiply(Vector.up, currentVector);
                const o1 = isCurrentStart ? -offset : offset;
                const v1 = Vector.multiplyScalar(n1, width / 2 + o1);
                const p1 = Vector.add(coords, v1);
                const n2 = Vector.multiply(nextVector, Vector.up);
                const o2 = isNextStart ? nextOffset : -nextOffset;
                const v2 = Vector.multiplyScalar(n2, nextWidth / 2 + o2);
                const p2 = Vector.add(coords, v2);
                const r1 = Vector.round(n1);
                const r2 = Vector.round(n2);
                const areLinesParallel = r1[0] === r2[0] && r1[2] === r2[2];
                const currentIndex = isCurrentStart ? 1 : 3;
                const currentPoint = currentOffsetFace.points[currentIndex];
                const nextIndex = isNextStart ? 0 : 2;
                const nextPoint = nextOffsetFace.points[nextIndex];
                if (areLinesParallel) {
                    this.faces.setPoint(currentPoint, p1);
                    this.faces.setPoint(nextPoint, p2);
                    const pr1 = Vector.round(p1);
                    const pr2 = Vector.round(p2);
                    const areSamePoint = pr1[0] === pr2[0] && pr1[2] === pr2[2];
                    intersectionPoints.push(p1);
                    if (!areSamePoint) {
                        intersectionPoints.push(p2);
                    }
                }
                else {
                    // Convert point-direction to implicit 2D line ax + by = d
                    // Although in our case we use z instead of y
                    // p . n = d
                    const a1 = n1[0];
                    const b1 = n1[2];
                    const d1 = p1[0] * n1[0] + p1[2] * n1[2];
                    const a2 = n2[0];
                    const b2 = n2[2];
                    const d2 = p2[0] * n2[0] + p2[2] * n2[2];
                    const x = (b2 * d1 - b1 * d2) / (a1 * b2 - a2 * b1);
                    const z = (a1 * d2 - a2 * d1) / (a1 * b2 - a2 * b1);
                    const y = coords[1];
                    // Update the vertices of both OffsetFaces
                    this.faces.setPoint(currentPoint, [x, y, z]);
                    this.faces.setPoint(nextPoint, [x, y, z]);
                    intersectionPoints.push([x, y, z]);
                }
            }
            if (intersectionPoints.length > 2) {
                // if (Polygon.isConvex(intersectionPoints)) {
                intersectionPoints.reverse();
                // }
                const pointsIDs = this.faces.addPoints(intersectionPoints);
                this.knots[id] = this.faces.add(pointsIDs);
            }
        }
    }
    getNormalVectorsSortedClockwise(id) {
        const vectors = [];
        const point = this.lines.points[id];
        this.getAllNormalizedVectors(vectors, point.start, false);
        this.getAllNormalizedVectors(vectors, point.end, true);
        return this.order2DVectorsClockwise(vectors);
    }
    order2DVectorsClockwise(vectors) {
        const vectorsWithAngles = [];
        for (const line of vectors) {
            const { vector } = line;
            let angle = Math.atan2(vector[0], vector[2]);
            if (angle < 0)
                angle += 2 * Math.PI;
            vectorsWithAngles.push({ angle, line });
        }
        vectorsWithAngles.sort((v1, v2) => (v1.angle > v2.angle ? 1 : -1));
        return vectorsWithAngles.map((item) => item.line);
    }
    getAllNormalizedVectors(vectors, ids, flip) {
        for (const lineID of ids) {
            const line = this.lines.list[lineID];
            const start = this.lines.vertices.get(line.start);
            const end = this.lines.vertices.get(line.end);
            if (start === null || end === null) {
                throw new Error(`Error with line ${lineID}`);
            }
            let vector = Vector.subtract(start, end);
            if (flip) {
                vector = Vector.multiplyScalar(vector, -1);
            }
            vector = Vector.normalize(vector);
            vectors.push({ lineID, vector });
        }
    }
}

class Extrusions extends Primitive {
    constructor() {
        super();
        /** {@link Primitive.mesh } */
        this.mesh = new THREE.Mesh();
        /**
         * The list of outer points that define the faces. Each point corresponds to a set of {@link Vertices}. This way,
         * we can provide an API of faces that share vertices, but under the hood the vertices are duplicated per face
         * (and thus being able to contain the normals as a vertex attribute).
         */
        this.list = {};
        /**
         * The geometric representation of the faces of all the extrusions.
         */
        this.faces = new Faces();
        /**
         * The geometric representation of the lines that represent the axis.
         */
        this.lines = new Lines();
        this._faceExtrusionMap = new Map();
        this._idGenerator = 0;
        this._holeIdGenerator = 0;
        const material = new THREE.MeshLambertMaterial({
            side: THREE.DoubleSide,
            vertexColors: true,
        });
        const geometry = new THREE.BufferGeometry();
        this.mesh = new THREE.Mesh(geometry, material);
        geometry.setIndex([]);
    }
    clear() {
        this.selected.data.clear();
        this.faces.clear();
        this.lines.clear();
        this._idGenerator = 0;
        this._holeIdGenerator = 0;
        this.faces = new Faces();
        this.lines = new Lines();
        this.list = {};
    }
    add(faceID, pathID) {
        const id = this._idGenerator++;
        const newFaces = this.createExtrusion(faceID, pathID);
        if (newFaces) {
            const { topFaceID, sideFacesIDs, holes } = newFaces;
            this._faceExtrusionMap.set(topFaceID, id);
            this._faceExtrusionMap.set(faceID, id);
            for (const sideFaceID of sideFacesIDs) {
                this._faceExtrusionMap.set(sideFaceID, id);
            }
            this.list[id] = {
                id,
                holes,
                baseFace: faceID,
                path: pathID,
                topFace: topFaceID,
                sideFaces: sideFacesIDs,
            };
        }
        return id;
    }
    /**
     * Removes Extrusions.
     * @param ids List of extrusions to remove. If no face is specified,
     * removes all the selected extrusions.
     */
    remove(ids = this.selected.data) {
        const faces = [];
        for (const id of ids) {
            const { topFace, baseFace, sideFaces, holes } = this.list[id];
            faces.push(topFace);
            faces.push(baseFace);
            faces.push(...sideFaces);
            for (const holeID in holes) {
                const hole = holes[holeID];
                faces.push(...hole.faces);
            }
            this._faceExtrusionMap.delete(topFace);
            this._faceExtrusionMap.delete(baseFace);
            for (const sideFace of sideFaces) {
                this._faceExtrusionMap.delete(sideFace);
            }
            delete this.list[id];
        }
        const points = new Set();
        for (const faceID of faces) {
            const face = this.faces.list[faceID];
            for (const point of face.points) {
                points.add(point);
            }
        }
        this.faces.removePoints(points);
    }
    /**
     * Given a face, returns the extrusion that contains it.
     * @param faceID The ID of the face whose extrusion to get.
     */
    getFromFace(faceID) {
        return this._faceExtrusionMap.get(faceID);
    }
    /**
     * Select or unselects the given Extrusions.
     * @param active Whether to select or unselect.
     * @param ids List of extrusion IDs to select or unselect. If not
     * defined, all extrusions will be selected or deselected.
     */
    select(active, ids) {
        const idsUndefined = ids === undefined;
        const items = idsUndefined ? this.ids : ids;
        this.selected.select(active, items, this.ids);
        const faces = [];
        for (const id of this.selected.data) {
            const extrusion = this.list[id];
            if (extrusion) {
                faces.push(extrusion.topFace);
                faces.push(extrusion.baseFace);
                faces.push(...extrusion.sideFaces);
                for (const holeID in extrusion.holes) {
                    const hole = extrusion.holes[holeID];
                    faces.push(...hole.faces);
                }
            }
        }
        const selected = idsUndefined ? undefined : faces;
        this.faces.select(active, selected);
    }
    createExtrusion(faceID, pathID) {
        const linePoints = this.lines.get(pathID);
        if (!linePoints)
            return null;
        const [start, end] = linePoints;
        const vector = Vector.subtract(start, end);
        const baseFace = this.faces.list[faceID];
        // Create top face
        const topFacePoints = [];
        const holesCoordinates = [];
        for (const pointID of baseFace.points) {
            const coords = this.faces.points[pointID].coordinates;
            const transformed = Vector.add(coords, vector);
            topFacePoints.push(transformed);
        }
        for (const holeID in baseFace.holes) {
            const hole = baseFace.holes[holeID];
            const holeCoords = [];
            holesCoordinates.push(holeCoords);
            for (const pointID of hole.points) {
                const coords = this.faces.points[pointID].coordinates;
                const transformed = Vector.add(coords, vector);
                holeCoords.push(transformed);
            }
        }
        const topFacePointsIDs = this.faces.addPoints(topFacePoints);
        const topHolesPoints = [];
        for (const hole of holesCoordinates) {
            const ids = this.faces.addPoints(hole);
            topHolesPoints.push(ids);
        }
        const topFaceID = this.faces.add(topFacePointsIDs, topHolesPoints);
        // Create side faces
        const sideFacesIDs = new Set();
        const baseFaceArray = Array.from(baseFace.points);
        this.createSideFaces(baseFaceArray, topFacePointsIDs, sideFacesIDs);
        // Define holes
        const holes = {};
        const topFace = this.faces.list[topFaceID];
        const baseHolesIDs = Object.keys(baseFace.holes);
        const topHolesIDs = Object.keys(topFace.holes);
        for (let i = 0; i < baseHolesIDs.length; i++) {
            const faces = new Set();
            const baseHole = baseFace.holes[baseHolesIDs[i]];
            const topHole = topFace.holes[topHolesIDs[i]];
            const holeID = this._holeIdGenerator++;
            holes[holeID] = { base: baseHole.id, top: topHole.id, faces };
            const holePointsIdsArray = Array.from(baseHole.points);
            const topHoleCoordsArray = Array.from(topHolesPoints[i]);
            this.createSideFaces(holePointsIdsArray, topHoleCoordsArray, faces);
        }
        return { topFaceID, sideFacesIDs, holes };
    }
    createSideFaces(base, top, faces) {
        for (let i = 0; i < base.length; i++) {
            const isLastFace = i === base.length - 1;
            const nextIndex = isLastFace ? 0 : i + 1;
            const p1 = base[i];
            const p2 = base[nextIndex];
            const p3 = top[nextIndex];
            const p4 = top[i];
            const id = this.faces.add([p1, p2, p3, p4]);
            faces.add(id);
        }
    }
}

// import { Vector3 } from "three";
// TODO: Clean up all, especially holes management
class Walls extends Primitive {
    constructor() {
        super();
        this.offsetFaces = new OffsetFaces();
        this.extrusions = new Extrusions();
        this.list = {};
        this.knots = {};
        this.holes = {};
        this._holeIdGenerator = 0;
        // TODO: Probably better to keep offsetfaces and extrusion faces separated
        this.extrusions.faces = this.offsetFaces.faces;
        this.mesh = this.extrusions.mesh;
        const heightPointsID = this.extrusions.lines.addPoints([
            [0, 0, 0],
            [0, 3, 0],
        ]);
        const [axisID] = this.extrusions.lines.add(heightPointsID);
        this.defaultAxis = axisID;
    }
    regenerate(ids = this.offsetFaces.ids) {
        this.deletePreviousExtrusions(ids);
        for (const id of ids) {
            const extrusion = this.createGeometry(id);
            if (extrusion === null)
                continue;
            const previous = this.list[id];
            const holes = previous ? previous.holes : new Set();
            this.list[id] = {
                id,
                extrusion,
                holes,
            };
        }
        const relatedKnots = this.offsetFaces.getRelatedKnots(ids);
        this.regenerateKnots(relatedKnots);
    }
    /**
     * Select or unselects the given Walls.
     * @param active Whether to select or unselect.
     * @param ids List of walls IDs to select or unselect. If not
     * defined, all lines walls be selected or deselected.
     */
    select(active, ids) {
        const idsUndefined = ids === undefined;
        const items = idsUndefined ? this.ids : ids;
        this.selected.select(active, items, this.ids);
        const extrusions = [];
        for (const id of this.selected.data) {
            const wall = this.list[id];
            if (!wall)
                continue;
            extrusions.push(wall.extrusion);
        }
        const selected = idsUndefined ? undefined : extrusions;
        this.extrusions.select(active, selected);
        this.offsetFaces.select(active, items);
    }
    /**
     * Applies a transformation to the selected geometries.
     * @param matrix Transformation matrix to apply.
     */
    transform(matrix) {
        this.offsetFaces.transform(matrix);
        this.update();
    }
    setWidth(width, ids = this.selected.data) {
        this.offsetFaces.setWidth(width, ids);
        this.update();
    }
    setOffset(offset, ids = this.selected.data) {
        this.offsetFaces.setOffset(offset, ids);
        this.update();
    }
    update() {
        const relatedPoints = new Set();
        for (const id of this.offsetFaces.lines.vertices.selected.data) {
            relatedPoints.add(id);
        }
        const updatedLines = this.offsetFaces.getRelatedLines(relatedPoints, true);
        const updatedKnots = this.offsetFaces.getRelatedKnots(updatedLines);
        for (const id of updatedKnots) {
            this.updateKnotGeometry(id);
        }
        this.updateWalls(updatedLines);
    }
    updateWalls(walls) {
        for (const id of walls) {
            const offsetFace = this.offsetFaces.list[id];
            const extrusionID = this.list[id].extrusion;
            const { baseFace, topFace } = this.extrusions.list[extrusionID];
            const faces = this.extrusions.faces;
            const offsetFaces = this.offsetFaces.faces;
            // Get new point coordinates
            const [p1, p1Top, p4Top, p4] = faces.list[baseFace].points;
            const [p2, p2Top, p3Top, p3] = faces.list[topFace].points;
            const [bp1, bp2, bp3, bp4] = offsetFace.points;
            const p1Coords = offsetFaces.points[bp1].coordinates;
            const p2Coords = offsetFaces.points[bp2].coordinates;
            const p3Coords = offsetFaces.points[bp3].coordinates;
            const p4Coords = offsetFaces.points[bp4].coordinates;
            const axis = this.getVerticalAxis();
            const p1TopCoords = Vector.add(p1Coords, axis);
            const p2TopCoords = Vector.add(p2Coords, axis);
            const p3TopCoords = Vector.add(p3Coords, axis);
            const p4TopCoords = Vector.add(p4Coords, axis);
            // Save distance from holes to p1 to keep it after transform
            const prevP1Coordinates = faces.points[p1].coordinates;
            const holes = this.holes[id];
            const distances = {};
            if (holes) {
                for (const holeID in holes) {
                    distances[holeID] = [];
                    for (const pointID of holes[holeID].basePoints) {
                        const point = faces.points[pointID].coordinates;
                        const [x, y, z] = Vector.subtract(prevP1Coordinates, point);
                        const horizontalDist = Vector.magnitude([x, 0, z]);
                        distances[holeID].push([pointID, horizontalDist, y]);
                    }
                }
            }
            // Set coordinates of base
            faces.setPoint(p1, p1Coords);
            faces.setPoint(p2, p2Coords);
            faces.setPoint(p3, p3Coords);
            faces.setPoint(p4, p4Coords);
            // Set coordinates of top
            faces.setPoint(p1Top, p1TopCoords);
            faces.setPoint(p2Top, p2TopCoords);
            faces.setPoint(p3Top, p3TopCoords);
            faces.setPoint(p4Top, p4TopCoords);
            // Set coordinates of holes in wall, maintaining distance to p1
            const direction = Vector.subtract(p1Coords, p4Coords);
            const normalDir = Vector.normalize(direction);
            const normalPerp = Vector.multiply(Vector.up, normalDir);
            const perpendicular = Vector.multiplyScalar(normalPerp, offsetFace.width);
            if (holes) {
                for (const holeID in distances) {
                    const hole = distances[holeID];
                    const topPoints = Array.from(holes[holeID].topPoints);
                    let counter = 0;
                    for (const point of hole) {
                        const [pointID, x, y] = point;
                        const horizontalVector = Vector.multiplyScalar(normalDir, x);
                        const vector = Vector.add(horizontalVector, [0, y, 0]);
                        const newPosition = Vector.add(p1Coords, vector);
                        faces.setPoint(pointID, newPosition);
                        const topPoint = topPoints[counter++];
                        const newTopPosition = Vector.add(newPosition, perpendicular);
                        faces.setPoint(topPoint, newTopPosition);
                    }
                }
            }
        }
    }
    addHole(id, holePointsIDs) {
        if (!this.holes[id]) {
            this.holes[id] = {};
        }
        for (const points of holePointsIDs) {
            const holeID = this._holeIdGenerator++;
            this.holes[id][holeID] = {
                basePoints: new Set(points),
                topPoints: new Set(),
            };
        }
    }
    deletePreviousExtrusions(ids) {
        const previousExtrusions = [];
        for (const id of ids) {
            const previous = this.list[id];
            if (previous) {
                previousExtrusions.push(previous.extrusion);
            }
        }
        this.extrusions.remove(previousExtrusions);
    }
    regenerateKnots(ids = this.offsetFaces.knotsIDs) {
        for (const knotID of ids) {
            const knot = this.offsetFaces.knots[knotID];
            if (knot === null || knot === undefined)
                continue;
            this.createKnotGeometry(knotID);
        }
    }
    createGeometry(id) {
        const offsetFace = this.offsetFaces.list[id];
        const [p1ID, p2ID, p3ID, p4ID] = offsetFace.points;
        const points = this.offsetFaces.faces.points;
        const p1 = points[p1ID].coordinates;
        const p4 = points[p4ID].coordinates;
        const vector = this.getVerticalAxis();
        const p1Top = Vector.add(p1, vector);
        const p4Top = Vector.add(p4, vector);
        const direction = Vector.subtract(p1, p4);
        const normalDirection = Vector.normalize(direction);
        const normal = Vector.multiply(Vector.up, normalDirection);
        const scaledNormal = Vector.multiplyScalar(normal, offsetFace.width);
        const p1Normal = Vector.add(p1, scaledNormal);
        const normalAxisPointsIDs = this.extrusions.lines.addPoints([p1, p1Normal]);
        const [normalAxis] = this.extrusions.lines.add(normalAxisPointsIDs);
        const pointsIDs = this.extrusions.faces.addPoints([p1, p1Top, p4Top, p4]);
        const faceHoles = this.holes[id];
        const holes = [];
        if (faceHoles) {
            for (const holeID in faceHoles) {
                const hole = faceHoles[holeID];
                const holePoints = Array.from(hole.basePoints);
                holes.push(holePoints);
            }
        }
        const faceID = this.extrusions.faces.add(pointsIDs, holes);
        const extrusionID = this.extrusions.add(faceID, normalAxis);
        const extrusion = this.extrusions.list[extrusionID];
        // Save top holes
        if (faceHoles) {
            let counter = 0;
            const topHoles = Object.values(this.extrusions.faces.list[extrusion.topFace].holes);
            for (const holeID in faceHoles) {
                const hole = topHoles[counter++];
                faceHoles[holeID].topPoints = hole.points;
            }
        }
        // Correct extrusion top to fit the OffsetFace knots
        const otherSide = this.extrusions.faces.list[extrusion.topFace];
        const otherSidePoints = Array.from(otherSide.points);
        const [extrP2, extrP2Top, extrP3Top, extrP3] = otherSidePoints;
        const p2 = points[p2ID].coordinates;
        const p3 = points[p3ID].coordinates;
        const p2Top = Vector.add(p2, vector);
        const p3Top = Vector.add(p3, vector);
        this.extrusions.faces.setPoint(extrP2, p2);
        this.extrusions.faces.setPoint(extrP3, p3);
        this.extrusions.faces.setPoint(extrP2Top, p2Top);
        this.extrusions.faces.setPoint(extrP3Top, p3Top);
        return extrusionID;
    }
    // TODO: Allow each wall to have a different vertical axis
    //  (e.g. for different heights or tilted walls)
    getVerticalAxis() {
        const line = this.extrusions.lines.get(this.defaultAxis);
        if (!line) {
            throw new Error("Wall axis not found!");
        }
        const [start, end] = line;
        return Vector.subtract(start, end);
    }
    updateKnotGeometry(knotID) {
        const baseKnot = this.offsetFaces.knots[knotID];
        if (baseKnot === null || baseKnot === undefined) {
            return;
        }
        const baseFace = this.offsetFaces.faces.list[baseKnot];
        const knot = this.knots[knotID];
        if (!knot || !knot.extrusion) {
            this.createKnotGeometry(knotID);
            console.log("knot didnt exist");
            return;
        }
        const extrudedKnot = this.extrusions.list[knot.extrusion];
        const extrudedBaseFace = this.extrusions.faces.list[extrudedKnot.baseFace];
        const extrudedTopFace = this.extrusions.faces.list[extrudedKnot.topFace];
        if (baseFace.points.size !== extrudedBaseFace.points.size) {
            this.createKnotGeometry(knotID);
            console.log("knot changed size");
            return;
        }
        const verticalAxis = this.getVerticalAxis();
        const basePointsArray = Array.from(extrudedBaseFace.points);
        const topPointsArray = Array.from(extrudedTopFace.points);
        let counter = 0;
        for (const pointID of baseFace.points) {
            const coords = this.offsetFaces.faces.points[pointID].coordinates;
            const basePointID = basePointsArray[counter];
            this.extrusions.faces.setPoint(basePointID, coords);
            const topCoords = Vector.add(coords, verticalAxis);
            const topPointID = topPointsArray[counter];
            this.extrusions.faces.setPoint(topPointID, topCoords);
            counter++;
        }
    }
    createKnotGeometry(knotID) {
        if (this.knots[knotID]) {
            const knot = this.knots[knotID];
            this.extrusions.remove([knot.extrusion]);
        }
        const knotFaceID = this.offsetFaces.knots[knotID];
        if (knotFaceID === null || knotFaceID === undefined)
            return;
        const face = this.offsetFaces.faces.list[knotFaceID];
        const points = [];
        for (const pointID of face.points) {
            const point = this.offsetFaces.faces.points[pointID];
            points.push(point.coordinates);
        }
        const pointsIDs = this.extrusions.faces.addPoints(points);
        const faceID = this.extrusions.faces.add(pointsIDs);
        const extrusion = this.extrusions.add(faceID, this.defaultAxis);
        this.knots[knotID] = {
            id: knotID,
            extrusion,
        };
    }
}

// import { Vector3 } from "three";
class Slabs extends Primitive {
    constructor() {
        super();
        this.extrusions = new Extrusions();
        this.lines = new Lines();
        this._nextIndex = 0;
        this._nextPolylineIndex = 0;
        this._extrusionSlabMap = new Map();
        this.list = {};
        this.polylines = {};
        this.mesh = this.extrusions.mesh;
    }
    /**
     * Given a face index, returns the slab ID that contains it.
     * @param faceIndex The index of the face whose slab ID to get.
     */
    getFromIndex(faceIndex) {
        const faceID = this.extrusions.faces.getFromIndex(faceIndex);
        if (faceID === undefined)
            return undefined;
        const extrusionID = this.extrusions.getFromFace(faceID);
        if (extrusionID === undefined)
            return undefined;
        return this._extrusionSlabMap.get(extrusionID);
    }
    addPolyline(lines) {
        const id = this._nextPolylineIndex++;
        this.polylines[id] = {
            id,
            lines: new Set(lines),
        };
        return id;
    }
    setPolylines(id, lines) {
        this.list[id].polylines = new Set(lines);
    }
    add(polylines, height) {
        const id = this._nextIndex++;
        const directionID = this.getDirection(height);
        this.list[id] = {
            id,
            direction: directionID,
            polylines: new Set(polylines),
            extrusion: null,
        };
        this.regenerate([id]);
    }
    remove(ids) {
        const pointsToDelete = new Set();
        for (const id of ids) {
            const slab = this.list[id];
            this.removeExtrusion(id);
            for (const line of slab.polylines) {
                const { start, end } = this.lines.list[line];
                pointsToDelete.add(start);
                pointsToDelete.add(end);
            }
        }
        this.lines.removePoints(pointsToDelete);
    }
    regenerate(ids) {
        for (const id of ids) {
            this.removeExtrusion(id);
            const slab = this.list[id];
            let outline = [];
            const holes = [];
            const outlineID = this.getOutline(id);
            for (const polyID of slab.polylines) {
                const pointIDs = this.createPoints(polyID);
                if (polyID === outlineID) {
                    outline = pointIDs;
                }
                else {
                    holes.push(pointIDs);
                }
            }
            const face = this.extrusions.faces.add(outline, holes);
            const extrusion = this.extrusions.add(face, slab.direction);
            slab.extrusion = extrusion;
            this._extrusionSlabMap.set(extrusion, id);
        }
    }
    removeExtrusion(id) {
        const slab = this.list[id];
        const extrusion = slab.extrusion;
        if (extrusion === null)
            return;
        this.extrusions.remove([extrusion]);
        this.list[id].extrusion = null;
    }
    getOutline(id) {
        const slab = this.list[id];
        let biggestSize = 0;
        let biggestPolyline = 0;
        for (const polyID of slab.polylines) {
            const size = this.getPolylineSize(polyID);
            if (size > biggestSize) {
                biggestSize = size;
                biggestPolyline = polyID;
            }
        }
        return biggestPolyline;
    }
    getPolylineSize(id) {
        const polyline = this.polylines[id];
        const max = Number.MAX_VALUE;
        const biggest = [-max, -max, -max];
        const smallest = [max, max, max];
        for (const lineID of polyline.lines) {
            const line = this.lines.list[lineID];
            const end = this.lines.vertices.get(line.end);
            if (!end)
                continue;
            if (end[0] > biggest[0])
                biggest[0] = end[0];
            if (end[1] > biggest[1])
                biggest[1] = end[1];
            if (end[2] > biggest[2])
                biggest[2] = end[2];
            if (end[0] < smallest[0])
                smallest[0] = end[0];
            if (end[1] < smallest[1])
                smallest[1] = end[1];
            if (end[2] < smallest[2])
                smallest[2] = end[2];
        }
        const x = Math.abs(biggest[0] - smallest[0]);
        const y = Math.abs(biggest[1] - smallest[1]);
        const z = Math.abs(biggest[2] - smallest[2]);
        return x + y + z;
    }
    createPoints(id) {
        const polyline = this.polylines[id];
        const points = [];
        for (const lineID of polyline.lines) {
            const line = this.lines.list[lineID];
            const end = this.lines.vertices.get(line.end);
            if (!end)
                continue;
            points.push(end);
        }
        return this.extrusions.faces.addPoints(points);
    }
    getDirection(height) {
        // TODO: Make direction normal to face
        const directionPointsIDs = this.extrusions.lines.addPoints([
            [0, 0, 0],
            [0, height, 0],
        ]);
        const [directionID] = this.extrusions.lines.add(directionPointsIDs);
        return directionID;
    }
}

class Polygons {
    get items() {
        return [this.lines.mesh, this.lines.vertices.mesh, this.workPlane];
    }
    get editMode() {
        return this._editMode;
    }
    set editMode(active) {
        this.workPlane.visible = active;
        this._caster.trackMouse = active;
        this._editMode = active;
        if (active) {
            window.addEventListener("mousemove", this.update);
        }
        else {
            window.removeEventListener("mousemove", this.update);
        }
        const wasPolygonInProcess = Boolean(this._newPoints.length);
        const wasDrawingCancelled = wasPolygonInProcess && !active;
        if (wasDrawingCancelled) {
            this.cancel();
        }
    }
    set camera(camera) {
        this._caster.camera = camera;
    }
    set domElement(element) {
        this._caster.domElement = element;
    }
    constructor() {
        this.lines = new Lines();
        this.list = {};
        this._editMode = false;
        this._caster = new Raycaster();
        this._foundItems = [];
        this._isClosingPolygon = false;
        this._newPoints = [];
        this._newLines = [];
        this._firstPointID = null;
        this._nextIndex = 0;
        this.update = () => {
            this._foundItems = this._caster.cast([
                this.workPlane,
                this.lines.vertices.mesh,
            ]);
            if (this.editMode) {
                this.updateCurrentPoint();
            }
        };
        this.workPlane = this.newWorkPlane();
    }
    add() {
        if (!this._editMode)
            return;
        if (!this._foundItems.length)
            return;
        if (this._isClosingPolygon) {
            this.finishPolygon();
            return;
        }
        const { x, y, z } = this._foundItems[0].point;
        if (!this._newPoints.length) {
            const [firstPoint] = this.lines.addPoints([[x, y, z]]);
            this._firstPointID = firstPoint;
            this._newPoints.push(firstPoint);
        }
        const previousPoint = this._newPoints[this._newPoints.length - 1];
        const [newPoint] = this.lines.addPoints([[x, y, z]]);
        this._newPoints.push(newPoint);
        const [newLine] = this.lines.add([previousPoint, newPoint]);
        this._newLines.push(newLine);
        this.lines.vertices.mesh.geometry.computeBoundingSphere();
    }
    cancel() {
        this.lines.removePoints(this._newPoints);
        this._newPoints.length = 0;
        this._newLines.length = 0;
        this._firstPointID = null;
    }
    addPolygon(lines) {
        const id = this._nextIndex++;
        this.list[id] = {
            id,
            lines: new Set(lines),
        };
        return id;
    }
    finishPolygon() {
        const last = this._newPoints.pop();
        if (last !== undefined) {
            this.lines.removePoints([last]);
        }
        this._newLines.pop();
        const lastPoint = this._newPoints[this._newPoints.length - 1];
        const firstPoint = this._newPoints[0];
        const [newLine] = this.lines.add([lastPoint, firstPoint]);
        this._newLines.push(newLine);
        this.addPolygon(this._newLines);
        this._newLines.length = 0;
        this._newPoints.length = 0;
        this._isClosingPolygon = false;
        this._firstPointID = null;
    }
    updateCurrentPoint() {
        if (!this._foundItems.length || this._firstPointID === null) {
            this._isClosingPolygon = false;
            return;
        }
        const lastIndex = this._newPoints.length - 1;
        const lastPoint = this._newPoints[lastIndex];
        let foundFirstPoint = false;
        let basePlane = null;
        const index = this.lines.vertices.idMap.getIndex(this._firstPointID);
        for (const item of this._foundItems) {
            if (item.object === this.workPlane) {
                basePlane = item;
            }
            if (item.object === this.lines.vertices.mesh && item.index === index) {
                foundFirstPoint = true;
            }
        }
        if (foundFirstPoint) {
            const coords = this.lines.vertices.get(this._firstPointID);
            if (coords) {
                const [x, y, z] = coords;
                this.lines.setPoint(lastPoint, [x, y, z]);
                this._isClosingPolygon = true;
                return;
            }
        }
        else if (basePlane) {
            const { x, y, z } = basePlane.point;
            this.lines.setPoint(lastPoint, [x, y, z]);
        }
        this._isClosingPolygon = false;
    }
    newWorkPlane() {
        const floorPlaneGeom = new THREE.PlaneGeometry(10, 10);
        const floorPlaneMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.7,
            color: 0xc4adef,
        });
        const plane = new THREE.Mesh(floorPlaneGeom, floorPlaneMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.visible = false;
        return plane;
    }
}

class Planes {
    get enabled() {
        return this._enabled;
    }
    set enabled(active) {
        this._enabled = active;
        if (active) {
            window.addEventListener("click", this.pick);
        }
        else {
            window.removeEventListener("click", this.pick);
        }
    }
    constructor(scene, cameraGetter) {
        this.faces = new Faces();
        this._caster = new Raycaster();
        this._enabled = false;
        this.transformMode = "TRANSLATE";
        this._lines = new Lines();
        this._selected = null;
        this._v1 = new THREE.Vector3();
        this._v2 = new THREE.Vector3();
        this._v3 = new THREE.Vector3();
        this._v4 = new THREE.Vector3();
        this._q = new THREE.Quaternion();
        this._transformActive = false;
        this._previousTransform = new THREE.Matrix4();
        this._newTransform = new THREE.Matrix4();
        this._tempTransform = new THREE.Matrix4();
        this._state = "IDLE";
        this.updateTransform = () => {
            const result = this._caster.cast([this._helperPlane])[0];
            if (result === null)
                return;
            this.updateAxis(result);
            this.getTransformData();
            this.applyTransform();
        };
        this.startDrawing = () => {
            this._state = "START_DRAWING_AXIS_2";
            window.removeEventListener("click", this.startDrawing);
            window.addEventListener("click", this.finishDrawing);
        };
        this.finishDrawing = () => {
            this._state = "IDLE";
            window.removeEventListener("click", this.finishDrawing);
            this.transform(false);
        };
        this.pick = () => {
            if (this._transformActive)
                return;
            this.faces.select(false);
            this._selected = null;
            const result = this._caster.cast([this.faces.mesh])[0];
            if (!result || result.faceIndex === undefined)
                return;
            const faceID = this.faces.getFromIndex(result.faceIndex);
            if (faceID !== undefined) {
                this._selected = faceID;
                this.faces.select(true, [faceID]);
            }
        };
        this._cameraGetter = cameraGetter;
        this._scene = scene;
        const material = this.faces.mesh.material;
        material.transparent = true;
        material.opacity = 0.2;
        const helperMaterial = new THREE.MeshBasicMaterial({
            color: 0xeeeeee,
            transparent: true,
            opacity: 0.3,
            side: 2,
        });
        const helperGeometry = new THREE.PlaneGeometry(10, 10, 10);
        this._helperPlane = new THREE.Mesh(helperGeometry, helperMaterial);
        // this._helperPlane.visible = false;
        const [a, b, c, d] = this._lines.addPoints([
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]);
        const [helperLineID] = this._lines.add([a, b]);
        this._helperLine1 = this._lines.list[helperLineID];
        const [helperAngleLineID] = this._lines.add([c, d]);
        this._helperLine2 = this._lines.list[helperAngleLineID];
        scene.add(this.faces.mesh);
        scene.add(this._helperPlane);
    }
    add() {
        const pointIDs = this.faces.addPoints([
            [1, 0, 1],
            [-1, 0, 1],
            [-1, 0, -1],
            [1, 0, -1],
        ]);
        return this.faces.add(pointIDs);
    }
    transform(active = !this._transformActive) {
        if (active === this._transformActive)
            return;
        if (active && this._selected === null)
            return;
        this._transformActive = active;
        if (!active) {
            this.setHelperLineVisible(false);
            this.faces.mesh.geometry.computeBoundingSphere();
            this.faces.mesh.geometry.computeBoundingBox();
            window.removeEventListener("mousemove", this.updateTransform);
            return;
        }
        if (this._selected === null)
            return;
        this.setHelperLineVisible(true);
        const center = this.faces.getCenter(this._selected);
        if (center === null) {
            this.transform(false);
            return;
        }
        const [cx, cy, cz] = center;
        this._helperPlane.position.set(cx, cy, cz);
        const camera = this._cameraGetter();
        this._helperPlane.rotation.copy(camera.rotation);
        this._helperPlane.updateMatrix();
        this._helperPlane.updateMatrixWorld();
        const result = this._caster.cast([this._helperPlane])[0];
        if (!result) {
            this.transform(false);
            return;
        }
        this._previousTransform.setPosition(result.point);
        this._newTransform.setPosition(result.point);
        const { x, y, z } = result.point;
        this._lines.setPoint(this._helperLine1.start, [x, y, z]);
        this._lines.setPoint(this._helperLine1.end, [x, y, z]);
        this._lines.setPoint(this._helperLine2.start, [x, y, z]);
        this._lines.setPoint(this._helperLine2.end, [x, y, z]);
        this._state = "DRAWING_AXIS_1";
        if (this.transformMode === "TRANSLATE") {
            window.addEventListener("click", this.finishDrawing);
        }
        else {
            window.addEventListener("click", this.startDrawing);
        }
        window.addEventListener("mousemove", this.updateTransform);
    }
    updateAxis(result) {
        const { x, y, z } = result.point;
        const isFirstAxis = this._state === "DRAWING_AXIS_1";
        const axis = isFirstAxis ? this._helperLine1 : this._helperLine2;
        this._lines.setPoint(axis.end, [x, y, z]);
    }
    getTransformData() {
        if (this.transformMode === "TRANSLATE") {
            this.getTranslation();
        }
        else if (this.transformMode === "ROTATE") {
            this.getRotation();
        }
        else if (this.transformMode === "SCALE") {
            this.getScale();
        }
    }
    getTranslation() {
        const endPoint = this._lines.vertices.get(this._helperLine1.end);
        if (endPoint === null)
            return;
        const [x, y, z] = endPoint;
        this._v1.set(x, y, z);
        this._newTransform.setPosition(this._v1);
    }
    getScale() {
        if (this._state === "DRAWING_AXIS_1")
            return;
        this.getSegmentVectors();
        const firstLength = this._v2.length();
        const secondLength = this._v4.length();
        const factor = secondLength / firstLength;
        this._newTransform.identity();
        const { x, y, z } = this._v1;
        const move = new THREE.Matrix4().makeTranslation(x, y, z);
        const scale = new THREE.Matrix4().makeScale(factor, factor, factor);
        const invMove = move.clone().invert();
        this._newTransform.multiply(move);
        this._newTransform.multiply(scale);
        this._newTransform.multiply(invMove);
        this._newTransform.multiply(this._helperPlane.matrix);
    }
    getRotation() {
        if (this._state === "DRAWING_AXIS_1")
            return;
        this.getSegmentVectors();
        let angle = this._v4.angleTo(this._v2);
        // Correct angle sign (otherwise it's always the shorter unsigned angle)
        this._v3.set(0, 0, 1);
        this._v3.applyEuler(this._helperPlane.rotation);
        this._v4.cross(this._v2);
        const dot = this._v4.dot(this._v3);
        if (dot > 0) {
            angle *= -1;
        }
        // Get axis from camera
        const axis = new THREE.Vector3();
        axis.set(0, 0, 1);
        const camera = this._cameraGetter();
        axis.applyEuler(camera.rotation);
        this._q.setFromAxisAngle(axis, angle);
        this._newTransform.identity();
        const { x, y, z } = this._v1;
        const move = new THREE.Matrix4().makeTranslation(x, y, z);
        const rotation = new THREE.Matrix4().makeRotationFromQuaternion(this._q);
        const invMove = move.clone().invert();
        this._newTransform.multiply(move);
        this._newTransform.multiply(rotation);
        this._newTransform.multiply(invMove);
        this._newTransform.multiply(this._helperPlane.matrix);
    }
    getSegmentVectors() {
        const first = this._lines.get(this._helperLine1.id);
        const second = this._lines.get(this._helperLine2.id);
        if (first === null || second === null)
            return;
        const [[ax, ay, az], [bx, by, bz]] = first;
        const [[cx, cy, cz], [dx, dy, dz]] = second;
        this._v1.set(ax, ay, az);
        this._v2.set(bx, by, bz);
        this._v3.set(cx, cy, cz);
        this._v4.set(dx, dy, dz);
        this._v2.sub(this._v1);
        this._v4.sub(this._v3);
    }
    applyTransform() {
        // Rotation and scale only update when updating the second axis
        const isNotMove = this.transformMode !== "TRANSLATE";
        const isFirstAxis = this._state === "DRAWING_AXIS_1";
        if (isFirstAxis && isNotMove)
            return;
        this._tempTransform.copy(this._newTransform);
        if (this._state === "START_DRAWING_AXIS_2") {
            this._state = "FINISH_DRAWING_AXIS_2";
            this._previousTransform = this._newTransform.clone();
        }
        this._tempTransform.multiply(this._previousTransform.invert());
        this.faces.transform(this._tempTransform);
        this._previousTransform.copy(this._newTransform);
    }
    setHelperLineVisible(active) {
        if (active) {
            this._scene.add(this._lines.mesh, this._lines.vertices.mesh);
        }
        else {
            this._scene.remove(this._lines.mesh, this._lines.vertices.mesh);
        }
    }
}

class CSS2DObject extends Object3D {

	constructor( element = document.createElement( 'div' ) ) {

		super();

		this.isCSS2DObject = true;

		this.element = element;

		this.element.style.position = 'absolute';
		this.element.style.userSelect = 'none';

		this.element.setAttribute( 'draggable', false );

		this.center = new Vector2( 0.5, 0.5 ); // ( 0, 0 ) is the lower left; ( 1, 1 ) is the top right

		this.addEventListener( 'removed', function () {

			this.traverse( function ( object ) {

				if ( object.element instanceof Element && object.element.parentNode !== null ) {

					object.element.parentNode.removeChild( object.element );

				}

			} );

		} );

	}

	copy( source, recursive ) {

		super.copy( source, recursive );

		this.element = source.element.cloneNode( true );

		this.center = source.center;

		return this;

	}

}

//

new Vector3();
new Matrix4();
new Matrix4();
new Vector3();
new Vector3();

class Snapper {
    set vertexThreshold(threshold) {
        // TODO: Add the get() method to the raycaster definition in components
        this._caster.core.params.Points = { threshold };
    }
    set lineThreshold(threshold) {
        this._caster.core.params.Line = { threshold };
    }
    constructor(scene) {
        this.vertices = [];
        this.lines = [];
        this.snap = new Event();
        this.mode = "ALL";
        this._caster = new Raycaster();
        this._helper = new Lines();
        this._helperLinesIDs = new Set();
        this._helperPointsIDs = new Set();
        this._midPoint = null;
        this._helperLinesTimeout = -1;
        this._lastSelectedLine = null;
        this.previewSnap = (found) => {
            if (!found) {
                this._scene.remove(this._vertexIcon);
                return;
            }
            const { coordinates } = found;
            const [x, y, z] = coordinates;
            this._vertexIcon.position.set(x, y, z);
            this._scene.add(this._vertexIcon);
        };
        this.updateLastSelection = (found) => {
            if (found && found.item !== this._helper && found.item instanceof Lines) {
                this._lastSelectedLine = { ...found };
                found.item.select(false);
                found.item.select(true, [found.id]);
            }
        };
        this.updateMidPoint = (found) => {
            if (!found)
                return;
            if (found.item instanceof Lines) {
                if (!this._midPoint) {
                    const [midPoint] = this._helper.addPoints([[0, 0, 0]]);
                    this._midPoint = midPoint;
                }
                const line = found.item.get(found.id);
                if (line === null)
                    return;
                const [[ax, ay, az], [bx, by, bz]] = line;
                const midPoint = [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2];
                this._helper.setPoint(this._midPoint, midPoint);
            }
        };
        this.updateHelperLines = (found) => {
            if (!found) {
                window.clearTimeout(this._helperLinesTimeout);
                return;
            }
            this._helperLinesTimeout = window.setTimeout(() => this.createHelperLines(found), 1000);
        };
        this.createHelperLines = (found) => {
            const [x, y, z] = found.coordinates;
            const scale = 1000;
            // Vertical line
            const top = [x, scale, z];
            const bottom = [x, -scale, z];
            const points = this._helper.addPoints([top, bottom]);
            const [verticalID] = this._helper.add(points);
            if (!this._lastSelectedLine)
                return;
            this.findHelperLineIntersections(top, bottom);
            this._helperLinesIDs.add(verticalID);
            // Extension
            const { id, item } = this._lastSelectedLine;
            const line = item.get(id);
            if (!line)
                return;
            const [[ax, ay, az], [bx, by, bz]] = line;
            const vector = [(bx - ax) * scale, (by - ay) * scale, (bz - az) * scale];
            const [vx, vy, vz] = vector;
            const extStart = [x + vx, y + vy, z + vz];
            const extEnd = [x - vx, y - vy, z - vz];
            const extensionPoints = this._helper.addPoints([extStart, extEnd]);
            const [extensionID] = this._helper.add(extensionPoints);
            this.findHelperLineIntersections(extStart, extEnd);
            this._helperLinesIDs.add(extensionID);
            // Perpendicular
            const v1 = new THREE.Vector3(vx, vy, vz);
            const up = new THREE.Vector3(0, 1, 0);
            v1.cross(up);
            const perpStart = [x + v1.x, y + v1.y, z + v1.z];
            const perpEnd = [x - v1.x, y - v1.y, z - v1.z];
            const perpPoints = this._helper.addPoints([perpStart, perpEnd]);
            const [perpendicularID] = this._helper.add(perpPoints);
            this.findHelperLineIntersections(perpStart, perpEnd);
            this._helperLinesIDs.add(perpendicularID);
        };
        this._scene = scene;
        this.vertexThreshold = 0.5;
        this.lineThreshold = 0.2;
        const element = document.createElement("div");
        element.className = "clay-snap-vertex";
        this._vertexIcon = new CSS2DObject(element);
        this._scene.add(this._helper.mesh);
        const helperMat = this._helper.mesh.material;
        helperMat.transparent = true;
        helperMat.opacity = 0.2;
        this._helper.baseColor = new THREE.Color(0xff0000);
        this.snap.add(this.updateLastSelection);
        this.snap.add(this.previewSnap);
        this.snap.add(this.updateMidPoint);
        this.snap.add(this.updateHelperLines);
        window.addEventListener("mousemove", () => {
            window.clearTimeout(this._helperLinesTimeout);
        });
    }
    find() {
        const result = this.raycastMeshes();
        if (result && result.index !== undefined) {
            const item = this.getFoundItem(result.object);
            if (!item)
                return;
            if (item instanceof Lines)
                result.index /= 2;
            const id = item.idMap.getId(result.index);
            if (id === undefined)
                return;
            const coordinates = this.getSnapCoordinates(item, id, result);
            if (!coordinates)
                return;
            this.snap.trigger({ id, item, coordinates });
        }
        else {
            this.previewSnap();
        }
    }
    removeHelpers() {
        const points = new Set();
        for (const id of this._helperLinesIDs) {
            const line = this._helper.list[id];
            points.add(line.start);
            points.add(line.end);
        }
        for (const id of this._helperPointsIDs) {
            points.add(id);
        }
        this._helper.removePoints(points);
        this._helperLinesIDs.clear();
        this._helperPointsIDs.clear();
    }
    findHelperLineIntersections(start, end) {
        // Source: math primer for graphics, F. Dunn
        // Intersection between two rays in 3D:
        // r1(t1) = p1 + t1 d1,
        // r2(t2) = p2 + t2 d2,
        // Solution:
        // t1 = ((p2 - p1) x d2) · (d1 x d2) / ||d1 x d2||^2
        // t2 = ((p2 - p1) x d1) · (d1 x d2) / ||d1 x d2||^2
        const tolerance = 0.01;
        const p1 = new THREE.Vector3();
        const d1 = new THREE.Vector3();
        const p2 = new THREE.Vector3();
        const d2 = new THREE.Vector3();
        const d1XD2 = new THREE.Vector3();
        const result1 = new THREE.Vector3();
        const result2 = new THREE.Vector3();
        const p2MinusP1 = new THREE.Vector3();
        const p2MinusP1XD2 = new THREE.Vector3();
        const p2MinusP1XD1 = new THREE.Vector3();
        p1.set(start[0], start[1], start[2]);
        d1.set(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
        for (const lineID of this._helperLinesIDs) {
            const line = this._helper.get(lineID);
            if (!line)
                continue;
            const [a, b] = line;
            p2.set(a[0], a[1], a[2]);
            d2.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
            p2MinusP1.subVectors(p2, p1);
            d1XD2.copy(d1);
            d1XD2.cross(d2);
            const d1DotD2Squared = d1XD2.length() ** 2;
            p2MinusP1XD2.copy(p2MinusP1);
            p2MinusP1XD1.copy(p2MinusP1);
            p2MinusP1XD2.cross(d2);
            p2MinusP1XD1.cross(d1);
            const t1 = p2MinusP1XD2.dot(d1XD2) / d1DotD2Squared;
            const t2 = p2MinusP1XD1.dot(d1XD2) / d1DotD2Squared;
            result1.copy(d1);
            result1.multiplyScalar(t1);
            result1.add(p1);
            result2.copy(d2);
            result2.multiplyScalar(t2);
            result2.add(p2);
            if (result1.distanceTo(result2) < tolerance) {
                const { x, y, z } = result1;
                const [id] = this._helper.addPoints([[x, y, z]]);
                this._helperPointsIDs.add(id);
            }
        }
    }
    getFoundItem(mesh) {
        const itemList = [];
        if (this.mode === "VERTEX" || this.mode === "ALL") {
            itemList.push(this._helper.vertices);
            for (const vertices of this.vertices) {
                itemList.push(vertices);
            }
        }
        if (this.mode === "LINE" || this.mode === "ALL") {
            itemList.push(this._helper);
            for (const lines of this.lines) {
                itemList.push(lines);
            }
        }
        const found = itemList.find((vertex) => vertex.mesh === mesh);
        return found;
    }
    raycastMeshes() {
        // TODO: Fix raycaster types to accept more than meshes
        const meshes = [];
        if (this.mode === "VERTEX" || this.mode === "ALL") {
            meshes.push(this._helper.vertices.mesh);
            for (const vertices of this.vertices) {
                meshes.push(vertices.mesh);
            }
        }
        if (this.mode === "LINE" || this.mode === "ALL") {
            meshes.push(this._helper.mesh);
            for (const lines of this.lines) {
                meshes.push(lines.mesh);
            }
        }
        return this._caster.cast(meshes)[0];
    }
    getSnapCoordinates(item, id, result) {
        if (item instanceof Vertices) {
            return item.get(id);
        }
        const { x, y, z } = result.point;
        return [x, y, z];
    }
}

export { BufferManager, Control, Extrusions, Faces, IdIndexMap, Lines, OffsetFaces, Planes, Polygons, Primitive, Raycaster, Selector, Slabs, Snapper, Vector, Vertices, Walls };