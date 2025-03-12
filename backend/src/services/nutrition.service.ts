import OpenAI from 'openai';
import axios from 'axios';

/**
 * Interface for nutritional information
 */
export interface NutritionInfo {
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
    fiber: number;
    sugar: number;
    glycemicIndex?: number;
    glycemicLoad?: number;
    servingInfo?: string;
}

/**
 * Service for nutrition-related functionality
 */
export class NutritionService {
    private readonly openai: OpenAI;
    private readonly apiKey: string;
    private readonly apiUrl: string;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        this.apiKey = process.env.NUTRITION_API_KEY || '';
        this.apiUrl = process.env.NUTRITION_API_URL || 'https://api.edamam.com/api/nutrition-data';
    }

    /**
     * Get nutritional information for a food item
     * @param foodName Name of the food item
     * @param servingSize Optional serving size
     * @returns Nutritional information or null if not found
     */
    async getFoodInfo(foodName: string, servingSize?: string): Promise<NutritionInfo | null> {
        try {
            // First try to get data from the nutrition API
            const apiData = await this.getNutritionFromAPI(foodName, servingSize);
            if (apiData) {
                return apiData;
            }

            // Fall back to AI-generated data if API fails
            return await this.getNutritionFromAI(foodName, servingSize);
        } catch (error) {
            console.error(`Error getting nutrition info for ${foodName}:`, error);
            return null;
        }
    }

    /**
     * Get nutritional information from the nutrition API
     * @param foodName Name of the food item
     * @param servingSize Optional serving size
     * @returns Nutritional information or null if not found
     */
    private async getNutritionFromAPI(foodName: string, servingSize?: string): Promise<NutritionInfo | null> {
        try {
            if (!this.apiKey) {
                return null; // Skip API call if no API key is provided
            }

            const query = servingSize ? `${servingSize} ${foodName}` : foodName;
            const encodedQuery = encodeURIComponent(query);

            const response = await axios.get(`${this.apiUrl}?app_id=your-app-id&app_key=${this.apiKey}&ingr=${encodedQuery}`);

            if (response.status !== 200 || !response.data) {
                return null;
            }

            const data = response.data;

            return {
                calories: data.calories || 0,
                carbs: data.totalNutrients?.CHOCDF?.quantity || 0,
                protein: data.totalNutrients?.PROCNT?.quantity || 0,
                fat: data.totalNutrients?.FAT?.quantity || 0,
                fiber: data.totalNutrients?.FIBTG?.quantity || 0,
                sugar: data.totalNutrients?.SUGAR?.quantity || 0,
                servingInfo: data.totalWeight ? `${data.totalWeight}g` : undefined
            };
        } catch (error) {
            console.error('Error fetching nutrition data from API:', error);
            return null;
        }
    }

    /**
     * Get nutritional information using AI
     * @param foodName Name of the food item
     * @param servingSize Optional serving size
     * @returns Nutritional information or null if not found
     */
    private async getNutritionFromAI(foodName: string, servingSize?: string): Promise<NutritionInfo | null> {
        try {
            const servingText = servingSize ? ` (${servingSize})` : '';
            const prompt = `Provide accurate nutritional information for ${foodName}${servingText}. 
            Include calories, carbohydrates (g), protein (g), fat (g), fiber (g), sugar (g), and glycemic index if applicable.
            Format the response as a JSON object with the following structure:
            {
                "calories": number,
                "carbs": number,
                "protein": number,
                "fat": number,
                "fiber": number,
                "sugar": number,
                "glycemicIndex": number or null,
                "glycemicLoad": number or null,
                "servingInfo": string
            }
            Use realistic values based on standard nutritional databases. If the glycemic index is unknown, set it to null.`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are a nutrition expert providing accurate nutritional information." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.2,
                response_format: { type: "json_object" }
            });

            const content = response.choices[0].message.content;
            if (!content) {
                return null;
            }

            try {
                const nutritionData = JSON.parse(content) as NutritionInfo;
                return nutritionData;
            } catch (parseError) {
                console.error('Error parsing nutrition data from AI:', parseError);
                return null;
            }
        } catch (error) {
            console.error('Error generating nutrition data with AI:', error);
            return null;
        }
    }

    /**
     * Suggest meals based on blood sugar level and preferences
     * @param userId User ID for personalized suggestions
     * @param currentBloodSugar Current blood sugar level
     * @param mealType Type of meal (breakfast, lunch, dinner, snack)
     * @param dietaryRestrictions Array of dietary restrictions
     * @param carbPreference Carbohydrate preference (low, medium, high)
     * @returns Array of meal suggestions
     */
    async suggestMeals(
        userId: string,
        currentBloodSugar?: number,
        mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'lunch',
        dietaryRestrictions: string[] = [],
        carbPreference: 'low' | 'medium' | 'high' = 'medium'
    ): Promise<Array<{ name: string; description: string; carbs: number }>> {
        try {
            // Build the prompt based on the parameters
            let prompt = `Suggest 3 ${mealType} options`;

            if (dietaryRestrictions.length > 0) {
                prompt += ` that are suitable for someone with the following dietary restrictions: ${dietaryRestrictions.join(', ')}`;
            }

            prompt += ` with a ${carbPreference} carbohydrate content`;

            if (currentBloodSugar) {
                prompt += `. The person's current blood sugar is ${currentBloodSugar} mg/dL`;

                if (currentBloodSugar > 180) {
                    prompt += `, which is high, so suggest meals that won't spike blood sugar further`;
                } else if (currentBloodSugar < 70) {
                    prompt += `, which is low, so suggest meals that will help raise blood sugar appropriately`;
                } else {
                    prompt += `, which is in the target range, so suggest balanced meals that will help maintain stable blood sugar`;
                }
            }

            prompt += `. Format the response as a JSON array with objects containing 'name', 'description', and 'carbs' (estimated carbohydrates in grams) for each meal.`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are a nutrition expert specializing in diabetes management." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            const content = response.choices[0].message.content;
            if (!content) {
                return [];
            }

            try {
                const mealData = JSON.parse(content);
                return Array.isArray(mealData.meals) ? mealData.meals : [];
            } catch (parseError) {
                console.error('Error parsing meal suggestions from AI:', parseError);
                return [];
            }
        } catch (error) {
            console.error('Error generating meal suggestions with AI:', error);
            return [];
        }
    }
} 