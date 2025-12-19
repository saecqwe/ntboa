import { Inter, Poppins } from "next/font/google";
import "./globals.css";
// IMPORT THE PROVIDER
import { AuthProvider } from "@/features/authentication/components/AuthProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata = {
  title: "NTBOA App",
  description: "Official Evaluation System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning={true}
        className={`${inter.variable} ${poppins.variable} antialiased`}
      >
        {/* WRAP CHILDREN WITH AUTHPROVIDER */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}