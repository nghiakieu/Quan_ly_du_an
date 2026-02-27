import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from 'sonner';
import Navigation from '@/components/Navigation';
import { AuthProvider } from '@/lib/auth';
import AIChatBot from '@/components/AIChatBot';

export const metadata: Metadata = {
  title: "Quản Lý Dự Án by Nghĩa Kiều",
  description: "Hệ thống quản lý dự án xây dựng",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="antialiased">
        <AuthProvider>
          <Navigation />
          {children}
          <AIChatBot />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
