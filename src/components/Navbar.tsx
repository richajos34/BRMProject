"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  return (
    <nav className="w-full border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="text-2xl font-bold text-purple-600">
          ContractHub
        </Link>

        {/* Links */}
        <div className="hidden md:flex gap-8 text-sm font-medium">
          <Link href="/marketing/features" className="hover:text-purple-600">
            Features
          </Link>
          <Link href="/marketing/pricing" className="hover:text-purple-600">
            Pricing
          </Link>
          <Link href="/marketing/about" className="hover:text-purple-600">
            About
          </Link>
          <Link href="/marketing/contact" className="hover:text-purple-600">
            Contact
          </Link>
        </div>

        {/* Call to Action */}
        <div className="flex gap-3">
          <Link href="/signin">
            <Button variant="outline">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-purple-600 text-white hover:bg-purple-700">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}