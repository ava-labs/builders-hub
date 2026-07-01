import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ExternalLink } from "lucide-react";
import { MiniGrantApplications } from "@/components/grants/MiniGrantApplications";

export default function Team1MiniGrantsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <main className="relative container mx-auto px-4 py-12 space-y-12">
        <section className="text-center space-y-8 pt-8 pb-12">
          {/* SEO: keep the program name in an accessible heading behind the banner image */}
          <h1 className="sr-only">Team1 Mini Grants</h1>
          <div className="space-y-6">
            <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl shadow-slate-900/20">
              <Image
                src="/grants/team1-mini-grants-banner.webp"
                alt="Team1 Mini Grants"
                width={2560}
                height={1093}
                priority
                className="w-full h-auto"
              />
            </div>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Fast, focused funding for builders on Avalanche. A Team1 program designed to support innovative projects and accelerate growth in the ecosystem.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
            <Link
              href="/grants/team1-mini-grants/apply"
              className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold tracking-[-0.015em] rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-xl shadow-red-500/30 hover:shadow-2xl hover:shadow-red-500/50 hover:scale-[1.02] transition-all duration-300"
            >
              Apply Now
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="https://team1.network/grants"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold tracking-[-0.015em] rounded-xl bg-white/10 backdrop-blur-sm border border-slate-200/30 text-slate-900 dark:text-white hover:bg-white/20 hover:scale-[1.02] transition-all duration-300 dark:border-slate-700/40"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Learn More
            </a>
          </div>
        </section>

        {/* Program Information */}
        <section className="max-w-3xl mx-auto">
          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
                About This Program
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Team1 Mini Grants provides fast, focused funding for builders creating innovative solutions on Avalanche. Whether you're developing smart contracts, building applications, or contributing to the ecosystem, this program is designed to support your vision and help you bring your ideas to life.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">
                Ready to Apply?
              </h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Click the "Apply Now" button above to start your application. For more information about the program, visit the{" "}
                <a
                  href="https://team1.network/grants"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-red-600 underline-offset-4 hover:underline dark:text-red-400"
                >
                  Team1 Grants Website
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        <MiniGrantApplications />
      </main>
    </div>
  );
}
