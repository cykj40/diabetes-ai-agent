import express from 'express';
import { DiabetesAgent } from '../services/diabetes-agent';
import { DexcomService, DexcomReading } from '../services/dexcom.service';

const router = express.Router();
const agent = new DiabetesAgent();
const dexcomService = new DexcomService();

interface ChartData {
    type: 'line' | 'bar' | 'timeOfDay';
    data: {
        labels: string[];
        values: number[];
        trends?: string[];
    };
    title: string;
    insights?: string[];
}

router.post('/', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get recent readings for context
        const recentReadings = await dexcomService.getLatestReadings(48); // Get last 4 hours of readings

        // Add readings context to the message
        const contextMessage = `
            User Message: ${message}
            Recent Blood Sugar Readings: ${JSON.stringify(recentReadings)}
        `;

        const response = await agent.ask(contextMessage);
        const agentResponse = response.output;

        // Check if the message is requesting data visualization
        const shouldGenerateChart = /chart|graph|plot|trend|pattern|visualization/i.test(message);

        if (shouldGenerateChart && recentReadings.length > 0) {
            // Process readings for visualization
            const chartData: ChartData = {
                type: 'line',
                data: {
                    labels: recentReadings.map((r: DexcomReading) => new Date(r.timestamp).toLocaleTimeString()),
                    values: recentReadings.map((r: DexcomReading) => r.value),
                    trends: recentReadings.map((r: DexcomReading) => r.trend)
                },
                title: 'Blood Sugar Trends',
                insights: [
                    `Average: ${Math.round(recentReadings.reduce((acc: number, r: DexcomReading) => acc + r.value, 0) / recentReadings.length)} mg/dL`,
                    `Latest reading: ${recentReadings[0].value} mg/dL (${recentReadings[0].trend})`,
                    `Highest: ${Math.max(...recentReadings.map((r: DexcomReading) => r.value))} mg/dL`,
                    `Lowest: ${Math.min(...recentReadings.map((r: DexcomReading) => r.value))} mg/dL`
                ]
            };

            // If the message specifically asks for time of day patterns
            if (/time.of.day|daily.pattern|hour|daytime/i.test(message)) {
                chartData.type = 'timeOfDay';
                // Group readings by hour
                const hourlyData = new Array(24).fill(0).map(() => ({ sum: 0, count: 0 }));
                recentReadings.forEach((reading: DexcomReading) => {
                    const hour = new Date(reading.timestamp).getHours();
                    hourlyData[hour].sum += reading.value;
                    hourlyData[hour].count++;
                });

                chartData.data = {
                    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                    values: hourlyData.map(h => h.count > 0 ? Math.round(h.sum / h.count) : 0)
                };
                chartData.title = 'Average Blood Sugar by Time of Day';
            }

            res.json({
                message: agentResponse,
                chartData
            });
        } else {
            res.json({
                message: agentResponse
            });
        }
    } catch (error) {
        console.error('Error in chat route:', error);
        res.status(500).json({ error: 'Failed to process chat request' });
    }
});

export default router; 