import { integration } from '@/lib/source';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import { buttonVariants } from '@/components/ui/button';
import { Pill, Pills } from '@/components/ui/pills';

export default function Page(): React.ReactElement {
    const list = [...integration.getPages()];
    return (
        <main className="py-12 sm:py-24">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto w-full flex flex-col items-center lg:mx-0 gap-6">
                    <h1 className="text-center text-4xl font-semibold md:text-5xl">Find an Integration</h1>
                    <p className="h-fit text-center p-2 text-fd-muted-foreground md:max-w-[80%] md:text-xl">
                        Discover best-in-class integrations for your Avalanche L1 and learn how to use them.
                    </p>
                    <div className="inline-flex items-center gap-3">
                        <Link className={cn(buttonVariants())} href={`#Featured`}>Discover Integrations</Link>
                        <Link className={cn(buttonVariants({ variant: 'outline' }))} href="https://github.com/ava-labs/builders-hub/blob/master/content/integrations" target='_blank'>Add your Integration</Link>
                    </div>
                </div>
                <Integrations list={JSON.parse(JSON.stringify(list))}></Integrations>
            </div>
        </main>
    );
}

function Integrations({ list }: { list: any[] }) {
    let integrations: { [category: string]: any[] } = {};
    
    // Build categories and integrations
    list.forEach((integration) => {
        const { title, category, featured } = integration.data;
        if (title === 'README') {
            return;
        }
        if (!integrations[category]) {
            integrations[category] = [];
        }
        if (featured === true) {
            if (!integrations["Featured"]) {
                integrations["Featured"] = [];
            }
            integrations["Featured"].push(integration);
        }
        integrations[category].push(integration);
    });
    
    // Sort categories
    let categories = Object.keys(integrations);
    categories.sort((a, b) => {
        if (a === "Featured") {
            return -1;
        } else if (b === "Featured") {
            return 1;
        } else {
            return a.localeCompare(b);
        }
    });

    return (
        <div>
            <div className="flex flex-col md:flex-row md:space-x-12">
                <div className="w-full mb-12 md:w-1/5">
                    <div className="sticky top-0 pt-20">
                        <ul className="space-y-2">
                            {/* Render the categories on sidelist */}
                            {categories.map((category) => (
                                <li key={category} className='w-full'>
                                    <a href={`#${category}`} className="block w-full text-md leading-6 mb-4 rounded-md ring-1 ring-slate-900/10 dark:ring-slate-500 shadow-sm py-1.5 pl-2 pr-3 hover:ring-slate-300 dark:highlight-white/5 dark:hover:bg-slate-700 flex items-center justify-between cursor-pointer">
                                        <span>{category}</span>
                                        <div className='flex text-xs'>
                                            (
                                            <span>{integrations[category].length}</span>
                                            )
                                        </div>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="w-full md:w-4/5">
                    {/* Render the integrations for each category */}
                    {categories.map(category => (
                        <div key={category}>
                            <section id={category}>
                                <h2 className="text-2xl mb-8 pt-20">{category}</h2>
                            </section>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mx-auto w-full">
                                {integrations[category].map((integration) => (
                                    <Link
                                        key={integration.url}
                                        href={integration.url}
                                        className="flex flex-col bg-card p-4 rounded-lg transition-shadow shadow hover:shadow-lg dark:bg-card-dark dark:border dark:border-slate-500 dark:hover:bg-slate-700 w-auto h-auto gap-4"
                                    >
                                        <div className="flex items-center">
                                            <div className="w-8 h-8 mr-2 rounded-full overflow-hidden">
                                                <img
                                                    src={integration.data.logo}
                                                    alt={integration.data.title}
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                            <div>
                                                <h3 className="text-xl">{integration.data.title}</h3>
                                            </div>
                                        </div>

                                        <p className="text-sm text-gray-500 flex-grow">{integration.data.description}</p>

                                        {category !== "Featured" && integration.data.featured && <Pill item={{ text: "Featured" }} />}

                                        {category === "Featured" && integration.data.featured && <Pill item={{ text: integration.data.category }} />}

                                        {integration.data.available && integration.data.available.length > 0 && <div className="flex content-center flex-col gap-4">
                                            <p className="text-sm my-auto text-gray-500 mr-3">Available For: </p>
                                            <Pills items={integration.data.available.map((c: string) => { return { text: c } })} />
                                        </div>}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}