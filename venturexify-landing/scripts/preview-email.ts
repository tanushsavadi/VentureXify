/**
 * Renders the WaitlistConfirmation email template to a static HTML file
 * for local preview in the browser.
 *
 * Usage:  npm run email:preview
 *         (or: npx tsx scripts/preview-email.ts)
 */

import { render } from '@react-email/render';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WaitlistConfirmationEmail } from '../src/emails/WaitlistConfirmation';
import React from 'react';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const html = await render(
    React.createElement(WaitlistConfirmationEmail, {
      email: 'preview@example.com',
      position: 42,
      source: 'hero',
    })
  );

  const outPath = resolve(__dirname, '..', 'email-preview.html');
  writeFileSync(outPath, html, 'utf-8');

  console.log(`✅ Email preview written to: ${outPath}`);
  console.log('   Open it in your browser to view the rendered email.');
}

main().catch((err) => {
  console.error('❌ Failed to render email preview:', err);
  process.exit(1);
});
