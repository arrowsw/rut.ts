/* eslint-env node */
import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Banner, Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import './globals.css'

export const metadata = {
  metadataBase: new URL('https://rutts-arrowsw.vercel.app'),
  title: {
    template: '%s - Rut.ts',
    default: 'Rut.ts - Handle chilean RUT values with ease'
  },
  description: 'A powerful TypeScript library for validating, formatting, and generating Chilean RUTs (Rol Único Tributario).',
  applicationName: 'Rut.ts',
  keywords: ['rut', 'chilean', 'validation', 'typescript', 'chile', 'dni', 'tax id', 'modulo 11'],
  authors: [{ name: 'Arrow Software', url: 'https://github.com/arrowsw' }],
  creator: 'Arrow Software',
  appleWebApp: {
    title: 'Rut.ts'
  },
  other: {
    'msapplication-TileImage': '/android-icon-192x192.png',
    'msapplication-TileColor': '#fff'
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://rutts-arrowsw.vercel.app',
    siteName: 'Rut.ts',
    title: 'Rut.ts - Handle chilean RUT values with ease',
    description: 'A powerful TypeScript library for validating, formatting, and generating Chilean RUTs',
  }
}

export default async function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head faviconGlyph="🇨🇱" />
      <body>
        {children}
      </body>
    </html>
  )
}
