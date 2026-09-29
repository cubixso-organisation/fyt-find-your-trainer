# Product

## Register

product

The mobile app (Flutter) is where students and corporate employees discover and book. The operator console (`apps/admin`, admin.<domain>) is product register: every task on it serves an operator in the middle of work.

## Users

**Students and corporate employees** in Hyderabad browse institutes, courses, trainers, mentors and consultants, and book demo, mentorship and consultation slots. They never see the console.

**Operators** run the marketplace from the console:

- **Admins (staff)** do today's work. They confirm and reschedule bookings, chase failed Meet links, keep listings accurate, and set availability for trainers who do not log in. What they can see is limited by per-module permissions.
- **Super admins** run the operation. They manage the admin team and its permissions, platform configuration (categories, tech stacks, home feed), broadcasts and the audit log.
- **The owner** is the client. They hold every permission and cannot be demoted by anyone. Only the owner can manage super admins, transfer ownership, and use the danger zone (force sign-out of all admins, maintenance mode). The owner's question is "is the platform working": registrations, bookings, conversion, and which listings pull demand.

## Product Purpose

A single place where the Hyderabad training ecosystem is found and booked. On mobile, success is a booked demo with a working Meet link. In the console, success is an operator who knows what needs action now, and an owner who can see the trend without exporting anything.

## Brand Personality

Credible, local, organised. In the console the tone is calm, exact and quick: the tool should feel like a well-run front desk, not a startup pitch.

## Anti-references

- The purple/violet "AI SaaS" look, and neon gradients.
- Claymorphism or playful, toy-like education UI. Operators are adults working a queue.
- Spreadsheet walls of numbers with no hierarchy or comparison.
- Invented numbers. Every figure comes from real bookings and users; an empty state says why it is empty.
- Fake social proof (testimonials, "10,000+ learners") anywhere in the console, including the sign-in screen.

## Design Principles

1. **Answer the page's question first.** Overview answers "what needs action now". Analytics answers "how is the platform doing".
2. **Honest numbers.** Every figure comes from data; comparisons use the previous period; no placeholder deltas.
3. **Permission is visible.** An operator always knows what role they hold and why something is locked, instead of finding a missing button.
4. **Quiet at rest, exact on demand.** The resting view stays calm; hover and focus reveal precise values and timestamps.
5. **Every destructive action is reversible or confirmed and audited.**
