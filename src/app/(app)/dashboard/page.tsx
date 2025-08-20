

"use client";

import Image from "next/image";
import { Dashboard } from "@/components/Dashboard";
import AppShell  from "@/components/AppShell";
import { Calendar } from "@/components/Calendar";
import { Documents } from "@/components/Documents";
import { Settings } from "@/components/Settings";
import {AgreementDrawer} from "@/components/AgreementDrawer";

export default function Home() {
  return (
      <Dashboard />
  );
}
