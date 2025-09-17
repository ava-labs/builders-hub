import * as React from "react";
import { Text } from "@react-three/drei";

type Req = { id: string | number; description: string; points?: number; unlocked?: boolean };

export function BackFaceText({
  name,
  description,
  requirements = [],
  totalPoints,
  DISC, // { radius, segments }
}: {
  name: string;
  description?: string;
  requirements?: Req[];
  totalPoints: number;
  DISC: { radius: number; segments: number };
}) {
  // Radio útil dejando un margen al borde del aro
  const R = DISC.radius * 0.9;

  // Escalas proporcionales (se adaptan si cambias el tamaño del disco)
  const titleFs = R * 0.22;     // título
  const descFs  = R * 0.12;     // descripción
  const reqFs   = R * 0.12;     // filas
  const totalFs = R * 0.16;     // total

  // Área “rectangular” donde vivirá la lista (aprox. dentro del círculo)
  // Coordenadas locales del Text: [left, top, right, bottom]
  const listTop    =  R * 0.35;
  const listBottom = -R * 0.55;
  const listLeft   = -R * 0.85;
  const listRight  =  R * 0.85;
  const clipRect: [number, number, number, number] = [listLeft, listTop, listRight, listBottom];

  // Cálculo de filas visibles según alto disponible
  const lineH = reqFs * 1.15;
  const maxRows = Math.max(1, Math.floor((listTop - listBottom) / lineH));

  // Scroll/paginación
  const [start, setStart] = React.useState(0);
  const end = Math.min(start + maxRows, requirements.length);
  const moreAbove = start > 0;
  const moreBelow = end < requirements.length;

  const onWheel = (e: any) => {
    const dir = Math.sign(e.deltaY); // 1 abajo, -1 arriba
    if (dir > 0 && moreBelow) setStart((s) => Math.min(s + 1, requirements.length - maxRows));
    if (dir < 0 && moreAbove) setStart((s) => Math.max(0, s - 1));
  };

  return (
    // Dorso: está rotado π para “mirar” a cámara cuando la medalla da la vuelta
    <group rotation={[0, Math.PI, 0]} position={[0, 0, -0.011]} onWheel={onWheel}>
      {/* Título */}
      <Text
        position={[0, R * 0.88, 0]}
        fontSize={titleFs}
        anchorX="center"
        anchorY="top"
        color="#ffffff"
        outlineWidth={titleFs * 0.10}
        outlineColor="black"
        letterSpacing={0.002}
        maxWidth={R * 1.7}
      >
        {name}
      </Text>

      {/* Descripción (opcional) */}
      {description && (
        <Text
          position={[0, R * 0.55, 0]}
          fontSize={descFs}
          anchorX="center"
          anchorY="top"
          color="#e5e7eb"
          outlineWidth={descFs * 0.08}
          outlineColor="black"
          maxWidth={R * 1.8}
          lineHeight={1.1}
        >
          {description}
        </Text>
      )}

      {/* Etiqueta “Requirements” */}
      <Text
        position={[0, R * 0.38, 0]}
        fontSize={reqFs * 0.95}
        anchorX="center"
        anchorY="top"
        color="#ffffff"
        outlineWidth={reqFs * 0.08}
        outlineColor="black"
        letterSpacing={0.002}
      >
        Requirements
      </Text>

      {/* Lista (recortada con clipRect) */}
      {requirements.slice(start, end).map((r, i) => (
        <Text
          key={String(r.id)}
          position={[0, listTop - (i + 1) * lineH, 0]}
          fontSize={reqFs}
          anchorX="center"
          anchorY="top"
          color={r.unlocked ? "#cbd5e1" : "#f8fafc"}
          outlineWidth={reqFs * 0.06}
          outlineColor="black"
          lineHeight={1.05}
          maxWidth={R * 1.85}
          clipRect={clipRect}   // 👈 evita que se salga del área
        >
          {`${r.description}: ${Number(r.points ?? 0)} pts`}
        </Text>
      ))}

      {/* Indicadores de scroll */}
      {moreAbove && (
        <Text
          position={[0, listTop + reqFs * 0.6, 0]}
          fontSize={reqFs * 0.9}
          anchorX="center"
          anchorY="middle"
          color="#ffffff"
          outlineWidth={reqFs * 0.06}
          outlineColor="black"
        >
          ▲
        </Text>
      )}
      {moreBelow && (
        <Text
          position={[0, listBottom - reqFs * 0.6, 0]}
          fontSize={reqFs * 0.9}
          anchorX="center"
          anchorY="middle"
          color="#ffffff"
          outlineWidth={reqFs * 0.06}
          outlineColor="black"
        >
          ▼
        </Text>
      )}

      {/* Total */}
      <Text
        position={[0, R * -0.80, 0]}
        fontSize={totalFs}
        anchorX="center"
        anchorY="bottom"
        color="#ffffff"
        outlineWidth={totalFs * 0.10}
        outlineColor="black"
      >
        {`Total: ${totalPoints} pts`}
      </Text>
    </group>
  );
}
