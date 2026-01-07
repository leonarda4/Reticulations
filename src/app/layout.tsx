import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Reticulations',
    description: 'Image processing app',
    icons: {
        icon: '/assets/logo.svg',
    },
    openGraph: {
        images: '/assets/logo.svg',
    },
    twitter: {
        card: 'summary_large_image',
        images: '/assets/logo.svg',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="dark">
            <body className="font-sans">{children}</body>
        </html>
    )
}