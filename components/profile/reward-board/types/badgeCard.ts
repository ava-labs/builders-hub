import { ReactNode } from "react";

export type BadgeCardProps = {
    icon: ReactNode | string;
    image: string;        
    name: string;                   
    description: string;             
    className?: string;     
    category: string;          
  };