import { BookOpen, Code, CalendarDays, Lightbulb } from 'lucide-react';
import type { CourseNode } from '../learning-tree';

export const team1LearningPaths: CourseNode[] = [
    {
        id: "team1-fundamentals",
        name: "Team1 Fundamentals",
        description: "Start here: program basics, expectations, and your first steps.",
        slug: "team1/team1-fundamentals",
        category: "Fundamentals",
        position: { x: 50, y: 0 },
        mobileOrder: 1
    },
    {
        id: "team1-technical-member",
        name: "Team1 Technical Member",
        description: "Go deeper on building, contributing, and shipping with the community.",
        slug: "team1/team1-technical-member",
        category: "Technical",
        dependencies: ["team1-fundamentals"],
        position: { x: 20, y: 200 },
        mobileOrder: 2
    },
    {
        id: "team1-organizing-first-event",
        name: "Team1 Organizing Your First Event",
        description: "Plan and run your first Team1 event with practical guidance.",
        slug: "team1/team1-organizing-first-event",
        category: "Community",
        dependencies: ["team1-fundamentals"],
        position: { x: 80, y: 200 },
        mobileOrder: 3
    },
    {
        id: "team1-advanced-technical-member",
        name: "Team1 Advanced Technical Member",
        description: "Specialize yourself in advanced technical topics.",
        slug: "team1/team1-advanced-technical-member",
        category: "Technical",
        dependencies: ["team1-technical-member"],
        position: { x: 20, y: 400 },
        mobileOrder: 4
    },
    {
        id: "team1-soft-skills",
        name: "Team1 Soft Skills",
        description: "Communicate clearly, present confidently, listen deeply, and lead without authority.",
        slug: "team1/team1-soft-skills",
        category: "Soft Skills",
        dependencies: ["team1-fundamentals"],
        position: { x: 50, y: 200 },
        mobileOrder: 5
    },
];

export const team1CategoryStyles = {
    "Fundamentals": {
        gradient: "from-blue-500 to-blue-600",
        icon: BookOpen,
        lightBg: "bg-blue-50",
        darkBg: "dark:bg-blue-950",
        label: "Fundamentals"
    },
    "Technical": {
        gradient: "from-orange-500 to-orange-600",
        icon: Code,
        lightBg: "bg-orange-50",
        darkBg: "dark:bg-orange-950",
        label: "Technical"
    },
    "Community": {
        gradient: "from-purple-500 to-purple-600",
        icon: CalendarDays,
        lightBg: "bg-purple-50",
        darkBg: "dark:bg-purple-950",
        label: "Community"
    },
    "Soft Skills": {
        gradient: "from-green-500 to-green-600",
        icon: Lightbulb,
        lightBg: "bg-green-50",
        darkBg: "dark:bg-green-950",
        label: "Soft Skills"
    },
};

