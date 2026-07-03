"use client";

import * as React from "react";
import {
  CodeIcon,
  GraduationIcon,
  RocketIcon,
  BriefcaseIcon,
  SparkleIcon,
  TrophyIcon,
  BlockIcon,
  GiftIcon,
  CompassIcon,
} from "./icons";
import type { IconKind } from "./data";

export function RoleIconRender({ kind, size = 16 }: { kind: IconKind; size?: number }) {
  switch (kind) {
    case "graduation":
      return <GraduationIcon size={size} />;
    case "rocket":
      return <RocketIcon size={size} />;
    case "code":
      return <CodeIcon size={size} />;
    case "briefcase":
      return <BriefcaseIcon size={size} />;
    case "sparkle":
      return <SparkleIcon size={size} />;
    case "trophy":
      return <TrophyIcon size={size} />;
    case "block":
      return <BlockIcon size={size} />;
    case "gift":
      return <GiftIcon size={size} />;
    case "compass":
      return <CompassIcon size={size} />;
    default:
      return <SparkleIcon size={size} />;
  }
}
