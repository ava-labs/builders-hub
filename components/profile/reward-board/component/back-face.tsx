import * as React from "react";
import { Text } from "@react-three/drei";

export function BackFace({
  name,
  description,
  DISC,
  fontUrl,
}: {
  name: string;
  description?: string;
  DISC: { radius: number; segments: number };
  fontUrl?: string;
}) {
  const R = DISC.radius;
  const plateRadius = R * 0.94;

  const titleFs = R * 0.22;
  const descFs  = R * 0.13;
  const [titleHeight, setTitleHeight] = React.useState(0);
  const TITLE_TOP_Y = plateRadius * 0.45;
  const GAP_Y       = R * 0.06; 

  return (
    <group rotation={[0, Math.PI, 0]} renderOrder={0}>
      
      <mesh position={[0, 0, -0.010]}>
        <circleGeometry args={[plateRadius, DISC.segments]} />
          <meshPhysicalMaterial
          roughness={0.7}
          metalness={0.85}
          envMapIntensity={0.5}
          color={"#999B9B"}
          clearcoat={0.1}
          clearcoatRoughness={0.2}
        />
      </mesh>


      <Text
        position={[0, TITLE_TOP_Y, -0.008]}
        fontSize={titleFs}
        anchorX="center"
        anchorY="top"
        maxWidth={plateRadius * 1.7}
        lineHeight={1.08}
        textAlign="center"
        overflowWrap="break-word"
        whiteSpace="normal"
        color="#ffffff"
        outlineWidth={titleFs * 0.06}
        outlineColor="#000"
        sdfGlyphSize={128}
        glyphGeometryDetail={16}
        material-toneMapped={false}
        material-transparent={false}   
        material-depthWrite={true}
        material-depthTest={true}
        onSync={(troika: any) => {
        
          const b = troika.textRenderInfo?.blockBounds;
          if (b) {
            const h = b[3] - b[1]; // maxY - minY
            if (h > 0 && Math.abs(h - titleHeight) > 1e-3) setTitleHeight(h);
          }
        }}
        font={fontUrl}
      >
        {name}
      </Text>

      
      {description && (
        <Text
          position={[0, TITLE_TOP_Y - titleHeight - GAP_Y, -0.0082]}
          fontSize={descFs}
          anchorX="center"
          anchorY="top"
          maxWidth={plateRadius * 1.8}
          lineHeight={1.18}
          textAlign="center"
          overflowWrap="break-word"
          whiteSpace="normal"
          color="#e5e7eb"
          outlineWidth={descFs * 0.05}
          outlineColor="#000"
          sdfGlyphSize={128}
          glyphGeometryDetail={16}
          material-toneMapped={false}
          material-transparent={false}   
          material-depthWrite={true}
          material-depthTest={true}
          font={fontUrl}
        >
          {description}
        </Text>
      )}
    </group>
  );
}
