import * as THREE from 'three';

export const SELECT_RING = new THREE.RingGeometry(0.6, 0.75, 32);

// Player character geometries
export const SHADOW_CIRCLE_LG = new THREE.CircleGeometry(0.35, 16);
export const SELECT_RING_LG = new THREE.RingGeometry(0.45, 0.55, 32);
export const STATUS_SPHERE_PLAYER = new THREE.SphereGeometry(0.06, 8, 8);
export const CLICK_SPHERE = new THREE.SphereGeometry(0.5, 8, 8);

// WorkshopStation geometries (shared across 4 stations)
export const STATION_CYLINDER = new THREE.CylinderGeometry(1.8, 2.0, 0.1, 6);
export const STATION_GLOW_RING = new THREE.RingGeometry(1.6, 1.9, 32);
export const STATION_PORTAL_SPHERE = new THREE.SphereGeometry(0.35, 16, 16);
export const STATION_TORUS_OUTER = new THREE.TorusGeometry(0.55, 0.02, 8, 32);
export const STATION_TORUS_INNER = new THREE.TorusGeometry(0.5, 0.015, 8, 32);
