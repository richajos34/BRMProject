"use client";

import {LandingPage} from "@/components/LandingPage";

/**
 * SettingsPage component
 *
 * @returns {JSX.Element} A wrapper around the LandingPage component
 */
export default function LandingPageComp() {
  return < LandingPage onGetStarted={function (): void {
      throw new Error("Function not implemented.");
  } } onSignIn={function (): void {
      throw new Error("Function not implemented.");
  } }/>;
}