import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const kanit = Kanit({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "แดชบอร์ดเทรด XAU",
  description: "วิเคราะห์ข้อมูล CME Options และสัญญาณเทรด",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="dark">
      <body className={kanit.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
