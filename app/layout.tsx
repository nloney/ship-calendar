export const metadata = { title: 'Shipping Calendar' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Roboto, Arial, sans-serif', color: '#3c4043' }}>
        {children}
      </body>
    </html>
  );
}
