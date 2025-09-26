
import React, {  } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export function ImageDisc({ url, isUnlocked,Disc }: { url: string; isUnlocked: boolean ,  Disc: { radius: number; segments: number }}) {
    const texture = useTexture(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;
  
    return (
      <mesh position={[0, 0, 0.01]}>
        <circleGeometry args={[Disc.radius, Disc.segments]} />
        <meshPhysicalMaterial
          map={texture}
          roughness={0.65}
          metalness={0.0}
          clearcoat={0.05}
          clearcoatRoughness={0.6}
          transparent={false}
          color={isUnlocked ? 0xffffff : 0x808080}
          toneMapped
        />
      </mesh>
    );
  }
  