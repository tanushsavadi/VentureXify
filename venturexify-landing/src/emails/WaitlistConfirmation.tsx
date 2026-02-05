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
          </Section>

          {/* Position Badge */}
          <Section style={badgeSection}>
            <Container style={positionBadge}>
              <Text style={positionLabel}>YOUR POSITION</Text>
              <Text style={positionNumber}>#{position}</Text>
            </Container>
          </Section>

          {/* Main Content */}
          <Heading style={h1}>You&apos;re on the list! 🎉</Heading>

          <Text style={paragraph}>
            Thanks for joining the VentureXify waitlist. You&apos;re one step closer to
            maximizing the value of your Capital One Venture X card.
          </Text>

          <Text style={paragraph}>
            We&apos;re building something special – a Chrome extension that uses AI to
            help you make smarter decisions about when to use points vs. cash for
            travel bookings.
          </Text>

          {/* What's Coming Section */}
          <Section style={featuresSection}>
            <Text style={sectionTitle}>What&apos;s Coming</Text>
            
            <Row style={featureRow}>
              <Column style={featureIconCol}>
                <Text style={featureIcon}>🔍</Text>
              </Column>
              <Column style={featureTextCol}>
                <Text style={featureTitle}>Smart Analysis</Text>
                <Text style={featureDesc}>
                  Real-time analysis of your bookings to find the best redemption value
                </Text>
              </Column>
            </Row>

            <Row style={featureRow}>
              <Column style={featureIconCol}>
                <Text style={featureIcon}>💰</Text>
              </Column>
              <Column style={featureTextCol}>
                <Text style={featureTitle}>Transfer Partner Optimization</Text>
                <Text style={featureDesc}>
                  Discover hidden value through airline & hotel transfer partners
                </Text>
              </Column>
            </Row>

            <Row style={featureRow}>
              <Column style={featureIconCol}>
                <Text style={featureIcon}>⚡</Text>
              </Column>
              <Column style={featureTextCol}>
                <Text style={featureTitle}>Instant Verdicts</Text>
                <Text style={featureDesc}>
                  Know immediately whether to pay with points or cash
                </Text>
              </Column>
            </Row>
          </Section>

          <Hr style={divider} />

          {/* Early Access Perks */}
          <Section style={perksSection}>
            <Text style={sectionTitle}>Your Early Access Perks</Text>
            
            <Section style={perkItem}>
              <Text style={perkText}>✓ First to access the beta launch</Text>
            </Section>
            <Section style={perkItem}>
              <Text style={perkText}>✓ Exclusive founding member features</Text>
            </Section>
            <Section style={perkItem}>
              <Text style={perkText}>✓ Direct line to share feedback & shape the product</Text>
            </Section>
            <Section style={perkItem}>
              <Text style={perkText}>✓ Potential early-bird pricing benefits</Text>
            </Section>
          </Section>

          <Hr style={divider} />

          {/* Social Section */}
          <Section style={socialSection}>
            <Text style={socialText}>
              Spread the word and help others maximize their Venture X!
            </Text>
            <Text style={socialLinks}>
              <Link href="https://twitter.com/intent/tweet?text=Just%20joined%20the%20%40VentureXify%20waitlist%21%20Can%27t%20wait%20to%20maximize%20my%20Capital%20One%20Venture%20X%20points%20with%20AI.%20%23VentureX%20%23TravelHacking&url=https://venturexify.vercel.app" style={socialLink}>
                Share on X
              </Link>
              {' • '}
              <Link href="https://www.linkedin.com/sharing/share-offsite/?url=https://venturexify.vercel.app" style={socialLink}>
                Share on LinkedIn
              </Link>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
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

// Styles
const main = {
  backgroundColor: '#0a0a0a',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
};

const logoSection = {
  textAlign: 'center' as const,
  marginBottom: '32px',
};

const logoText = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#ffffff',
  margin: '0',
  letterSpacing: '-0.5px',
};

const logoV = {
  background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const badgeSection = {
  textAlign: 'center' as const,
  marginBottom: '32px',
};

const positionBadge = {
  display: 'inline-block',
  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%)',
  border: '1px solid rgba(245, 158, 11, 0.3)',
  borderRadius: '16px',
  padding: '16px 32px',
};

const positionLabel = {
  fontSize: '11px',
  fontWeight: '600',
  color: '#f59e0b',
  letterSpacing: '1.5px',
  margin: '0 0 4px 0',
  textTransform: 'uppercase' as const,
};

const positionNumber = {
  fontSize: '36px',
  fontWeight: '700',
  color: '#ffffff',
  margin: '0',
  lineHeight: '1',
};

const h1 = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
};

const paragraph = {
  color: '#a1a1aa',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px 0',
};

const featuresSection = {
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  borderRadius: '12px',
  padding: '24px',
  marginTop: '32px',
};

const sectionTitle = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 20px 0',
};

const featureRow = {
  marginBottom: '16px',
};

const featureIconCol = {
  width: '40px',
  verticalAlign: 'top',
};

const featureIcon = {
  fontSize: '20px',
  margin: '0',
};

const featureTextCol = {
  paddingLeft: '12px',
};

const featureTitle = {
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0 0 4px 0',
};

const featureDesc = {
  color: '#71717a',
  fontSize: '14px',
  margin: '0',
  lineHeight: '1.5',
};

const divider = {
  borderColor: 'rgba(255, 255, 255, 0.1)',
  margin: '32px 0',
};

const perksSection = {
  marginBottom: '8px',
};

const perkItem = {
  marginBottom: '8px',
};

const perkText = {
  color: '#a1a1aa',
  fontSize: '15px',
  margin: '0',
  lineHeight: '1.6',
};

const socialSection = {
  textAlign: 'center' as const,
  marginTop: '8px',
};

const socialText = {
  color: '#71717a',
  fontSize: '14px',
  margin: '0 0 12px 0',
};

const socialLinks = {
  margin: '0',
};

const socialLink = {
  color: '#f59e0b',
  fontSize: '14px',
  textDecoration: 'none',
  fontWeight: '500',
};

const footer = {
  marginTop: '48px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#52525b',
  fontSize: '12px',
  margin: '0 0 8px 0',
};

const footerDisclaimer = {
  color: '#3f3f46',
  fontSize: '11px',
  margin: '0 0 8px 0',
  fontStyle: 'italic' as const,
};

const footerCopyright = {
  color: '#3f3f46',
  fontSize: '11px',
  margin: '0',
};

export default WaitlistConfirmationEmail;
