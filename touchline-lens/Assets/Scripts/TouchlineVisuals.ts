// TouchlineVisuals — small runtime geometry helpers shared by the view components.
// Owns: creating a coloured, size-normalised mesh child (mesh AABB -> exact cm size) and
// cloning tinted materials. Must not: hold state or decide gameplay.

/** Clone `base` and tint it. Works for Unlit and PBR presets (both expose baseColor). */
export function tinted(base: Material, color: vec4): Material {
  const m = base.clone()
  m.mainPass.baseColor = color
  return m
}

/**
 * Create a child SceneObject with a RenderMeshVisual whose mesh is scaled so its AABB is
 * exactly `sizeCm`, centred at `centerCm` (local to `parent`).
 */
export function addBox(
  parent: SceneObject,
  name: string,
  mesh: RenderMesh,
  material: Material,
  sizeCm: vec3,
  centerCm: vec3,
): RenderMeshVisual {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  const min = mesh.aabbMin
  const max = mesh.aabbMax
  const ext = max.sub(min)
  const scale = new vec3(
    ext.x > 1e-5 ? sizeCm.x / ext.x : 1,
    ext.y > 1e-5 ? sizeCm.y / ext.y : 1,
    ext.z > 1e-5 ? sizeCm.z / ext.z : 1,
  )
  const meshCenter = min.add(max).uniformScale(0.5)
  const offset = new vec3(meshCenter.x * scale.x, meshCenter.y * scale.y, meshCenter.z * scale.z)
  const t = so.getTransform()
  t.setLocalScale(scale)
  t.setLocalPosition(centerCm.sub(offset))
  const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  rmv.mesh = mesh
  rmv.mainMaterial = material
  return rmv
}

export function scaleColor(c: vec4, f: number): vec4 {
  return new vec4(c.x * f, c.y * f, c.z * f, c.w)
}
