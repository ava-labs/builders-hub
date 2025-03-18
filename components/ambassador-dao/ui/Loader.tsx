import { Loader2 } from "lucide-react";
import React from "react";

const Loader = () => {
  return (
    <div className="flex justify-center items-center h-40">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full opacity-50"></div>
        <Loader2 className="text-white w-8 h-8 animate-spin" />
      </div>
    </div>
  );
};

export default Loader;
