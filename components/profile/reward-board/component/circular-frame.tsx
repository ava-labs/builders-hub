export function CircularFrame({ color = "#999B9B" }: { color?: string }) {
    const FRAME = {
        majorRadius: 1.3, 
        tubeRadius: 0.09, 
        tubularSegments: 200,
        radialSegments: 200,
      };
    return (
      <mesh>
        <torusGeometry
          args={[
            FRAME.majorRadius,
            FRAME.tubeRadius,
            FRAME.radialSegments,
            FRAME.tubularSegments,
          ]}
        />
        <meshPhysicalMaterial
          roughness={0.35}
          metalness={0.85}
          envMapIntensity={1.0}
          color={color}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
        />
      </mesh>
    );
  }