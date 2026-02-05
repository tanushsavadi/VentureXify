import { Resend } from 'resend';
import { WaitlistConfirmationEmail } from '@/emails/WaitlistConfirmation';

// Lazy instantiation to avoid build errors when API key is not set
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(apiKey);
  }
  return resend;
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

    // Get the Resend client (will throw if API key not set)
    const resendClient = getResendClient();

    // Use Resend's test domain (onboarding@resend.dev) until you verify your own domain
    // To use your own domain: verify it at https://resend.com/domains then change the 'from' address
    const { data, error } = await resendClient.emails.send({
      from: 'VentureXify <onboarding@resend.dev>',
      to: [email],
      subject: `You're #${position} on the VentureXify waitlist! 🎉`,
      react: WaitlistConfirmationEmail({ email, position, source }),
    });

    if (error) {
      console.error('Resend error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      messageId: data?.id,
      message: 'Confirmation email sent successfully'
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
