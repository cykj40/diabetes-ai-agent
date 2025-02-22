"use client";

import { useState } from "react";

export default function AIChat() {
    const [message, setMessage] = useState("");
    const [chat, setChat] = useState<{ role: string; text: string }[]>([]);

    const sendMessage = async () => {
        if (!message.trim()) return;

        const newMessage = { role: "user", text: message };
        setChat([...chat, newMessage]);

        setTimeout(() => {
            setChat([...chat, { role: "ai", text: "I am still under development!" }]);
        }, 1000);
    };

    return (
        <div className="p-4 bg-gray-100 shadow-lg rounded-lg">
            <div className="h-60 overflow-y-auto border p-2 mb-2">
                {chat.map((c, i) => (
                    <p key={i} className={c.role === "user" ? "text-right" : "text-left"}>
                        <span className={`px-2 py-1 rounded ${c.role === "user" ? "bg-blue-500 text-white" : "bg-gray-300 text-gray-700"}`}>

                            {c.text}
                        </span>
                    </p>
                ))}
            </div>
            <input
                type="text"
                className="w-full p-2 border rounded"
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
            />
            <button
                onClick={sendMessage}
                className="bg-blue-500 text-white p-2 rounded"
            >
                Send
            </button>

        </div>
    );
}

