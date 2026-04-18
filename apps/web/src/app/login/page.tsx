"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export default function LoginPage() {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <div className="relative flex min-h-svh bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_95%,var(--primary)_5%),var(--background))]">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-linear-to-br from-primary/90 via-secondary/80 to-accent/70">
        {/* Aurora overlay effect */}
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.65_0.15_150)_0%,transparent_50%)] opacity-60"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,oklch(0.67_0.14_261)_0%,transparent_50%)] opacity-50"
          animate={{ opacity: [0.3, 0.55, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.83_0.11_212)_0%,transparent_40%)] opacity-30"
          animate={{ scale: [1, 1.07, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Content */}
        <motion.div
          className="relative z-10 flex flex-col justify-between p-12 text-white"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5"
                >
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight">EventFlow</span>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
              Manage events
              <br />
              with clarity.
            </h1>
            <p className="max-w-md text-lg text-white/80 leading-relaxed">
              Equipment, staff, invoices, and vendors — all in one place.
              Built for event management companies that need to stay organised.
            </p>
          </div>

          <p className="text-sm text-white/50">
            EventFlow &middot; Event Management System
          </p>
        </motion.div>
      </div>

      {/* Right panel - Auth form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">EventFlow</span>
          </div>

          <AnimatePresence mode="wait">
            {showSignIn ? (
              <motion.div
                key="signin"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
              </motion.div>
            ) : (
              <motion.div
                key="signup"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
