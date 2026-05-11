import type { Metadata } from 'next';
import { colors, typography } from '@/design-tokens';
import './globals.css';

export const metadata: Metadata = {
  title: 'F1 Telemetry Dashboard',
  description: 'Futuristic real-time and historical F1 race telemetry visualization',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --color-primary-red: ${colors.primary.red};
            --color-primary-cyan: ${colors.primary.cyan};
            --color-bg-dark: ${colors.background.dark};
            --color-bg-darker: ${colors.background.darker};
            --color-text-primary: ${colors.text.primary};
            --color-text-secondary: ${colors.text.secondary};
            --font-display: ${typography.fonts.display};
            --font-body: ${typography.fonts.body};
            --spacing-unit: 1rem;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100%; height: 100%;
            background-color: var(--color-bg-dark);
            color: var(--color-text-primary);
            font-family: var(--font-body);
            font-size: 16px; line-height: 1.5; overflow: hidden;
          }
        `}} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
