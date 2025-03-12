import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { NutritionService } from "../../services/nutrition.service";

/**
 * Creates a tool for retrieving nutritional information about foods
 * @param userId User ID for personalized nutrition recommendations
 * @returns A tool that can be used by the agent to get food nutritional information
 */
export function getFoodInfoTool(userId: string): DynamicStructuredTool {
    const nutritionService = new NutritionService();

    return new DynamicStructuredTool({
        name: "get_food_nutritional_info",
        description: "Get nutritional information about a specific food item, including carbohydrates, protein, fat, and glycemic index if available",
        schema: z.object({
            foodName: z.string().describe("The name of the food item to look up"),
            servingSize: z.string().optional().describe("Optional serving size (e.g., '1 cup', '100g')"),
        }) as any, // Type assertion to avoid TypeScript errors
        func: async ({ foodName, servingSize }) => {
            try {
                const nutritionInfo = await nutritionService.getFoodInfo(foodName, servingSize);

                if (!nutritionInfo) {
                    return `No nutritional information found for "${foodName}".`;
                }

                const {
                    calories,
                    carbs,
                    protein,
                    fat,
                    fiber,
                    sugar,
                    glycemicIndex,
                    glycemicLoad,
                    servingInfo
                } = nutritionInfo;

                let response = `Nutritional information for ${foodName} (${servingInfo || servingSize || 'standard serving'}):\n\n`;
                response += `- Calories: ${calories} kcal\n`;
                response += `- Carbohydrates: ${carbs}g\n`;
                response += `- Protein: ${protein}g\n`;
                response += `- Fat: ${fat}g\n`;
                response += `- Fiber: ${fiber}g\n`;
                response += `- Sugar: ${sugar}g\n`;

                if (glycemicIndex) {
                    response += `- Glycemic Index: ${glycemicIndex}\n`;
                }

                if (glycemicLoad) {
                    response += `- Glycemic Load: ${glycemicLoad}\n`;
                }

                response += `\nImpact on blood sugar: ${getBloodSugarImpact(carbs, fiber, glycemicIndex)}`;

                return response;
            } catch (error) {
                console.error("Error fetching food nutritional information:", error);
                return `Failed to retrieve nutritional information for "${foodName}". Please try again later.`;
            }
        },
    });
}

/**
 * Determines the potential impact of a food on blood sugar levels
 * @param carbs Carbohydrate content in grams
 * @param fiber Fiber content in grams
 * @param glycemicIndex Glycemic index if available
 * @returns Description of potential blood sugar impact
 */
function getBloodSugarImpact(carbs: number, fiber: number, glycemicIndex?: number): string {
    const netCarbs = carbs - fiber;

    if (glycemicIndex) {
        if (glycemicIndex < 55) {
            return "Low impact on blood sugar (low glycemic index).";
        } else if (glycemicIndex < 70) {
            return "Moderate impact on blood sugar (medium glycemic index).";
        } else {
            return "High impact on blood sugar (high glycemic index).";
        }
    } else {
        if (netCarbs < 5) {
            return "Likely low impact on blood sugar (low net carbs).";
        } else if (netCarbs < 15) {
            return "Likely moderate impact on blood sugar (medium net carbs).";
        } else {
            return "Likely high impact on blood sugar (high net carbs).";
        }
    }
} 