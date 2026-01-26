import React from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

type DiscSpec = { radius: number; segments: number };

export function ImageDisc({
  url,
  isUnlocked,
  Disc,
  showBackground = true,
  backgroundColor = "#52525B",
  backgroundOpacity = 1,
  backgroundMetalness = 0,
  backgroundRoughness = 1,
}: {
  url: string;
  isUnlocked: boolean;
  Disc: DiscSpec;
  showBackground?: boolean;
  backgroundColor?: THREE.ColorRepresentation;
  backgroundOpacity?: number;
  backgroundMetalness?: number;
  backgroundRoughness?: number
}) {
  const texture = useTexture(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;

  return (
    <group>
      {showBackground && (
        <mesh renderOrder={1} position={[0, 0, 0]}>
          <circleGeometry args={[Disc.radius, Disc.segments]} />
          <meshStandardMaterial
            color={backgroundColor}
            opacity={backgroundOpacity}
            transparent={backgroundOpacity < 1}
            metalness={backgroundMetalness}
            roughness={backgroundRoughness}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
            depthWrite={true}
            depthTest={true}
            side={THREE.FrontSide}
          />
        </mesh>
      )}

      <mesh renderOrder={2} position={[0, 0, 0.01]}>
        <circleGeometry args={[Disc.radius, Disc.segments]} />
        <meshBasicMaterial
          colorWrite={false}     
          depthWrite={true}
          depthTest={true}
          transparent={false}
          side={THREE.FrontSide}
        />
      </mesh>

      <mesh position={[0, 0, 0.0101]} renderOrder={3}>
        <circleGeometry args={[Disc.radius, Disc.segments]} />
        <meshPhysicalMaterial
          map={texture}
          transparent={true}
          roughness={0.65}
          metalness={0.0}
          clearcoat={0.05}
          clearcoatRoughness={0.6}
          color={isUnlocked ? 0xffffff : 0x808080}
          alphaTest={0.05} 
          depthWrite={false}
          depthTest={true}
          side={THREE.FrontSide}
          toneMapped
          
        />
      </mesh>
    </group>
  );
}
