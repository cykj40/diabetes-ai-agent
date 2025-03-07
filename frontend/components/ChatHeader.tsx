// This is a Server Component by default (no "use client" directive)
import React from 'react';

interface ChatHeaderProps {
    title: string;
}

export default function ChatHeader({ title }: ChatHeaderProps) {
    return (
        <h2 className="text-lg font-semibold">{title}</h2>
    );
} 