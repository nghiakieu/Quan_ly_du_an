import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from 'sonner';
import Navigation from '@/components/Navigation';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: "Quản Lý Dự Án by Nghĩa Kiều",
  description: "Hệ thống quản lý tiến độ dự án xây dựng",
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
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
