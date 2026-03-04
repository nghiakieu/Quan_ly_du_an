import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from 'sonner';
import Navigation from '@/components/Navigation';


export const metadata: Metadata = {
  /*title: "Quản Lý Dự Án by Nghĩa Kiều",*/
  description: "Quản lý Dự án",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="antialiased">
        <Navigation />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
