import GlucoseChart from "../components/GlucoseChart";
import AIChat from "../components/AIChat";

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Diabetes AI Dashboard</h1>
      <GlucoseChart />
      <AIChat />
    </div>
  );
}
