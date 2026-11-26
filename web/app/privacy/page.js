/**
 * The privacy policy, for the Google Play listing and the app.
 *
 * Public: it opens without signing in, on any phone. Written in plain
 * words, and only about what the app really collects and does.
 */
export const metadata = {
  title: 'Privacy policy - Al Hadeed Hardware',
  description: 'What the Al Hadeed Hardware app collects, why, who sees it, and how to delete it.',
};

const Section = ({ title, children }) => (
  <section className="mt-6">
    <h2 className="text-[15px] font-bold text-ink">{title}</h2>
    <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
  </section>
);

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <p className="text-[12px] font-semibold text-brand-dark">Al Hadeed Hardware, Kampala</p>
      <h1 className="mt-1 text-[24px] leading-tight text-ink">Privacy policy</h1>
      <p className="mt-2 text-[12.5px] text-ink-muted">Last updated 26 November 2026</p>

      <Section title="Who we are">
        <p>
          Al Hadeed Hardware is a steel and hardware shop in Kampala, Uganda. This policy covers the
          Al Hadeed Hardware phone app and this website. You can ask us anything about it at the shop
          counter.
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><b>Your name and phone number</b>, to make your account and to send your order number by SMS.</li>
          <li><b>Your email</b>, only if you give it.</li>
          <li><b>Where to deliver</b>, when you ask us to deliver.</li>
          <li><b>Your orders and payments</b>: what you bought, the amount, how you paid, and the receipt. If you send a payment screenshot, we keep it with the receipt.</li>
          <li><b>A push notification ID</b> for your phone, so we can tell you when your order is paid, ready or delivered. You can turn notifications off in your phone settings.</li>
        </ul>
        <p>We do not collect your location, contacts, photos or anything else on your phone.</p>
      </Section>

      <Section title="Why we use it">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>To take, prepare and deliver your order.</li>
          <li>To tell you about your order by SMS and push notification.</li>
          <li>To keep the shop&apos;s accounts and tax records correct.</li>
        </ul>
        <p>We do not sell your information. We do not use it for adverts.</p>
      </Section>

      <Section title="Who else sees it">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><b>Our staff</b> at the cashier, accounts and store, to serve your order.</li>
          <li><b>EgoSMS</b>, which sends our text messages. It gets your phone number and the message.</li>
          <li><b>OneSignal</b>, which sends our push notifications. It gets your phone&apos;s notification ID and the message.</li>
          <li><b>Our web host</b>, where the shop&apos;s system runs.</li>
        </ul>
        <p>Nobody else, unless the law of Uganda requires it.</p>
      </Section>

      <Section title="How we keep it safe">
        <p>
          Everything travels over a secure (HTTPS) connection. Only signed-in staff can see orders,
          and each desk sees only what it needs. Every change is recorded.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Your account stays until you delete it. Orders and receipts are kept as long as the law asks
          shops to keep their accounts, but without your name once your account is deleted.
        </p>
      </Section>

      <Section title="Delete your account">
        <p>
          In the app: <b>Account</b>, then <b>Delete account</b>. Or on the web at{' '}
          <a href="/delete-account" className="font-semibold text-brand-dark underline">Delete your account</a>.
          Your name, phone number, email and addresses are removed at once.
        </p>
      </Section>

      <Section title="Children">
        <p>The app is for adults buying building materials. It is not made for children under 13.</p>
      </Section>

      <Section title="Changes">
        <p>If we change this policy, we will update this page and the date at the top.</p>
      </Section>
    </main>
  );
}
