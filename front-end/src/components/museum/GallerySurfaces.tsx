import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2, type Texture } from 'three';

interface GalleryMaterials {
  stone: MeshStandardMaterial; plaster: MeshStandardMaterial; walnut: MeshStandardMaterial;
  bronze: MeshStandardMaterial; charcoal: MeshStandardMaterial; grout: MeshStandardMaterial; contact: Texture;
}
const GallerySurfaceContext = createContext<GalleryMaterials | null>(null);

/** Committed room owner: no global cache and no shared model-material mutations. */
export function GallerySurfaces({ children }: { children: ReactNode }) {
  const { gl, invalidate } = useThree();
  const [materials, setMaterials] = useState<GalleryMaterials | null>(null);
  useLayoutEffect(() => {
    let isDisposed = false;
    const textures: Texture[] = [];
    const loader = new TextureLoader();
    const stone = new MeshStandardMaterial({ name: 'Gallery limestone', color: '#ffffff', roughness: .76, normalScale: new Vector2(.07, .07) });
    const plaster = new MeshStandardMaterial({ name: 'Gallery lime plaster', color: '#ffffff', roughness: .92, normalScale: new Vector2(.12, .12) });
    const walnut = new MeshStandardMaterial({ name: 'Gallery walnut', color: '#ffffff', roughness: .48, normalScale: new Vector2(.12, .12) });
    const bronze = new MeshStandardMaterial({ name: 'Gallery brushed bronze', color: '#a68b59', metalness: .72, roughness: .38 });
    const charcoal = new MeshStandardMaterial({ name: 'Gallery charcoal stone', color: '#30342f', roughness: .62 });
    const grout = new MeshStandardMaterial({ name: 'Gallery stone joints', color: '#aaa394', roughness: .95 });
    const load = (name: string, material: MeshStandardMaterial | null, channel: 'map' | 'normalMap' | 'roughnessMap' = 'map', repeat = 1) => {
      const texture = loader.load(`/textures/gallery/${name}.png`, () => {
        if (isDisposed) { texture.dispose(); return; }
        if (material) { material[channel] = texture; material.needsUpdate = true; }
        invalidate();
      }, undefined, () => { /* Flat PBR finishes remain readable if a local image fails. */ });
      texture.name = name;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(repeat, repeat);
      texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
      if (channel === 'map' && material) texture.colorSpace = SRGBColorSpace;
      textures.push(texture);
      return texture;
    };
    load('limestone-color', stone, 'map', 4);
    load('limestone-normal', stone, 'normalMap', 4);
    load('limestone-roughness', stone, 'roughnessMap', 4);
    load('plaster-color', plaster, 'map', 2);
    load('plaster-normal', plaster, 'normalMap', 2);
    load('walnut-color', walnut);
    load('walnut-normal', walnut, 'normalMap');
    const contact = load('contact-shadow', null);
    setMaterials({ stone, plaster, walnut, bronze, charcoal, grout, contact });
    return () => {
      isDisposed = true;
      textures.forEach(texture => texture.dispose());
      [stone, plaster, walnut, bronze, charcoal, grout].forEach(material => material.dispose());
    };
  }, [gl, invalidate]);
  return materials && <GallerySurfaceContext.Provider value={materials}>{children}</GallerySurfaceContext.Provider>;
}

export function useGallerySurfaces() {
  const surfaces = useContext(GallerySurfaceContext);
  if (!surfaces) throw new Error('Gallery surfaces require a committed room owner');
  return surfaces;
}
