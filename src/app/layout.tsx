import './globals.css'
import { Urbanist } from 'next/font/google'

const urbanist = Urbanist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'], // Puedes ajustar los pesos que uses
  display: 'swap',
  variable: '--font-urbanist',
})

export const metadata = {
  title: 'Clinica UPS',
  description: 'Descripción',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={urbanist.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
