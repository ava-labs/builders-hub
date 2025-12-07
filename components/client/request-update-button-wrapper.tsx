"use client";
import RequestUpdateButton from "@/components/ui/request-update-button";

interface RequestUpdateButtonWrapperProps {
  pagePath: string;
  title: string;
  buttonVariant?: "link" | "default" | "destructive" | "outline" | "secondary" | "ghost";
  buttonText?: string;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export default function RequestUpdateButtonWrapper(props: RequestUpdateButtonWrapperProps) {
  return <RequestUpdateButton {...props} />;
}
