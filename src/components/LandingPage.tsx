// src/components/LandingPage.tsx
"use client";

import Link from "next/link";
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Star, ArrowRight, Users, Calendar, FileText, Shield } from 'lucide-react';
import { cn } from "@/lib/utils";
import Image from "next/image";


const companyLogos = [
    'TechCorp', 'InnovateLabs', 'DataFlow', 'CloudSync', 'SecureVault',
    'FlowTech', 'NexusAI', 'VelocityPro', 'StreamWorks', 'PulseTech',
    'CoreSystems', 'BrightEdge', 'FlexiTech', 'RapidScale', 'FusionTech'
];

const testimonials = [
    {
        quote: "ContractHub reduced our contract renewal overhead by 85%. We never miss a deadline anymore.",
        author: "Sarah Chen", title: "Head of Procurement", company: "TechCorp", rating: 5
    },
    {
        quote: "The AI-powered analysis saved us $2.3M in the first year by catching unfavorable terms.",
        author: "Michael Rodriguez", title: "Legal Director", company: "InnovateLabs", rating: 5
    },
    {
        quote: "Finally, a solution that makes contract management feel effortless. Highly recommended.",
        author: "Emily Watson", title: "Operations Manager", company: "DataFlow Systems", rating: 5
    }
];

const features = [
    { icon: <Calendar className="w-6 h-6" />, title: "Smart Reminders", description: "Never miss a renewal deadline with AI-powered notifications" },
    { icon: <FileText className="w-6 h-6" />, title: "Document Analysis", description: "Automatically extract key terms from your contracts" },
    { icon: <Shield className="w-6 h-6" />, title: "Risk Assessment", description: "Identify potential risks and optimize contract terms" },
    { icon: <Users className="w-6 h-6" />, title: "Team Collaboration", description: "Keep your legal and procurement teams aligned" },
];

export function LandingPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">


            {/* Hero */}
            <section className="relative overflow-hidden pt-16 pb-32">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <svg className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full" viewBox="0 0 800 600">
                        <path d="M400 50 L350 150 L450 150 Z" stroke="currentColor" strokeWidth="1" fill="none" className="text-purple-600" />
                        <path d="M400 100 L300 250 L500 250 Z" stroke="currentColor" strokeWidth="1" fill="none" className="text-indigo-600" />
                        <path d="M400 150 L250 350 L550 350 Z" stroke="currentColor" strokeWidth="1" fill="none" className="text-purple-400" />
                        <path d="M400 200 L200 450 L600 450 Z" stroke="currentColor" strokeWidth="1" fill="none" className="text-indigo-400" />
                    </svg>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                    <div className="text-center">
                        <Badge className="mb-6 bg-purple-100 text-purple-800 hover:bg-purple-100">
                            ✨ AI-Powered Contract Management
                        </Badge>

                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                            Put your vendor
                            <br />
                            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                                contracts on autopilot
                            </span>
                        </h1>

                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                            ContractHub is an AI-powered procurement platform that automates the busy work of vendor management—
                            starting with contract management and renewal notifications.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                            <Link href="/signup">
                                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 py-3 text-lg">
                                    Get started free
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>
                            <Link href="/resources">
                                <Button variant="outline" size="lg" className="px-8 py-3 text-lg border-purple-200 hover:bg-purple-50">
                                    Watch demo
                                </Button>
                            </Link>
                        </div>

                        {/* Trusted by — BIG cards, slow rotating carousel */}
                        <div className="mb-16">
                            <p className="text-sm text-gray-500 mb-6">Trusted by leading companies</p>

                            <div className="relative overflow-hidden">
                                {/* gradient edges */}
                                <div className="pointer-events-none absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-white to-transparent z-10" />
                                <div className="pointer-events-none absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-white to-transparent z-10" />

                                <div className="flex gap-6 animate-marquee hover:[animation-play-state:paused]">
                                    {[...companyLogos, ...companyLogos].map((company, i) => (
                                        <div
                                            key={`${company}-${i}`}
                                            className={cn(
                                                "flex-shrink-0 w-[200px] h-[110px] rounded-2xl border border-gray-100 bg-white shadow-sm",
                                                "flex items-center justify-center text-center",
                                                "will-change-transform animate-rotate-slow"
                                            )}
                                        >
                                            <span className="text-gray-700 font-semibold">{company}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* CSS animations */}
                            <style jsx global>{`
                @keyframes marquee {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                  display: flex;
                  width: max-content;
                  animation: marquee 30s linear infinite;
                }
                @keyframes rotateSlow {
                  0% { transform: rotate(-1deg); }
                  50% { transform: rotate(1deg); }
                  100% { transform: rotate(-1deg); }
                }
                .animate-rotate-slow {
                  animation: rotateSlow 6s ease-in-out infinite;
                }
              `}</style>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">
                            See ContractHub in action
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            Get a comprehensive overview of all your contracts, deadlines, and renewals in one beautiful dashboard.
                        </p>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 rounded-2xl blur-3xl scale-105"></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden h-[420px] flex items-center justify-center">
                            <Image
                                src="/images/demo-dashboard.png"   // put your image in public/images
                                alt="ContractHub Demo Preview"
                                width={1200}
                                height={800}
                                className="object-cover w-full h-full"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-16 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need to manage contracts</h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            From automated reminders to AI-powered risk analysis, we've got your contract management covered.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((feature, index) => (
                            <Card key={index} className="text-center p-6 hover:shadow-lg transition-shadow">
                                <CardContent className="pt-6">
                                    <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4 text-purple-600">
                                        {feature.icon}
                                    </div>
                                    <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                                    <p className="text-gray-600 text-sm">{feature.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Loved by procurement teams everywhere</h2>
                        <p className="text-gray-600">See what our customers have to say</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {testimonials.map((t, index) => (
                            <Card key={index} className="p-6">
                                <CardContent className="pt-6">
                                    <div className="flex mb-4">
                                        {[...Array(t.rating)].map((_, i) => (
                                            <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                        ))}
                                    </div>
                                    <blockquote className="text-gray-600 mb-4 italic">"{t.quote}"</blockquote>
                                    <div>
                                        <div className="font-semibold text-gray-900">{t.author}</div>
                                        <div className="text-sm text-gray-500">{t.title}</div>
                                        <div className="text-sm text-purple-600">{t.company}</div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 bg-gradient-to-r from-purple-600 to-indigo-600">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">Ready to automate your contract management?</h2>
                    <p className="text-purple-100 mb-8 text-lg">Join thousands of companies that trust ContractHub with their vendor relationships.</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/signup">
                            <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-50 px-8 py-3 text-lg">
                                Start free trial
                            </Button>
                        </Link>
                        <Link href="/resources">
                            <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10 px-8 py-3 text-lg">
                                Schedule demo
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-300 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">CH</span>
                                </div>
                                <span className="text-xl font-semibold text-white">ContractHub</span>
                            </div>
                            <p className="text-gray-400 text-sm">AI-powered contract management for modern businesses.</p>
                        </div>

                        <div>
                            <h4 className="font-semibold text-white mb-4">Product</h4>
                            <ul className="space-y-2 text-sm">
                                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold text-white mb-4">Company</h4>
                            <ul className="space-y-2 text-sm">
                                <li><Link href="/customers" className="hover:text-white transition-colors">Customers</Link></li>
                                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                                <li><Link href="/resources" className="hover:text-white transition-colors">Blog</Link></li>
                                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold text-white mb-4">Support</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
                        <p className="text-gray-400 text-sm">© {new Date().getFullYear()} ContractHub. All rights reserved.</p>
                        <div className="flex gap-4 mt-4 sm:mt-0">
                            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy</a>
                            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Terms</a>
                            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Cookies</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}