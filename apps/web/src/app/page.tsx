"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Button } from "@se-project/ui/components/button";

const highlights = [
  {
    title: "Event timelines",
    description: "Plan, track, and complete event operations with full date visibility.",
    icon: CalendarClock,
  },
  {
    title: "Equipment control",
    description: "Manage inventory, categories, assignments, and status from one place.",
    icon: Wrench,
  },
  {
    title: "Team workflow",
    description: "Coordinate staff assignments and attendance across parallel events.",
    icon: Users,
  },
  {
    title: "Invoice and payments",
    description: "Generate invoices, record payments, and send client-ready documents quickly.",
    icon: CreditCard,
  },
  {
    title: "Secure role-based access",
    description: "Owner, event head, and staff permissions protect your day-to-day actions.",
    icon: ShieldCheck,
  },
];

const carouselSlides = [
  {
    title: "Smart workflows",
    description:
      "Use command palette and AI assistant to cut repetitive operations into single-click or single-command actions.",
  },
  {
    title: "Finance clarity",
    description:
      "Track pending invoices, payment entries, and event profitability with fast, role-based access to critical data.",
  },
  {
    title: "Execution readiness",
    description:
      "Keep teams, equipment, and vendors synchronized from planning to event-day execution without context switching.",
  },
];

const appFaqs: Array<{ question: string; answer: string }> = [
  {
    question: "What is EventFlow used for?",
    answer: "EventFlow helps teams manage events end-to-end, including staff, equipment, vendors, invoices, and payments.",
  },
  {
    question: "Who should use this app?",
    answer: "It is designed for event operations teams, event heads, and business owners who need clear operational tracking.",
  },
  {
    question: "Can multiple team members work together?",
    answer: "Yes. The app supports role-based access so different users can collaborate with controlled permissions.",
  },
  {
    question: "Does it support event planning and execution both?",
    answer: "Yes. You can plan schedules, assign resources, and track execution progress from one workflow.",
  },
  {
    question: "How are invoices and payments handled?",
    answer: "You can generate invoices, monitor due status, and record payments against events from the finance modules.",
  },
  {
    question: "Can I track equipment availability?",
    answer: "Yes. Equipment inventory, assignments, and availability checks are supported to reduce booking conflicts.",
  },
  {
    question: "Does EventFlow support vendors?",
    answer: "Yes. You can add and manage vendor records for services used across events.",
  },
  {
    question: "Is there an AI assistant in the app?",
    answer: "Yes. The assistant can interpret natural-language requests and prepare actions for your confirmation.",
  },
  {
    question: "Can the assistant process long multi-task queries?",
    answer: "Yes. It can split long requests into ordered actions and execute them step-by-step after confirmation.",
  },
  {
    question: "Is organization data isolated?",
    answer: "Yes. Data is scoped by organization and protected by authentication and role permissions.",
  },
  {
    question: "Where can I see business performance quickly?",
    answer: "Use dashboard and reports to view revenue, pending invoices, and operational activity at a glance.",
  },
  {
    question: "How do I get started quickly?",
    answer: "Sign in, create your first event, then add vendors, assign resources, and track invoice/payment flow.",
  },
];

function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    let start: number | null = null;

    const tick = (time: number) => {
      if (start === null) {
        start = time;
      }
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, target]);

  return value;
}

export default function Home() {
  const [activeSlide, setActiveSlide] = useState(0);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const parallaxX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), {
    stiffness: 130,
    damping: 24,
  });
  const parallaxY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-10, 10]), {
    stiffness: 130,
    damping: 24,
  });

  const activeEvents = useCountUp(12, 1200);
  const pendingInvoices = useCountUp(18, 1300);
  const monthlyRevenuePaise = useCountUp(128450000, 1600);

  const monthlyRevenue = useMemo(() => {
    return `₹${(monthlyRevenuePaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [monthlyRevenuePaise]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % carouselSlides.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setActiveSlide((current) => (current + 1) % carouselSlides.length);
  };

  const prevSlide = () => {
    setActiveSlide((current) => (current - 1 + carouselSlides.length) % carouselSlides.length);
  };

  return (
    <main
      className="relative min-h-svh overflow-hidden bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_94%,var(--primary)_6%),var(--background))] text-foreground"
      onMouseMove={(event) => {
        const x = event.clientX / window.innerWidth - 0.5;
        const y = event.clientY / window.innerHeight - 0.5;
        mouseX.set(x);
        mouseY.set(y);
      }}
    >
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-16 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 pb-16 pt-14 md:px-10 lg:pt-20">
        <header className="animate-fade-slide-up flex items-center justify-between">
          <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/70 px-4 py-2 backdrop-blur">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
              <CalendarClock className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">EventFlow</span>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" render={<Link href="/login" />}>
              Sign in
            </Button>
            <Button size="sm" render={<Link href="/dashboard" />}>
              Open app
            </Button>
          </div>
        </header>

        <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-7">
            <div className="surface-glow animate-fade-slide-up rounded-2xl border border-border/60 bg-card/70 p-5 text-xs font-medium text-muted-foreground backdrop-blur [animation-delay:90ms]">
              Built for event management teams who need operational clarity, not spreadsheet chaos.
            </div>

            <div className="space-y-6">
              <motion.h1
                className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl xl:text-6xl"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: {
                    transition: {
                      staggerChildren: 0.05,
                      delayChildren: 0.14,
                    },
                  },
                }}
              >
                {"Run every event workflow from one premium control center.".split(" ").map((word, index) => (
                  <motion.span
                    key={`${word}-${index}`}
                    className="mr-2 inline-block"
                    variants={{
                      hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
                      show: { opacity: 1, y: 0, filter: "blur(0px)" },
                    }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.h1>
              <motion.p
                className="max-w-2xl text-base text-muted-foreground md:text-lg"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                Coordinate events, staff, equipment, vendors, invoices, and payments with a modern interface designed for speed and confidence.
              </motion.p>
            </div>

            <div className="animate-fade-slide-up flex flex-wrap items-center gap-3 [animation-delay:280ms]">
              <Button size="lg" className="gap-2" render={<Link href="/login" />}>
                Get started
                <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/assistant" />}>
                Try AI Assistant
              </Button>
            </div>
          </div>

          <motion.div
            className="animate-fade-slide-up relative [animation-delay:340ms]"
            style={{ x: parallaxX, y: parallaxY }}
          >
            <div className="animate-float-y absolute -top-5 -right-5 h-20 w-20 rounded-2xl bg-primary/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-5 shadow-xl backdrop-blur">
              <p className="text-sm font-semibold">Live Operations Snapshot</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs text-muted-foreground">Active events</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{activeEvents}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs text-muted-foreground">Pending invoices</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{pendingInvoices}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/60 p-4 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">This month revenue</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{monthlyRevenue}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Synced from events + invoice records</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item, index) => (
            <article
              key={item.title}
              className="animate-fade-slide-up rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur"
              style={{ animationDelay: `${420 + index * 70}ms` }}
            >
              <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <item.icon className="size-4" />
              </div>
              <h2 className="text-sm font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>

        <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/65 p-5 backdrop-blur md:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" />
                Feature spotlight
              </p>
              <p className="mt-1 text-sm text-muted-foreground">A quick rotating view of what makes EventFlow fast.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" onClick={prevSlide}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={nextSlide}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.article
              key={activeSlide}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="rounded-2xl border border-border/60 bg-background/55 p-5"
            >
              <h3 className="text-xl font-bold tracking-tight">{carouselSlides[activeSlide]!.title}</h3>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
                {carouselSlides[activeSlide]!.description}
              </p>
            </motion.article>
          </AnimatePresence>

          <div className="mt-4 flex items-center justify-center gap-2">
            {carouselSlides.map((_, index) => (
              <button
                key={`dot-${index}`}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => setActiveSlide(index)}
                className={`h-2.5 rounded-full transition-all ${
                  index === activeSlide ? "w-8 bg-primary" : "w-2.5 bg-muted-foreground/40 hover:bg-muted-foreground/60"
                }`}
              />
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border/70 bg-card/65 p-5 backdrop-blur md:p-7">
          <div className="mb-4">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              FAQs
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">Frequently Asked Questions</h2>
            <p className="mt-1 text-sm text-muted-foreground">General answers about how EventFlow works across the whole app.</p>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {appFaqs.map((item) => (
              <details key={item.question} className="rounded-xl border border-border/60 bg-background/55 px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium text-foreground">{item.question}</summary>
                <p className="mt-2 text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
