import React from 'react';
import {
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    Radar,
    Tooltip
} from 'recharts';

interface PelotonMuscleChartCoreProps {
    data: Array<{
        muscle: string;
        percentage: number;
    }>;
}

const PelotonMuscleChartCore: React.FC<PelotonMuscleChartCoreProps> = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="muscle" tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                    formatter={(value: any) => [`${value}%`, 'Activity']}
                    contentStyle={{ backgroundColor: 'white', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
                />
                <Radar
                    name="Muscle Activity"
                    dataKey="percentage"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                />
            </RadarChart>
        </ResponsiveContainer>
    );
};

export default PelotonMuscleChartCore; 