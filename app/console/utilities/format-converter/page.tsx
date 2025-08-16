"use client";

import { lazy } from "react";

const FormatConverter = lazy(() => 
  import("../../../../toolbox/src/toolbox/Conversion/FormatConverter").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <FormatConverter />
  );
}