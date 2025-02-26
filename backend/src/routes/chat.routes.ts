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
        console.log('Received chat request:', req.body);
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get recent readings for context
        console.log('Fetching recent readings...');
        let recentReadings: DexcomReading[] = [];
        try {
            recentReadings = await dexcomService.getLatestReadings(48); // Get last 4 hours of readings
            console.log('Successfully retrieved readings (real or mock):',
                `Count: ${recentReadings.length}`,
                `Latest value: ${recentReadings[0]?.value}`,
                `Latest trend: ${recentReadings[0]?.trend}`
            );
        } catch (error) {
            console.error('Error getting readings, proceeding with empty readings:', error);
            recentReadings = [];
        }

        // Add readings context to the message
        const contextMessage = `
            User Message: ${message}
            Recent Blood Sugar Readings: ${JSON.stringify(recentReadings)}
        `;

        console.log('Sending message to agent with context length:', contextMessage.length);
        const response = await agent.ask(contextMessage);
        console.log('Received agent response');

        if (!response || !response.output) {
            console.error('Invalid response from agent:', response);
            throw new Error('Invalid response from agent');
        }

        const agentResponse = response.output;
        console.log('Agent response length:', agentResponse.length);

        // Check if the message is requesting data visualization
        const shouldGenerateChart = /chart|graph|plot|trend|pattern|visualization/i.test(message);

        if (shouldGenerateChart && recentReadings.length > 0) {
            console.log('Generating chart data...');
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
                console.log('Generating time of day analysis...');
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

            console.log('Sending response with chart data');
            return res.json({
                text: agentResponse,
                chartData,
                usingMockData: !dexcomService.isAuthenticated
            });
        } else {
            console.log('Sending response without chart data');
            return res.json({
                text: agentResponse,
                usingMockData: !dexcomService.isAuthenticated
            });
        }
    } catch (error) {
        console.error('Error in chat route:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error details:', errorMessage);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        return res.status(500).json({
            error: 'Failed to process chat request',
            details: errorMessage
        });
    }
});

export default router; 