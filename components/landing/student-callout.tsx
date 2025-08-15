import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GraduationCap, Mail } from 'lucide-react'
import Link from "next/link"

export default function StudentCallout() {
    return (
        <section className="p-4">
            <div className="max-w-7xl w-full mx-auto ">

                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 md:p-8">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        {/* Left side - Content */}
                        <div className="flex-1 text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <GraduationCap className="h-6 w-6 text-blue-600" />
                                </div>
                                <span className="text-sm font-medium text-blue-600 uppercase tracking-wide">
                                    For Students
                                </span>
                            </div>

                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                                Build the Future with Us
                            </h2>

                            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                                Join thousands of students learning to build on blockchain. Get exclusive access to
                                student resources, workshops, and opportunities to connect with the Avalanche Builder community.
                            </p>

                            <Link href="/students">
                                <Button
                                    size="lg"
                                    className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                                >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Join Student Mail List
                                </Button>
                            </Link>

                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
