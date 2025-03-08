'use client';

import { useEffect, useState, ReactNode } from 'react';

interface ClientOnlyProps {
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * ClientOnly component to prevent hydration errors
 * Only renders its children on the client-side
 */
export default function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Return fallback on server, children on client
    return isClient ? <>{children}</> : <>{fallback}</>;
} 