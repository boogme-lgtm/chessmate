import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
};

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Back to Home */}
      <div className="border-b border-white/[0.06]">
        <div className="container py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Header */}
      <motion.header
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        className="border-b border-border/40"
      >
        <div className="container py-16">
          <h1 className="text-5xl md:text-6xl font-thin tracking-tighter">
            Privacy Policy
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
            <h2 className="text-3xl font-thin tracking-tight mb-4">Introduction</h2>
            <p className="font-light leading-relaxed">
              BooGMe ("we," "our," or "us") operates a marketplace connecting chess students with professional coaches. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. By accessing or using BooGMe, you agree to this Privacy Policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Information We Collect</h2>
            
            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Account Information</h3>
            <p className="font-light leading-relaxed">
              When you create an account, we collect your name, email address, and authentication credentials through our OAuth provider. Coaches additionally provide chess credentials (title, rating, usernames), professional background, teaching experience, and payment information through Stripe Connect.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Profile Information</h3>
            <p className="font-light leading-relaxed">
              Students may provide chess skill level, rating, learning goals, and preferences through our matching questionnaire. Coaches provide professional bios, specializations, availability schedules, pricing, and optional profile photos or video introductions.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Payment Information</h3>
            <p className="font-light leading-relaxed">
              Payment card details are collected and processed by Stripe, our payment processor. We do not store full credit card numbers on our servers. We retain transaction records including amounts, dates, and payment status for accounting and dispute resolution purposes.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Usage Data</h3>
            <p className="font-light leading-relaxed">
              We automatically collect information about your interactions with the platform, including pages viewed, features used, search queries, booking history, and device information (IP address, browser type, operating system).
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Communications</h3>
            <p className="font-light leading-relaxed">
              We collect messages exchanged through our platform between students and coaches, including booking requests, lesson notes, and support inquiries.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">How We Use Your Information</h2>
            <ul className="space-y-3 font-light leading-relaxed">
              <li><strong>Provide Services:</strong> Facilitate coach-student matching, process bookings, handle payments, and enable lesson delivery</li>
              <li><strong>Improve Platform:</strong> Analyze usage patterns to enhance features, optimize matching algorithms, and improve user experience</li>
              <li><strong>Communications:</strong> Send booking confirmations, lesson reminders, platform updates, and respond to support requests</li>
              <li><strong>Safety & Security:</strong> Verify coach credentials, detect fraud, prevent abuse, and resolve disputes</li>
              <li><strong>Legal Compliance:</strong> Comply with applicable laws, regulations, and legal processes</li>
              <li><strong>Marketing:</strong> Send promotional communications about new features or coaches (you may opt out anytime)</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Information Sharing</h2>
            
            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">With Other Users</h3>
            <p className="font-light leading-relaxed">
              Coach profiles (name, photo, bio, credentials, specializations, pricing) are visible to all platform users. Student information is only shared with coaches after a booking is confirmed. Booking details (date, time, lesson type) are shared between matched students and coaches.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">With Service Providers</h3>
            <p className="font-light leading-relaxed">
              We share information with trusted third-party service providers who assist in operating our platform: Stripe (payment processing), cloud hosting providers (data storage), email service providers (transactional emails), and analytics providers (usage insights).
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">For Legal Reasons</h3>
            <p className="font-light leading-relaxed">
              We may disclose information if required by law, court order, or government request, or to protect our rights, property, or safety, or that of our users or the public.
            </p>

            <h3 className="text-2xl font-thin tracking-tight mt-6 mb-3">Business Transfers</h3>
            <p className="font-light leading-relaxed">
              In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Data Security</h2>
            <p className="font-light leading-relaxed">
              We implement industry-standard security measures to protect your information, including encryption in transit (TLS/SSL), secure authentication, regular security audits, and restricted access controls. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Data Retention</h2>
            <p className="font-light leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide services. After account deletion, we retain transaction records for 7 years for tax and legal compliance, and anonymized usage data indefinitely for analytics purposes.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Your Rights</h2>
            <p className="font-light leading-relaxed mb-4">
              Depending on your location, you may have the following rights regarding your personal information:
            </p>
            <ul className="space-y-3 font-light leading-relaxed">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information through your account settings</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data (subject to legal retention requirements)</li>
              <li><strong>Portability:</strong> Request a machine-readable copy of your data</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing emails or disable certain data collection features</li>
              <li><strong>Object:</strong> Object to certain processing activities, such as direct marketing</li>
            </ul>
            <p className="font-light leading-relaxed mt-4">
              To exercise these rights, contact us at privacy@boogme.com.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Cookies and Tracking</h2>
            <p className="font-light leading-relaxed">
              We use cookies and similar technologies to maintain your session, remember your preferences, and analyze platform usage. Essential cookies are required for the platform to function. You can control non-essential cookies through your browser settings, though this may affect platform functionality.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Children's Privacy</h2>
            <p className="font-light leading-relaxed">
              Our platform is not intended for children under 13. We do not knowingly collect information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">International Users</h2>
            <p className="font-light leading-relaxed">
              BooGMe operates globally. Your information may be transferred to and processed in countries other than your own, including the United States. By using our platform, you consent to such transfers. We ensure appropriate safeguards are in place for international data transfers.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Changes to This Policy</h2>
            <p className="font-light leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes by email or prominent notice on the platform. Continued use after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-thin tracking-tight mb-4">Contact Us</h2>
            <p className="font-light leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, contact us at:
            </p>
            <p className="font-light leading-relaxed mt-4">
              Email: privacy@boogme.com<br />
              Address: BooGMe Inc., [Your Business Address]
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
