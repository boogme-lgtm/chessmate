import { motion } from "framer-motion";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        className="border-b border-border/40"
      >
        <div className="container py-16">
          <h1 className="text-5xl md:text-6xl font-thin tracking-tighter">
            Terms of Service
          </h1>
          <p className="mt-4 text-lg font-light text-muted-foreground">
            Last updated: February 4, 2026
          </p>
        </div>
      </motion.header>

      {/* Content */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        className="container py-16 max-w-4xl"
      >
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Agreement to Terms</h2>
            <p className="font-light leading-relaxed">
              These Terms of Service ("Terms") govern your access to and use of BooGMe's marketplace platform connecting chess students with professional coaches. By accessing or using BooGMe, you agree to be bound by these Terms. If you do not agree, do not use the platform.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Eligibility</h2>
            <p className="font-light leading-relaxed">
              You must be at least 13 years old to use BooGMe. Users under 18 must have parental or guardian consent. By using the platform, you represent that you meet these requirements and have the authority to enter into these Terms.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Account Registration</h2>
            <p className="font-light leading-relaxed">
              You must create an account to access certain features. You agree to provide accurate, current information and maintain the security of your account credentials. You are responsible for all activities under your account. Notify us immediately of any unauthorized access.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Platform Services</h2>
            
            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">For Students</h3>
            <p className="font-light leading-relaxed">
              BooGMe provides tools to discover coaches, view profiles, book lessons, and process payments. We facilitate connections but do not employ coaches or guarantee lesson quality. Students are responsible for evaluating coaches and communicating their learning goals.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">For Coaches</h3>
            <p className="font-light leading-relaxed">
              Coaches may create profiles, set pricing, manage availability, and accept bookings. Coaches are independent contractors, not BooGMe employees. Coaches are responsible for delivering lessons as promised, maintaining professional conduct, and complying with applicable laws.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Coach Vetting and Approval</h2>
            <p className="font-light leading-relaxed">
              All coaches undergo an application process including AI-powered vetting and, when necessary, human review. We verify credentials and assess teaching competence, but do not guarantee coach quality or lesson outcomes. Approval may be revoked if coaches violate these Terms or engage in misconduct.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Booking and Payments</h2>
            
            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Lesson Booking</h3>
            <p className="font-light leading-relaxed">
              Students book lessons by selecting a coach, date, and time, then completing payment. Bookings are confirmed once payment is processed. Students and coaches must coordinate lesson delivery details (video platform, materials, etc.).
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Payment Processing</h3>
            <p className="font-light leading-relaxed">
              Payments are processed through Stripe. Students pay the full lesson fee upfront. BooGMe holds funds in escrow until the lesson is completed. After lesson completion, funds are released to the coach minus platform fees. Platform fees vary based on coach membership tier and are deducted automatically.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Platform Fees</h3>
            <p className="font-light leading-relaxed">
              BooGMe charges minimal platform fees on completed transactions to cover payment processing, platform maintenance, and support services. Fee rates depend on coach membership tier and are disclosed during coach onboarding. Students pay the displayed lesson price; fees are deducted from coach earnings.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Taxes</h3>
            <p className="font-light leading-relaxed">
              Coaches are responsible for all taxes related to their earnings, including income tax and self-employment tax. BooGMe may provide tax documentation (e.g., 1099 forms for U.S. coaches) as required by law. Students are responsible for any applicable sales or use taxes in their jurisdiction.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Cancellations and Refunds</h2>
            
            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Student Cancellations</h3>
            <p className="font-light leading-relaxed">
              Students may cancel lessons up to 24 hours before the scheduled start time for a full refund. Cancellations within 24 hours are non-refundable unless the coach agrees otherwise. No-shows (student fails to attend without notice) are non-refundable.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Coach Cancellations</h3>
            <p className="font-light leading-relaxed">
              If a coach cancels a confirmed lesson, the student receives a full refund. Repeated cancellations may result in coach account suspension. Coaches should communicate schedule changes promptly.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Disputes</h3>
            <p className="font-light leading-relaxed">
              If a lesson is not delivered as agreed, students may request a refund within 48 hours by contacting support with details. BooGMe will investigate and mediate disputes. Our decision is final. Refunds are issued at our discretion based on evidence provided.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">User Conduct</h2>
            <p className="font-light leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="space-y-3 font-light leading-relaxed">
              <li>Provide false or misleading information (especially coach credentials)</li>
              <li>Engage in harassment, discrimination, or abusive behavior</li>
              <li>Circumvent the platform to avoid fees (e.g., arranging off-platform payments)</li>
              <li>Share account credentials or allow unauthorized access</li>
              <li>Use automated tools (bots, scrapers) to access the platform</li>
              <li>Interfere with platform operations or security</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights</li>
            </ul>
            <p className="font-light leading-relaxed mt-4">
              Violations may result in account suspension or termination without refund.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Intellectual Property</h2>
            <p className="font-light leading-relaxed">
              BooGMe owns all rights to the platform, including design, code, trademarks, and content we create. User-generated content (profiles, bios, photos) remains owned by the user, but you grant BooGMe a license to display, distribute, and promote such content on the platform. Coaches retain ownership of lesson materials but grant students a personal, non-transferable license to use materials for learning purposes.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Disclaimers</h2>
            <p className="font-light leading-relaxed">
              BooGMe is provided "as is" without warranties of any kind. We do not guarantee uninterrupted access, error-free operation, or specific outcomes from lessons. We are not responsible for coach conduct, lesson quality, or disputes between users. Students assume all risks associated with selecting and working with coaches.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Limitation of Liability</h2>
            <p className="font-light leading-relaxed">
              To the maximum extent permitted by law, BooGMe and its affiliates are not liable for indirect, incidental, consequential, or punitive damages arising from platform use. Our total liability for any claim is limited to the amount you paid to BooGMe in the 12 months preceding the claim, or $100, whichever is greater.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Indemnification</h2>
            <p className="font-light leading-relaxed">
              You agree to indemnify and hold BooGMe harmless from any claims, damages, or expenses (including legal fees) arising from your use of the platform, violation of these Terms, or infringement of third-party rights.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Termination</h2>
            <p className="font-light leading-relaxed">
              You may terminate your account at any time through account settings. We may suspend or terminate your account for Terms violations, fraudulent activity, or at our discretion. Upon termination, your right to use the platform ceases immediately. Provisions regarding payment obligations, disputes, and liability survive termination.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Dispute Resolution</h2>
            
            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Informal Resolution</h3>
            <p className="font-light leading-relaxed">
              Before pursuing formal action, contact us at support@boogme.com to resolve disputes informally. We will attempt to resolve within 30 days.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Arbitration</h3>
            <p className="font-light leading-relaxed">
              If informal resolution fails, disputes will be resolved through binding arbitration under the rules of the American Arbitration Association. Arbitration will be conducted remotely unless both parties agree otherwise. You waive the right to participate in class actions or jury trials.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Governing Law</h3>
            <p className="font-light leading-relaxed">
              These Terms are governed by the laws of [Your State/Country], without regard to conflict of law principles.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Changes to Terms</h2>
            <p className="font-light leading-relaxed">
              We may update these Terms from time to time. We will notify you of material changes by email or prominent notice on the platform. Continued use after changes constitutes acceptance of the updated Terms. If you do not agree, you must stop using the platform.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Severability</h2>
            <p className="font-light leading-relaxed">
              If any provision of these Terms is found unenforceable, the remaining provisions remain in full effect. Unenforceable provisions will be modified to reflect the parties' intent to the extent permitted by law.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Entire Agreement</h2>
            <p className="font-light leading-relaxed">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and BooGMe regarding platform use and supersede all prior agreements.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Contact Us</h2>
            <p className="font-light leading-relaxed">
              If you have questions about these Terms, contact us at:
            </p>
            <p className="font-light leading-relaxed mt-4">
              Email: legal@boogme.com<br />
              Address: BooGMe Inc., [Your Business Address]
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
