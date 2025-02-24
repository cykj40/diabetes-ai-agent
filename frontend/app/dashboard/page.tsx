import GlucoseChart from "../../components/GlucoseChart";
import AIChat from "../../components/AIChat";
import { UserButton } from "@clerk/nextjs";

export default function Dashboard() {
    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                    <h1 className="text-xl font-semibold text-gray-800">DiabetesAI</h1>
                    <UserButton afterSignOutUrl="/" />
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                <GlucoseChart />
                <AIChat />
            </main>
        </div>
    );
} 