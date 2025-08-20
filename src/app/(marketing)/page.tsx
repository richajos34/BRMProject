"use client";
import {LandingPage} from "@/components/LandingPage";

export default function SettingsPage() {
  return < LandingPage onGetStarted={function (): void {
      throw new Error("Function not implemented.");
  } } onSignIn={function (): void {
      throw new Error("Function not implemented.");
  } }/>;
}