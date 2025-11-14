import { Requirement } from "@/types/badge";
import { ReactNode } from "react";

export type BadgeCardProps = {
    id:string;
    icon: ReactNode | string;
    image: string;        
    name: string;                   
    description: string;             
    className?: string;     
    category: string;          
    is_unlocked?: boolean;
    requirements?: Requirement[];
  };