import { render } from '@react-email/render';
import { WaitlistConfirmationEmail } from '@/emails/WaitlistConfirmation';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function getBrevoApiKey(): string {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY environment variable is not set');
  }
  return apiKey;
}

function getSenderEmail(): string {
  // Use BREVO_SENDER_EMAIL env var, or fall back to the verified Brevo sender
  return process.env.BREVO_SENDER_EMAIL || 'r6s0069@gmail.com';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, position, source } = body;

    // Validate required fields
    if (!email || !position) {
      return Response.json(
        { error: 'Missing required fields: email and position' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get Brevo API key (will throw if not set)
    const apiKey = getBrevoApiKey();
    const senderEmail = getSenderEmail();

    // Render the React Email template to HTML
    const htmlContent = await render(
      WaitlistConfirmationEmail({ email, position, source })
    );

    // Send via Brevo Transactional Email API
    // Docs: https://developers.brevo.com/reference/sendtransacemail
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'VentureXify',
          email: senderEmail,
        },
        to: [
          {
            email: email,
          },
        ],
        subject: `You're #${position} on the VentureXify waitlist! 🎉`,
        htmlContent: htmlContent,
        tags: ['waitlist-confirmation'],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Brevo API error:', result);
      const errorMessage = result?.message || result?.code || 'Failed to send email via Brevo';
      return Response.json({ error: errorMessage }, { status: response.status });
    }

    return Response.json({
      success: true,
      messageId: result?.messageId,
      message: 'Confirmation email sent successfully',
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send confirmation email';
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
