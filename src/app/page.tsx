import Link from "next/link";
import { CalendarClock, ListChecks, Armchair } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { buttonClass } from "@/components/ui/button-class";
import { FREE_MONTHLY_LIMIT, PRO_PRICE_CAD, TRIAL_DAYS } from "@/lib/plan";

const POINTS = [
  { icon: Armchair, title: "You choose what is online", body: "Add your tables and seat counts, then switch each one on or off for online guests. Keep the bar and the patio for walk-ins." },
  { icon: CalendarClock, title: "Hours that match your service", body: "Lunch, dinner, a late brunch on Sundays. Set opening windows by weekday, a last seating, and how long each party size keeps its table." },
  { icon: ListChecks, title: "A waitlist for full nights", body: "When a time is taken, guests join the waitlist for a window. The moment a table opens, they are told and can book it." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24">
      <header className="flex items-center justify-between py-6">
        <Logo className="text-[20px]" />
        <nav className="flex items-center gap-2">
          <Link href="/login" className={buttonClass("plain", "md")}>Sign in</Link>
          <Link href="/signup" className={buttonClass("filled", "md", true)}>Get started</Link>
        </nav>
      </header>
      <section className="pt-14 pb-16 sm:pt-24">
        <h1 className="max-w-3xl text-[40px] leading-[1.05] sm:text-[64px]">Fill every table, without the phone tag.</h1>
        <p className="mt-6 max-w-xl text-[18px] text-label-2">
          Table Ready gives your restaurant an online reservation page and a waitlist. Set how many tables and seats are open to
          guests online, and the rest stays yours.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonClass("filled", "lg", true)}>Set up your restaurant</Link>
          <Link href="/login" className={buttonClass("gray", "lg", true)}>Sign in</Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-[20px] bg-surface p-6 shadow-sm hairline">
            <div className="mb-4 grid size-11 place-items-center rounded-[14px] bg-accent-soft text-accent-text"><Icon className="size-5" aria-hidden /></div>
            <h2 className="text-[20px]">{title}</h2>
            <p className="mt-2 text-[15px] text-label-2">{body}</p>
          </div>
        ))}
      </section>
      <section id="pricing" className="mt-20" aria-labelledby="pricing-heading">
        <h2 id="pricing-heading" className="text-[32px] sm:text-[40px]">Simple pricing</h2>
        <p className="mt-2 max-w-xl text-[16px] text-label-2">Start with {TRIAL_DAYS} days of Pro, no card needed. After that, stay on Free or keep Pro. Cancel any time.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[20px] bg-surface p-6 shadow-sm hairline">
            <h3 className="text-[22px]">Free</h3>
            <p className="mt-1 text-[32px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>$0</p>
            <ul className="mt-4 space-y-2 text-[15px] text-label-2">
              <li>{FREE_MONTHLY_LIMIT} reservations a month</li>
              <li>Walk-in line, waitlist and alerts</li>
              <li>Installable app for your staff</li>
              <li>&ldquo;Powered by Table Ready&rdquo; on guest pages</li>
            </ul>
          </div>
          <div className="rounded-[20px] bg-surface p-6 shadow-sm ring-2 ring-accent-fill">
            <h3 className="text-[22px]">Pro</h3>
            <p className="mt-1 text-[32px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>${PRO_PRICE_CAD} <span className="text-[15px] font-normal text-label-2">CAD / month</span></p>
            <ul className="mt-4 space-y-2 text-[15px] text-label-2">
              <li>Unlimited reservations</li>
              <li>Download your guest list (CSV)</li>
              <li>No Table Ready branding on guest pages</li>
              <li>Everything in Free</li>
            </ul>
          </div>
        </div>
        <div className="mt-6"><Link href="/signup" className={buttonClass("filled", "lg", true)}>Start your {TRIAL_DAYS}-day trial</Link></div>
      </section>
      <footer className="mt-20 flex flex-wrap items-center gap-x-4 text-[13px] text-label-2">
        <span className="py-2">© Sulo Systems</span>
        <Link href="/privacy" className="inline-flex min-h-11 items-center px-1 underline">Privacy</Link>
        <Link href="/terms" className="inline-flex min-h-11 items-center px-1 underline">Terms</Link>
        <span className="py-2">
          Designed and built by{" "}
          <a href="https://sulosystems.com" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center px-1 font-medium underline">sulosystems.com</a>
        </span>
      </footer>
    </main>
  );
}
