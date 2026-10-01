import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ENERGY TWINS AI | จำลองก่อนเปลี่ยนจริง ประหยัดก่อนจ่ายจริง',
  description: 'Smart Home Energy Management Platform with AI and Digital Twin Simulation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="dark h-full">
      <body className="min-h-full bg-[#070b19] font-sans antialiased text-slate-100">
        {children}
      </body>
    </html>
  );
}
