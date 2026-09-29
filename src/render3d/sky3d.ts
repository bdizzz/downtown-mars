import * as THREE from "three";

// The sky: a dome round the camera, shaded by height. By day, butterscotch
// dust at the horizon deepening to a darker tan overhead, with the bluish
// glow Mars has round its sun; by night, near-black with stars coming out.
// It moves with the camera, so it's always as far away as anything can be.

const SKY = {
  radius: 3000,
  day: { horizon: 0xdca77a, zenith: 0x9c6a4c },
  night: { horizon: 0x1c1016, zenith: 0x040208 },
  /** The sun's halo (bluish, as on Mars) and its disc. */
  halo: 0x9ab4d8,
  /** Sky cells per radian (each about a degree across, so a star is a couple of pixels), the share holding a star, and the stars' fade-in as the light goes. */
  starCells: 60,
  starDensity: 0.08,
  starsBy: 0.35,
  /** A dust storm: the sky thickens to this murk (at full daylight; darker by night), hiding the sun and stars. */
  dust: 0x9a6a4a,
  dustNight: 0x1a100c,
};

const VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 dayHorizon;
  uniform vec3 dayZenith;
  uniform vec3 nightHorizon;
  uniform vec3 nightZenith;
  uniform vec3 halo;
  uniform vec3 sunDir;
  uniform float light;
  uniform float starDensity;
  uniform float starCells;
  uniform float starsBy;
  uniform float dust;
  uniform vec3 dustDay;
  uniform vec3 dustNight;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 d = normalize(vDir);
    // Up the sky: quickly out of the horizon's band, then slowly to the zenith.
    float t = pow(clamp(d.y, 0.0, 1.0), 0.45);
    vec3 day = mix(dayHorizon, dayZenith, t);
    vec3 night = mix(nightHorizon, nightZenith, t);
    vec3 col = mix(night, day, light);
    // The sun: a bluish halo round it, and the disc.
    float s = max(dot(d, normalize(sunDir)), 0.0);
    col += halo * pow(s, 24.0) * 0.45 * light;
    col += vec3(1.0, 0.96, 0.9) * smoothstep(0.9990, 0.9996, s) * light;
    // Stars: a scattering of sky cells each hold one, a point that fades in as the light goes.
    float dark = 1.0 - smoothstep(0.0, starsBy, light);
    if (dark > 0.0 && d.y > 0.0) {
      vec3 p = d * starCells;
      vec3 cell = floor(p);
      float h = hash(cell);
      if (h > 1.0 - starDensity) {
        vec3 at = vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 4.1)) * 0.6 + 0.2;
        float r = length(fract(p) - at);
        float bright = mix(0.4, 1.0, hash(cell + 9.1));
        col += vec3(0.95, 0.92, 1.0) * smoothstep(0.16, 0.02, r) * bright * dark * smoothstep(0.0, 0.08, d.y);
      }
    }
    // A storm: murk, a little lighter toward the horizon, over everything.
    vec3 murk = mix(dustNight, dustDay, light) * (1.05 - 0.15 * t);
    col = mix(col, murk, dust);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface Sky {
  mesh: THREE.Mesh;
  /** Daylight 0..1, and where the sun is (a direction). */
  update(light: number, sunDir: THREE.Vector3): void;
  /** A dust storm's hold on the sky: 0 clear to 1. */
  setDust(level: number): void;
  /** Keep it centred on the camera. */
  follow(camera: THREE.Camera): void;
  dispose(): void;
}

export function createSky(): Sky {
  const lin = (hex: number) => new THREE.Color(hex);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      dayHorizon: { value: lin(SKY.day.horizon) },
      dayZenith: { value: lin(SKY.day.zenith) },
      nightHorizon: { value: lin(SKY.night.horizon) },
      nightZenith: { value: lin(SKY.night.zenith) },
      halo: { value: lin(SKY.halo) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      light: { value: 1 },
      starDensity: { value: SKY.starDensity },
      starCells: { value: SKY.starCells },
      starsBy: { value: SKY.starsBy },
      dust: { value: 0 },
      dustDay: { value: lin(SKY.dust) },
      dustNight: { value: lin(SKY.dustNight) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY.radius, 48, 24), material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return {
    mesh,
    update(light, sunDir) {
      material.uniforms.light!.value = light;
      (material.uniforms.sunDir!.value as THREE.Vector3).copy(sunDir).normalize();
    },
    setDust(level) {
      material.uniforms.dust!.value = level * 0.9;
    },
    follow(camera) {
      mesh.position.copy(camera.position);
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
