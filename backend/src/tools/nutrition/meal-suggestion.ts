import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { NutritionService } from "../../services/nutrition.service";

/**
 * Creates a tool for suggesting meals based on blood sugar levels and user preferences
 * @param userId User ID for personalized meal suggestions
 * @returns A tool that can be used by the agent to suggest meals
 */
export function getMealSuggestionTool(userId: string): DynamicStructuredTool {
    const nutritionService = new NutritionService();

    return new DynamicStructuredTool({
        name: "suggest_meal",
        description: "Suggest meals based on current blood sugar, time of day, and dietary preferences",
        schema: z.object({
            currentBloodSugar: z.number().optional().describe("Current blood sugar level in mg/dL"),
            mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).describe("Type of meal to suggest"),
            dietaryRestrictions: z.array(z.string()).optional().describe("Dietary restrictions (e.g., 'vegetarian', 'gluten-free')"),
            carbPreference: z.enum(["low", "medium", "high"]).optional().describe("Carbohydrate preference"),
        }) as any, // Type assertion to avoid TypeScript errors
        func: async ({ currentBloodSugar, mealType, dietaryRestrictions = [], carbPreference = "medium" }) => {
            try {
                const suggestions = await nutritionService.suggestMeals(
                    userId,
                    currentBloodSugar,
                    mealType,
                    dietaryRestrictions,
                    carbPreference
                );

                if (suggestions.length === 0) {
                    return "I couldn't generate meal suggestions at this time. Please try again later.";
                }

                let response = `Here are some ${mealType} suggestions`;
                if (currentBloodSugar) {
                    response += ` based on your current blood sugar of ${currentBloodSugar} mg/dL`;
                }
                response += ":\n\n";

                suggestions.forEach((meal, index) => {
                    response += `${index + 1}. **${meal.name}** (${meal.carbs}g carbs)\n`;
                    response += `   ${meal.description}\n\n`;
                });

                return response;
            } catch (error) {
                console.error("Error generating meal suggestions:", error);
                return "Failed to generate meal suggestions. Please try again later.";
            }
        },
    });
} 