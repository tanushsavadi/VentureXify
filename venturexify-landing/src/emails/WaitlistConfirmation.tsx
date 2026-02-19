import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Section,
  Hr,
  Link,
  Row,
  Column,
} from '@react-email/components';
import * as React from 'react';

interface WaitlistConfirmationEmailProps {
  email: string;
  position: number;
  source?: string;
}

export const WaitlistConfirmationEmail: React.FC<Readonly<WaitlistConfirmationEmailProps>> = ({
  email,
  position,
  source = 'hero',
}) => {
  const previewText = `You're #${position} on the VentureXify waitlist! 🎉`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={logoSection}>
            <Text style={logoText}>
              <span style={logoV}>V</span>entureXify
            </Text>
            <Text style={logoTagline}>Smart Points. Smarter Travel.</Text>
          </Section>

          {/* Decorative separator */}
          <Section style={accentDividerSection}>
            <Hr style={accentDivider} />
          </Section>

          {/* Position Badge */}
          <Section style={badgeSection}>
            <table
              cellPadding="0"
              cellSpacing="0"
              style={positionBadgeTable}
            >
              <tr>
                <td style={positionBadgeTd}>
                  <Text style={positionLabel}>YOUR POSITION</Text>
                  <Text style={positionNumber}>#{position}</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Main Content */}
          <Heading style={h1}>You&apos;re on the list! 🎉</Heading>

          <Text style={paragraph}>
            Thanks for joining the VentureXify waitlist. You&apos;re one step closer to
            maximizing the value of your Capital One Venture X card.
          </Text>

          <Text style={paragraph}>
            We&apos;re building something special — a Chrome extension that uses AI to
            help you make smarter decisions about when to use points vs. cash for
            travel bookings.
          </Text>

          {/* Decorative separator */}
          <Section style={accentDividerSection}>
            <Hr style={subtleDivider} />
          </Section>

          {/* What's Coming Section */}
          <Section style={featuresSection}>
            <Text style={sectionTitle}>✦ What&apos;s Coming ✦</Text>

            <Row>
              <Column style={featureColumn}>
                <Text style={featureIcon}>🔍</Text>
                <Text style={featureTitle}>Smart Analysis</Text>
                <Text style={featureDesc}>
                  Real-time analysis of your bookings to find the best redemption value
                </Text>
              </Column>
              <Column style={featureColumn}>
                <Text style={featureIcon}>💰</Text>
                <Text style={featureTitle}>Transfer Partners</Text>
                <Text style={featureDesc}>
                  Discover hidden value through airline &amp; hotel transfer partners
                </Text>
              </Column>
              <Column style={featureColumn}>
                <Text style={featureIcon}>⚡</Text>
                <Text style={featureTitle}>Instant Verdicts</Text>
                <Text style={featureDesc}>
                  Know immediately whether to pay with points or cash
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Decorative separator */}
          <Section style={accentDividerSection}>
            <Hr style={subtleDivider} />
          </Section>

          {/* Early Access Perks */}
          <Section style={perksSection}>
            <Text style={sectionTitle}>✦ Your Early Access Perks ✦</Text>

            <Text style={perkText}>
              <span style={perkCheck}>✓</span> First to access the beta launch
            </Text>
            <Text style={perkText}>
              <span style={perkCheck}>✓</span> Exclusive founding member features
            </Text>
            <Text style={perkText}>
              <span style={perkCheck}>✓</span> Direct line to share feedback &amp; shape the product
            </Text>
            <Text style={perkText}>
              <span style={perkCheck}>✓</span> Potential early-bird pricing benefits
            </Text>
          </Section>

          {/* Decorative separator */}
          <Section style={accentDividerSection}>
            <Hr style={subtleDivider} />
          </Section>

          {/* Social Section */}
          <Section style={socialSection}>
            <Text style={socialHeading}>Spread the Word</Text>
            <Text style={socialText}>
              Help others maximize their Venture X!
            </Text>
            <table
              cellPadding="0"
              cellSpacing="0"
              role="presentation"
              style={socialButtonsTable}
            >
              <tr>
                <td align="center" style={socialButtonsOuterTd}>
                  <table
                    cellPadding="0"
                    cellSpacing="0"
                    role="presentation"
                    style={socialButtonsInnerTable}
                  >
                    {/* Row 1: X | LinkedIn */}
                    <tr>
                      <td style={socialButtonTd}>
                        <Link
                          href="https://twitter.com/intent/tweet?text=Just%20joined%20the%20%40VentureXify%20waitlist%21%20Can%27t%20wait%20to%20maximize%20my%20Capital%20One%20Venture%20X%20points%20with%20AI.%20%23VentureX%20%23TravelHacking&url=https://venturexify.vercel.app"
                          style={socialButtonLink}
                        >
                          𝕏 Share on X
                        </Link>
                      </td>
                      <td style={socialButtonGap}>&nbsp;</td>
                      <td style={socialButtonTd}>
                        <Link
                          href="https://www.linkedin.com/sharing/share-offsite/?url=https://venturexify.vercel.app"
                          style={socialButtonLink}
                        >
                          in Share on LinkedIn
                        </Link>
                      </td>
                    </tr>
                    {/* Row gap */}
                    <tr>
                      <td colSpan={3} style={socialRowGap}>&nbsp;</td>
                    </tr>
                    {/* Row 2: r/VentureX | WhatsApp */}
                    <tr>
                      <td style={socialButtonTd}>
                        <Link
                          href="https://www.reddit.com/r/VentureX/submit?selftext=true&title=Just%20joined%20the%20VentureXify%20waitlist%20-%20AI%20Chrome%20extension%20for%20Venture%20X%20cardholders&text=Found%20this%20cool%20tool%20called%20VentureXify%20that%20helps%20maximize%20Capital%20One%20Venture%20X%20points.%20It%20uses%20AI%20to%20tell%20you%20when%20to%20use%20points%20vs%20cash%20and%20finds%20transfer%20partner%20sweet%20spots.%0A%0Ahttps%3A%2F%2Fventurexify.vercel.app"
                          style={socialButtonLink}
                        >
                          📣 r/VentureX
                        </Link>
                      </td>
                      <td style={socialButtonGap}>&nbsp;</td>
                      <td style={socialButtonTd}>
                        <Link
                          href="https://api.whatsapp.com/send?text=Check%20out%20VentureXify%20-%20an%20AI%20Chrome%20extension%20that%20helps%20you%20maximize%20Capital%20One%20Venture%20X%20points!%20https%3A%2F%2Fventurexify.vercel.app"
                          style={socialButtonLink}
                        >
                          💬 WhatsApp
                        </Link>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={footerDivider} />
            <Text style={footerText}>
              This email was sent to {email} because you signed up for the VentureXify waitlist.
            </Text>
            <Text style={footerDisclaimer}>
              VentureXify is not affiliated with Capital One. Venture X is a trademark of Capital One.
            </Text>
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} VentureXify. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

/* ─── Styles ────────────────────────────────────────────────────────── */

const main: React.CSSProperties = {
  backgroundColor: '#0a0a0a',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container: React.CSSProperties = {
  margin: '0 auto',
  padding: '48px 24px',
  width: '600px',
};

/* ── Logo ────────────────────────────────────────────────────────── */

const logoSection: React.CSSProperties = {
  textAlign: 'center',
  paddingBottom: '8px',
};

const logoText: React.CSSProperties = {
  fontSize: '30px',
  fontWeight: '700',
  color: '#ffffff',
  margin: '0',
  letterSpacing: '-0.5px',
  textAlign: 'center',
};

const logoV: React.CSSProperties = {
  color: '#f59e0b',
  fontWeight: '800',
};

const logoTagline: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '500',
  color: '#71717a',
  margin: '4px 0 0 0',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  textAlign: 'center',
};

/* ── Dividers ────────────────────────────────────────────────────── */

const accentDividerSection: React.CSSProperties = {
  textAlign: 'center',
  padding: '0 100px',
};

const accentDivider: React.CSSProperties = {
  borderColor: '#f59e0b',
  borderWidth: '1px',
  borderStyle: 'solid',
  margin: '24px auto',
  width: '60px',
};

const subtleDivider: React.CSSProperties = {
  borderColor: 'rgba(255, 255, 255, 0.08)',
  borderWidth: '1px',
  borderStyle: 'solid',
  margin: '32px auto',
};

/* ── Position Badge ──────────────────────────────────────────────── */

const badgeSection: React.CSSProperties = {
  textAlign: 'center',
  paddingBottom: '28px',
};

const positionBadgeTable: React.CSSProperties = {
  margin: '0 auto',
  backgroundColor: '#1a1400',
  border: '1px solid #f59e0b',
  borderRadius: '16px',
  padding: '0',
};

const positionBadgeTd: React.CSSProperties = {
  padding: '20px 48px',
  textAlign: 'center',
};

const positionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: '700',
  color: '#fbbf24',
  letterSpacing: '2.5px',
  margin: '0 0 8px 0',
  textTransform: 'uppercase',
  textAlign: 'center',
};

const positionNumber: React.CSSProperties = {
  fontSize: '42px',
  fontWeight: '800',
  color: '#ffffff',
  margin: '0',
  lineHeight: '1',
  textAlign: 'center',
};

/* ── Main Content ────────────────────────────────────────────────── */

const h1: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 24px 0',
  textAlign: 'center',
};

const paragraph: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '16px',
  lineHeight: '1.7',
  margin: '0 0 16px 0',
  textAlign: 'center',
};

/* ── Features Section ────────────────────────────────────────────── */

const featuresSection: React.CSSProperties = {
  backgroundColor: '#111111',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  padding: '28px 16px',
  textAlign: 'center',
};

const sectionTitle: React.CSSProperties = {
  color: '#fbbf24',
  fontSize: '14px',
  fontWeight: '700',
  margin: '0 0 24px 0',
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  textAlign: 'center',
};

const featureColumn: React.CSSProperties = {
  textAlign: 'center',
  verticalAlign: 'top',
  padding: '0 8px',
  width: '33.33%',
};

const featureIcon: React.CSSProperties = {
  fontSize: '28px',
  margin: '0 0 8px 0',
  textAlign: 'center',
};

const featureTitle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '700',
  margin: '0 0 6px 0',
  textAlign: 'center',
};

const featureDesc: React.CSSProperties = {
  color: '#71717a',
  fontSize: '12px',
  margin: '0',
  lineHeight: '1.5',
  textAlign: 'center',
};

/* ── Perks Section ───────────────────────────────────────────────── */

const perksSection: React.CSSProperties = {
  textAlign: 'center',
  paddingBottom: '8px',
};

const perkText: React.CSSProperties = {
  color: '#d4d4d8',
  fontSize: '15px',
  margin: '0 0 12px 0',
  lineHeight: '1.6',
  textAlign: 'center',
};

const perkCheck: React.CSSProperties = {
  color: '#f59e0b',
  fontWeight: '700',
  marginRight: '6px',
};

/* ── Social Section ──────────────────────────────────────────────── */

const socialSection: React.CSSProperties = {
  textAlign: 'center',
  paddingBottom: '8px',
};

const socialHeading: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0 0 6px 0',
  textAlign: 'center',
};

const socialText: React.CSSProperties = {
  color: '#71717a',
  fontSize: '14px',
  margin: '0 0 20px 0',
  textAlign: 'center',
};

const socialButtonsTable: React.CSSProperties = {
  margin: '0 auto',
  width: '100%',
};

const socialButtonsOuterTd: React.CSSProperties = {
  textAlign: 'center',
  padding: '0',
};

const socialButtonsInnerTable: React.CSSProperties = {
  margin: '0 auto',
};

const socialButtonTd: React.CSSProperties = {
  textAlign: 'center',
};

const socialButtonGap: React.CSSProperties = {
  width: '16px',
  fontSize: '0',
  lineHeight: '0',
};

const socialRowGap: React.CSSProperties = {
  height: '12px',
  fontSize: '0',
  lineHeight: '0',
};

const socialButtonLink: React.CSSProperties = {
  color: '#0a0a0a',
  backgroundColor: '#f59e0b',
  fontSize: '13px',
  fontWeight: '700',
  textDecoration: 'none',
  borderRadius: '8px',
  padding: '10px 24px',
  display: 'inline-block',
  textAlign: 'center',
  width: '160px',
};

/* ── Footer ──────────────────────────────────────────────────────── */

const footer: React.CSSProperties = {
  textAlign: 'center',
  paddingTop: '16px',
};

const footerDivider: React.CSSProperties = {
  borderColor: 'rgba(255, 255, 255, 0.06)',
  borderWidth: '1px',
  borderStyle: 'solid',
  margin: '0 0 24px 0',
};

const footerText: React.CSSProperties = {
  color: '#52525b',
  fontSize: '12px',
  margin: '0 0 8px 0',
  textAlign: 'center',
};

const footerDisclaimer: React.CSSProperties = {
  color: '#3f3f46',
  fontSize: '11px',
  margin: '0 0 8px 0',
  fontStyle: 'italic',
  textAlign: 'center',
};

const footerCopyright: React.CSSProperties = {
  color: '#3f3f46',
  fontSize: '11px',
  margin: '0',
  textAlign: 'center',
};

export default WaitlistConfirmationEmail;
