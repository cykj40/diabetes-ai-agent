"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const dummyData = [
    { time: "08:00", glucose: 100 },
    { time: "08:30", glucose: 105 },
    { time: "09:00", glucose: 110 },
    { time: "09:30", glucose: 115 },
    { time: "10:00", glucose: 120 },
    { time: "10:30", glucose: 125 },
    { time: "11:00", glucose: 130 },
    { time: "11:30", glucose: 135 },
    { time: "12:00", glucose: 140 },
    { time: "12:30", glucose: 145 },
];

const GlucoseChart = () => {
    return (
        <div className="p-4 bg-white shadow-lg rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Real-Time Glucose Levels</h2>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dummyData}>
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="glucose" stroke="#8884d8" />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

export default GlucoseChart;
