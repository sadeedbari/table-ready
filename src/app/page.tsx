import Link from "next/link";
import { CalendarClock, ListChecks, Armchair } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { buttonClass } from "@/components/ui/button-class";

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
      <footer className="mt-20 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-label-2">
        <span>© Sulo Systems</span>
        <Link href="/privacy" className="underline">Privacy</Link>
        <Link href="/terms" className="underline">Terms</Link>
      </footer>
    </main>
  );
}
