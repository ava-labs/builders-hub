type Instructor = {
    name: string;
    title: string;
    image: string;
    x: string;
    linkedin: string;
    github: string;
};

const instructors: Instructor[] = [
    {
        name: "Martin Eckardt",
        title: "Sr. Director of Developer Relations",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/martin-eckardt.jpeg",
        x: "https://x.com/martin_eckardt",
        linkedin: "https://www.linkedin.com/in/eckardt/",
        github: "https://github.com/martineckardt",
    },
    {
        name: "Andrea Vargas",
        title: "Sr. Developer Relations Engineer",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/andrea-vargas.jpeg",
        x: "https://x.com/Andyvargtz",
        linkedin: "https://www.linkedin.com/in/andyvargtz/",
        github: "https://github.com/andyvargtz",
    },
    {
        name: "Ash",
        title: "Developer Relations Engineer",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/ash.jpeg",
        x: "https://x.com/ashngmi",
        linkedin: "https://www.linkedin.com/in/andyvargtz/",
        github: "https://github.com/ashucoder9",
    },
    {
        name: "Owen Wahlgren",
        title: "Developer Relations Engineer",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/owen-wahlgren.jpeg",
        x: "https://x.com/owenwahlgren",
        linkedin: "https://www.linkedin.com/in/owenwahlgren/",
        github: "https://github.com/owenwahlgren",
    },
    {
        name: "Sarp",
        title: "Sr. Developer Relations Engineer",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/sarp.jpeg",
        x: "https://x.com/satatocom",
        linkedin: "https://www.linkedin.com/in/sarptaylan/",
        github: "https://github.com/0xstt",
    },
    {
        name: "Aaron Buchwald",
        title: "HyperSDK Lead Engineer",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/aaron-buchwald.jpeg",
        x: "https://x.com/AaronBuchwald",
        linkedin: "",
        github: "",
    },
    {
        name: "Ilya",
        title: "Sr. Developer Relations Engineer",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/ilya.jpeg",
        x: "https://x.com/containerman17",
        linkedin: "",
        github: "",
    },
    {
        name: "Rodrigo Villar",
        title: "Developer Relations Engineer",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/rodrigo-villar.jpeg",
        x: "https://x.com/rrodrigovillar",
        linkedin: "",
        github: "",
    },
    {
        name: "Nicolas Arnedo",
        title: "Developer Relations Engineer",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/nicolas-arnedo.jpeg",
        x: "https://x.com/navilla_eth",
        linkedin: "https://www.linkedin.com/in/nicolasarnedo/",
        github: "https://github.com/navillanueva",
    },
    {
        name: "Michael Martin",
        title: "Codebase Director",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/michael-martin.jpeg",
        x: "https://x.com/mmartinxyz",
        linkedin: "https://www.linkedin.com/in/michaeltmartin/",
        github: "",
    },
    {
        name: "Doro Unger-Lee",
        title: "Senior Developer Relations",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/doro-unger-lee.jpeg",
        x: "https://x.com/doroungerlee",
        linkedin: "https://www.linkedin.com/in/doro-unger-lee/",
        github: "",
    },
    {
        name: "Alejandro Soto",
        title: "Developer Relations Engineer",
        image: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/instructors/alejandro-soto.png",
        x: "https://x.com/alejandro99so",
        linkedin: "https://www.linkedin.com/in/alejandro99so/",
        github: "https://github.com/alejandro99so",
    }
];

export function getInstructorsByNames(names: string[]): Instructor[] {
    return names.map((name) => instructors.find((instructor) => instructor.name === name)).filter((obj) => obj !== undefined) as Instructor[];
}

export default instructors;