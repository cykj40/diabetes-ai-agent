import { DexcomReading } from './dexcom.service';
import OpenAI from 'openai';

/**
 * Service for generating charts and visualizations
 */
export class ChartService {
    private readonly openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    /**
     * Generate a line chart for blood sugar readings
     * @param readings Array of blood sugar readings
     * @param title Chart title
     * @param xAxisLabel X-axis label
     * @param yAxisLabel Y-axis label
     * @param includeTargetRange Whether to include the target range on the chart
     * @returns URL to the generated chart image
     */
    async generateLineChart(
        readings: DexcomReading[],
        title: string,
        xAxisLabel: string = 'Time',
        yAxisLabel: string = 'Blood Sugar (mg/dL)',
        includeTargetRange: boolean = true
    ): Promise<string> {
        try {
            if (!readings || readings.length === 0) {
                throw new Error('No readings provided for chart generation');
            }

            // Sort readings by timestamp
            const sortedReadings = [...readings].sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            // Format data for chart generation
            const timestamps = sortedReadings.map(r => new Date(r.timestamp).toLocaleString());
            const values = sortedReadings.map(r => r.value);

            // Create a detailed prompt for DALL-E
            let prompt = `Create a medical line chart visualization for diabetes management. `;
            prompt += `Create a line chart showing blood sugar values over time. `;
            prompt += `The chart should have a clear title "${title}" and `;

            if (includeTargetRange) {
                prompt += `show the target range of 70-180 mg/dL as a shaded area. `;
            }

            prompt += `The x-axis should be labeled "${xAxisLabel}" and the y-axis should be labeled "${yAxisLabel}" and include values from 0 to 300. `;
            prompt += `The chart should be clean, professional, and easy to read with a white background. `;
            prompt += `Use a blue and teal color scheme that's appropriate for medical data visualization. `;
            prompt += `Make it look like a real chart from a diabetes management app, not a hand-drawn illustration.`;

            // Generate image with DALL-E
            const response = await this.openai.images.generate({
                model: "dall-e-3",
                prompt,
                n: 1,
                size: "1024x1024",
            });

            return response.data[0].url || 'https://via.placeholder.com/1024x1024?text=Chart+Generation+Failed';
        } catch (error) {
            console.error("Error generating line chart:", error);
            // Return a placeholder image URL if chart generation fails
            return "https://via.placeholder.com/1024x1024?text=Chart+Generation+Failed";
        }
    }

    /**
     * Generate a pie chart
     * @param data Array of data points with labels and values
     * @param title Chart title
     * @returns URL to the generated chart image
     */
    async generatePieChart(
        data: Array<{ label: string; value: number; color?: string }>,
        title: string
    ): Promise<string> {
        try {
            if (!data || data.length === 0) {
                throw new Error('No data provided for chart generation');
            }

            // Create a detailed prompt for DALL-E
            let prompt = `Create a medical pie chart visualization for diabetes management. `;
            prompt += `The chart should have a clear title "${title}" and show the following segments: `;

            // Add data segments to the prompt
            data.forEach(item => {
                prompt += `${item.label} (${item.value}%), `;
            });

            prompt += `The chart should use distinct colors for each segment with a legend. `;
            prompt += `The chart should be clean, professional, and easy to read with a white background. `;
            prompt += `Make it look like a real chart from a diabetes management app, not a hand-drawn illustration.`;

            // Generate image with DALL-E
            const response = await this.openai.images.generate({
                model: "dall-e-3",
                prompt,
                n: 1,
                size: "1024x1024",
            });

            return response.data[0].url || 'https://via.placeholder.com/1024x1024?text=Chart+Generation+Failed';
        } catch (error) {
            console.error("Error generating pie chart:", error);
            // Return a placeholder image URL if chart generation fails
            return "https://via.placeholder.com/1024x1024?text=Chart+Generation+Failed";
        }
    }
} 