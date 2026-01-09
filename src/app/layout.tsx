import type { Metadata } from 'next'
import './globals.css'

const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
const ogImage = '/assets/Reticulations%20logo.png'

export const metadata: Metadata = {
    metadataBase,
    title: 'Reticulations',
    description: 'Image processing app',
    icons: {
        icon: ogImage,
    },
    openGraph: {
        images: ogImage,
    },
    twitter: {
        card: 'summary_large_image',
        images: ogImage,
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
