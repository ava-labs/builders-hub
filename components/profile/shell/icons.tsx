"use client";

import {
  Box,
  Briefcase,
  Code2,
  Compass,
  Gift,
  Github,
  Globe,
  GraduationCap,
  Link,
  Linkedin,
  Mail,
  Puzzle,
  Rocket,
  Send,
  Sparkles,
  Trophy,
  Wallet,
} from "lucide-react";

type IconProps = {
  size?: number;
  className?: string;
};

export const GitHubIcon = Github;
export const TelegramIcon = Send;
export const LinkedInIcon = Linkedin;
export const WebsiteIcon = Globe;
export const MailIcon = Mail;
export const GlobeIcon = Globe;
export const WalletIcon = Wallet;
export const GraduationIcon = GraduationCap;
export const RocketIcon = Rocket;
export const CodeIcon = Code2;
export const BriefcaseIcon = Briefcase;
export const SparkleIcon = Sparkles;
export const TrophyIcon = Trophy;
export const BlockIcon = Box;
export const GiftIcon = Gift;
export const CompassIcon = Compass;
export const PuzzleIcon = Puzzle;
export const LinkIcon = Link;

export function XIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
