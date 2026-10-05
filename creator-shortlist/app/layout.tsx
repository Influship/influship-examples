import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Creator shortlist · Influship example',
  description: 'Turn a campaign brief into an Instagram creator shortlist.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>{children}</body>
    </html>
  );
}
