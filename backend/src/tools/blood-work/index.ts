import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { BloodWorkService } from "../../services/blood-work.service";
import { BloodWorkEmbeddingService } from "../../services/blood-work-embedding.service";

/**
 * Creates a tool for uploading and parsing blood work files
 */
export function uploadBloodWorkTool(userId: string): DynamicStructuredTool {
    const bloodWorkService = new BloodWorkService();

    return new DynamicStructuredTool({
        name: "upload_blood_work",
        description: "Upload and parse blood work files (CSV or PDF format). This tool processes lab results and provides insights about the data.",
        schema: z.object({
            fileContent: z.string().describe("The content of the file to parse"),
            fileName: z.string().describe("The name of the file being uploaded"),
            fileType: z.enum(["csv", "pdf"]).describe("The type of file being uploaded")
        }) as any,
        func: async ({ fileContent, fileName, fileType }) => {
            try {
                let record;

                if (fileType === "csv") {
                    record = await bloodWorkService.parseCSV(fileContent, fileName, userId);
                } else if (fileType === "pdf") {
                    record = await bloodWorkService.parsePDF(fileContent, fileName, userId);
                } else {
                    throw new Error(`Unsupported file type: ${fileType}`);
                }

                const summary = bloodWorkService.generateSummary(record);

                return {
                    success: true,
                    recordId: record.id,
                    recordName: record.name,
                    testsCount: record.values.length,
                    abnormalCount: record.values.filter(v => v.isAbnormal).length,
                    summary,
                    record
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred"
                };
            }
        }
    });
}

/**
 * Creates a tool for retrieving blood work records
 */
export function getBloodWorkRecordTool(userId: string): DynamicStructuredTool {
    const bloodWorkService = new BloodWorkService();

    return new DynamicStructuredTool({
        name: "get_blood_work_record",
        description: "Retrieve a specific blood work record by ID",
        schema: z.object({
            recordId: z.string().describe("The ID of the blood work record to retrieve")
        }) as any,
        func: async ({ recordId }) => {
            try {
                const record = await bloodWorkService.getRecord(recordId, userId);

                if (!record) {
                    return {
                        success: false,
                        error: `Blood work record with ID ${recordId} not found`
                    };
                }

                return {
                    success: true,
                    record
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred"
                };
            }
        }
    });
}

/**
 * Creates a tool for getting all blood work records
 */
export function getAllBloodWorkRecordsTool(userId: string): DynamicStructuredTool {
    const bloodWorkService = new BloodWorkService();

    return new DynamicStructuredTool({
        name: "get_all_blood_work_records",
        description: "Retrieve all blood work records for analysis and insights",
        schema: z.object({
            includeDetails: z.boolean().optional().describe("Whether to include detailed test values")
        }) as any,
        func: async ({ includeDetails = true }) => {
            try {
                const records = await bloodWorkService.getAllRecords(userId);

                if (!includeDetails) {
                    // Return summary info only
                    const summaryRecords = records.map(record => ({
                        id: record.id,
                        name: record.name,
                        date: record.date,
                        testsCount: record.values.length,
                        abnormalCount: record.values.filter(v => v.isAbnormal).length
                    }));

                    return {
                        success: true,
                        count: records.length,
                        records: summaryRecords
                    };
                }

                return {
                    success: true,
                    count: records.length,
                    records
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred"
                };
            }
        }
    });
}

/**
 * Creates a tool for searching blood work records by test name or value
 */
export function searchBloodWorkTool(userId: string): DynamicStructuredTool {
    const bloodWorkService = new BloodWorkService();

    return new DynamicStructuredTool({
        name: "search_blood_work",
        description: "Search blood work records by test name, looking for specific tests like glucose, HbA1c, cholesterol, etc.",
        schema: z.object({
            testName: z.string().describe("The name of the test to search for (e.g., 'glucose', 'HbA1c', 'cholesterol')"),
            includeAbnormalOnly: z.boolean().optional().describe("Whether to include only abnormal results")
        }) as any,
        func: async ({ testName, includeAbnormalOnly = false }) => {
            try {
                const results = await bloodWorkService.searchRecords(testName, userId, includeAbnormalOnly);

                return {
                    success: true,
                    searchTerm: testName,
                    includeAbnormalOnly,
                    resultsCount: results.length,
                    results
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred"
                };
            }
        }
    });
}

/**
 * Creates a tool for generating blood work insights and analysis
 */
export function generateBloodWorkInsightsTool(userId: string): DynamicStructuredTool {
    const bloodWorkService = new BloodWorkService();

    return new DynamicStructuredTool({
        name: "generate_blood_work_insights",
        description: "Generate insights and analysis from blood work data, identifying trends and abnormalities",
        schema: z.object({
            focusArea: z.enum(["diabetes", "cholesterol", "kidney", "liver", "general"]).optional().describe("Specific area to focus analysis on"),
            recordId: z.string().optional().describe("Specific record ID to analyze, or analyze all records if not provided")
        }) as any,
        func: async ({ focusArea = "general", recordId }) => {
            try {
                let recordsToAnalyze;

                if (recordId) {
                    const record = await bloodWorkService.getRecord(recordId, userId);
                    if (!record) {
                        return {
                            success: false,
                            error: `Blood work record with ID ${recordId} not found`
                        };
                    }
                    recordsToAnalyze = [record];
                } else {
                    recordsToAnalyze = await bloodWorkService.getAllRecords(userId);
                }

                if (recordsToAnalyze.length === 0) {
                    return {
                        success: false,
                        error: "No blood work records available for analysis"
                    };
                }

                // Generate insights based on focus area
                const insights = [];
                let abnormalTests = [];
                let keyMetrics = [];

                for (const record of recordsToAnalyze) {
                    const abnormal = record.values.filter(v => v.isAbnormal);
                    abnormalTests.push(...abnormal.map(test => ({
                        recordName: record.name,
                        recordDate: record.date,
                        ...test
                    })));

                    // Focus area specific analysis
                    if (focusArea === "diabetes") {
                        const diabetesTests = record.values.filter(v =>
                            v.name.toLowerCase().includes('glucose') ||
                            v.name.toLowerCase().includes('hba1c') ||
                            v.name.toLowerCase().includes('a1c')
                        );
                        keyMetrics.push(...diabetesTests.map(test => ({
                            recordName: record.name,
                            recordDate: record.date,
                            category: "diabetes",
                            ...test
                        })));
                    }
                }

                // Enhanced insights generation
                if (abnormalTests.length > 0) {
                    insights.push(`Found ${abnormalTests.length} abnormal test results requiring attention.`);
                } else {
                    insights.push("All test results appear to be within normal ranges.");
                }

                if (focusArea === "diabetes" && keyMetrics.length > 0) {
                    const glucoseTests = keyMetrics.filter(m => m.name.toLowerCase().includes('glucose'));
                    const hba1cTests = keyMetrics.filter(m => m.name.toLowerCase().includes('hba1c') || m.name.toLowerCase().includes('a1c'));

                    if (glucoseTests.length > 0) {
                        insights.push(`Glucose levels monitored across ${glucoseTests.length} tests.`);

                        // Get recent glucose trends
                        const recentGlucose = await bloodWorkService.getRecentTestValues('glucose', userId, 5);
                        if (recentGlucose.length > 1) {
                            const trend = recentGlucose[0].value > recentGlucose[recentGlucose.length - 1].value ? 'increasing' : 'decreasing';
                            insights.push(`Recent glucose trend: ${trend}.`);
                        }
                    }
                    if (hba1cTests.length > 0) {
                        insights.push(`HbA1c levels tracked across ${hba1cTests.length} tests.`);

                        // Get recent HbA1c trends
                        const recentHbA1c = await bloodWorkService.getRecentTestValues('hba1c', userId, 3);
                        if (recentHbA1c.length > 1) {
                            const latest = recentHbA1c[0].value;
                            const previous = recentHbA1c[1].value;
                            const change = typeof latest === 'number' && typeof previous === 'number' ?
                                (latest - previous).toFixed(1) : 'unknown';
                            insights.push(`HbA1c change from previous test: ${change}%.`);
                        }
                    }
                }

                return {
                    success: true,
                    focusArea,
                    recordsAnalyzed: recordsToAnalyze.length,
                    insights,
                    abnormalTests,
                    keyMetrics,
                    summary: insights.join(" ")
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred"
                };
            }
        }
    });
}

/**
 * Creates a tool for providing personalized nutrition recommendations based on blood work
 */
export function bloodWorkNutritionRecommendationsTool(userId: string): DynamicStructuredTool {
    const bloodWorkService = new BloodWorkService();

    return new DynamicStructuredTool({
        name: "blood_work_nutrition_recommendations",
        description: "Generate personalized nutrition and food recommendations based on blood work results, focusing on diabetes management, cholesterol, and overall health",
        schema: z.object({
            focusArea: z.enum(["diabetes", "cholesterol", "kidney", "liver", "general"]).optional().describe("Specific health area to focus recommendations on"),
            mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "general"]).optional().describe("Type of meal to focus recommendations on"),
            includeAbnormalOnly: z.boolean().optional().describe("Whether to focus only on abnormal lab values")
        }) as any,
        func: async ({ focusArea = "general", mealType = "general", includeAbnormalOnly = false }) => {
            try {
                const records = await bloodWorkService.getAllRecords(userId);

                if (records.length === 0) {
                    return {
                        success: false,
                        error: "No blood work records available for nutrition recommendations"
                    };
                }

                // Get the most recent record
                const latestRecord = records[0];
                const relevantTests = includeAbnormalOnly ?
                    latestRecord.values.filter(v => v.isAbnormal) :
                    latestRecord.values;

                const recommendations = [];
                const specificFoods = [];
                const avoidFoods = [];

                // Analyze specific test results for nutrition recommendations
                for (const test of relevantTests) {
                    const testName = test.name.toLowerCase();
                    const value = typeof test.value === 'number' ? test.value : parseFloat(test.value.toString());

                    // Glucose and diabetes management
                    if (testName.includes('glucose') || testName.includes('sugar')) {
                        if (value > 140) {
                            recommendations.push("🍎 Focus on low-glycemic foods to help manage elevated glucose levels");
                            specificFoods.push("Non-starchy vegetables (spinach, broccoli, bell peppers)", "Lean proteins (chicken, fish, tofu)", "Nuts and seeds", "Berries and citrus fruits");
                            avoidFoods.push("Refined sugars and sweets", "White bread and pasta", "Sugary drinks", "Processed snacks");
                        } else if (value < 70) {
                            recommendations.push("🍯 Include quick-acting carbs for low blood sugar episodes, then follow with protein");
                            specificFoods.push("Glucose tablets", "Orange juice (4oz)", "Honey or maple syrup (1 tbsp)", "Crackers with peanut butter");
                        }
                    }

                    // HbA1c management
                    if (testName.includes('hba1c') || testName.includes('a1c')) {
                        if (value > 7.0) {
                            recommendations.push("📉 Prioritize consistent carb counting and timing to improve long-term glucose control");
                            specificFoods.push("High-fiber foods (oatmeal, quinoa, legumes)", "Healthy fats (avocado, olive oil)", "Cinnamon and turmeric (may help with glucose)", "Greek yogurt with berries");
                        }
                    }

                    // Cholesterol management
                    if (testName.includes('cholesterol') || testName.includes('ldl')) {
                        if ((testName.includes('ldl') && value > 100) || (testName.includes('total') && value > 200)) {
                            recommendations.push("❤️ Heart-healthy foods to help lower cholesterol levels");
                            specificFoods.push("Oatmeal and soluble fiber", "Fatty fish (salmon, mackerel)", "Nuts (almonds, walnuts)", "Olive oil and avocados");
                            avoidFoods.push("Saturated fats", "Trans fats", "Fried foods", "High-fat dairy products");
                        }
                    }

                    if (testName.includes('hdl')) {
                        if (value < 40) {
                            recommendations.push("🏃‍♂️ Foods that can help raise HDL (good) cholesterol");
                            specificFoods.push("Fatty fish rich in omega-3s", "Whole grains", "Purple and red fruits", "Moderate amounts of red wine (if appropriate)");
                        }
                    }

                    if (testName.includes('triglyceride')) {
                        if (value > 150) {
                            recommendations.push("🐟 Focus on omega-3 rich foods and reduce simple carbs to lower triglycerides");
                            specificFoods.push("Salmon, sardines, and other fatty fish", "Flaxseeds and chia seeds", "Walnuts", "Leafy green vegetables");
                            avoidFoods.push("Simple sugars", "Refined carbohydrates", "Alcohol (limit)", "Fruit juices");
                        }
                    }

                    // Kidney function
                    if (testName.includes('creatinine') || testName.includes('bun')) {
                        if (test.isAbnormal) {
                            recommendations.push("🥬 Kidney-friendly nutrition choices");
                            specificFoods.push("Lower-protein options", "Low-sodium foods", "Fresh fruits and vegetables", "Adequate hydration");
                            avoidFoods.push("Excess protein", "High-sodium foods", "Processed foods", "Dark sodas");
                        }
                    }
                }

                // Meal-specific recommendations
                let mealGuidance = "";
                if (mealType !== "general") {
                    mealGuidance = generateMealSpecificGuidance(mealType, focusArea, latestRecord.values);
                }

                return {
                    success: true,
                    baseRecord: {
                        name: latestRecord.name,
                        date: latestRecord.date,
                        testsAnalyzed: relevantTests.length
                    },
                    focusArea,
                    mealType,
                    recommendations,
                    specificFoods,
                    avoidFoods,
                    mealGuidance,
                    summary: recommendations.length > 0 ?
                        `Based on your blood work, here are personalized nutrition recommendations:\n\n${recommendations.join('\n')}\n\n**Foods to include:** ${specificFoods.join(', ')}\n\n**Foods to limit:** ${avoidFoods.join(', ')}${mealGuidance ? `\n\n**${mealType} guidance:** ${mealGuidance}` : ''}` :
                        "Your blood work values appear to be within normal ranges. Continue with a balanced diet rich in vegetables, lean proteins, and whole grains."
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred"
                };
            }
        }
    });
}

/**
 * Creates a tool for providing insulin management recommendations based on blood work
 */
export function bloodWorkInsulinRecommendationsTool(userId: string): DynamicStructuredTool {
    const bloodWorkService = new BloodWorkService();

    return new DynamicStructuredTool({
        name: "blood_work_insulin_recommendations",
        description: "Generate insulin management recommendations based on blood work results, including timing, dosing considerations, and monitoring guidance",
        schema: z.object({
            includeBasalGuidance: z.boolean().optional().describe("Whether to include basal insulin guidance"),
            includeBolusguidance: z.boolean().optional().describe("Whether to include bolus insulin guidance"),
            currentInsulinRegimen: z.string().optional().describe("Current insulin regimen if known")
        }) as any,
        func: async ({ includeBasalGuidance = true, includeBolusguidance = true, currentInsulinRegimen }) => {
            try {
                const records = await bloodWorkService.getAllRecords(userId);

                if (records.length === 0) {
                    return {
                        success: false,
                        error: "No blood work records available for insulin recommendations"
                    };
                }

                // Get the most recent record
                const latestRecord = records[0];
                const recommendations = [];
                const monitoringTips = [];
                const warnings = [];

                // Analyze glucose and HbA1c for insulin management
                const glucoseTests = latestRecord.values.filter(v =>
                    v.name.toLowerCase().includes('glucose') || v.name.toLowerCase().includes('sugar')
                );
                const hba1cTests = latestRecord.values.filter(v =>
                    v.name.toLowerCase().includes('hba1c') || v.name.toLowerCase().includes('a1c')
                );

                // Glucose-based recommendations
                for (const glucose of glucoseTests) {
                    const value = typeof glucose.value === 'number' ? glucose.value : parseFloat(glucose.value.toString());

                    if (value > 180) {
                        recommendations.push("📈 **High Glucose Management:**");
                        recommendations.push("• Consider checking for ketones if glucose >250 mg/dL");
                        recommendations.push("• Review meal timing and carb counting accuracy");
                        recommendations.push("• Ensure proper insulin-to-carb ratios for meals");

                        if (includeBolusguidance) {
                            recommendations.push("• **Bolus insulin:** May need to adjust correction factor if frequent highs");
                            recommendations.push("• Consider pre-bolusing 15-20 minutes before meals");
                        }
                    } else if (value < 70) {
                        warnings.push("⚠️ **Low Glucose Alert:** Recent lab shows hypoglycemia");
                        recommendations.push("• Review basal insulin timing and dosing");
                        recommendations.push("• Ensure adequate bedtime snacks if needed");
                        recommendations.push("• Consider CGM for better low detection");

                        if (includeBasalGuidance) {
                            recommendations.push("• **Basal insulin:** May need reduction if frequent lows");
                        }
                    }
                }

                // HbA1c-based recommendations
                for (const hba1c of hba1cTests) {
                    const value = typeof hba1c.value === 'number' ? hba1c.value : parseFloat(hba1c.value.toString());

                    if (value > 8.0) {
                        recommendations.push("📊 **HbA1c Management (>8.0%):**");
                        recommendations.push("• Overall insulin regimen may need optimization");
                        recommendations.push("• Focus on consistent meal timing and carb counting");
                        recommendations.push("• Consider structured diabetes education program");

                        if (includeBasalGuidance) {
                            recommendations.push("• **Basal insulin:** May need adjustment for better overnight/fasting control");
                        }

                        if (includeBolusguidance) {
                            recommendations.push("• **Bolus insulin:** Review insulin-to-carb ratios and correction factors");
                        }
                    } else if (value < 6.5) {
                        recommendations.push("✅ **Excellent HbA1c Control (<6.5%):**");
                        recommendations.push("• Continue current insulin management strategy");
                        recommendations.push("• Monitor for increased hypoglycemia risk");
                        monitoringTips.push("Watch for low blood sugar symptoms");
                    } else if (value <= 7.0) {
                        recommendations.push("✅ **Good HbA1c Control (6.5-7.0%):**");
                        recommendations.push("• Maintain current insulin strategy with fine-tuning");
                        recommendations.push("• Focus on reducing glucose variability");
                    }
                }

                // General insulin management tips
                monitoringTips.push("Check blood glucose before meals and at bedtime");
                monitoringTips.push("Log insulin doses, carbs, and glucose readings");
                monitoringTips.push("Monitor for patterns in glucose trends");
                monitoringTips.push("Regular HbA1c monitoring every 3-6 months");

                // Special considerations based on other lab values
                const kidneyTests = latestRecord.values.filter(v =>
                    v.name.toLowerCase().includes('creatinine') || v.name.toLowerCase().includes('bun')
                );

                if (kidneyTests.some(t => t.isAbnormal)) {
                    warnings.push("🔍 **Kidney Function Note:** Monitor for changes in insulin needs due to kidney function");
                    recommendations.push("• Kidney function changes may affect insulin clearance");
                    recommendations.push("• Discuss with healthcare provider about insulin adjustments");
                }

                return {
                    success: true,
                    baseRecord: {
                        name: latestRecord.name,
                        date: latestRecord.date,
                        relevantTests: glucoseTests.length + hba1cTests.length
                    },
                    currentRegimen: currentInsulinRegimen,
                    recommendations,
                    monitoringTips,
                    warnings,
                    summary: generateInsulinSummary(recommendations, warnings, monitoringTips)
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred"
                };
            }
        }
    });
}

// Helper function for meal-specific guidance
function generateMealSpecificGuidance(mealType: string, focusArea: string, labValues: any[]): string {
    const guidance = [];

    const glucoseValues = labValues.filter(v => v.name.toLowerCase().includes('glucose'));
    const hasHighGlucose = glucoseValues.some(v => (typeof v.value === 'number' ? v.value : parseFloat(v.value.toString())) > 140);

    switch (mealType) {
        case "breakfast":
            if (hasHighGlucose) {
                guidance.push("Choose protein-rich breakfast to stabilize morning glucose");
                guidance.push("Consider: Greek yogurt with berries, eggs with vegetables, or steel-cut oats with nuts");
            } else {
                guidance.push("Include balanced macros: protein, healthy fats, and complex carbs");
            }
            break;
        case "lunch":
            if (hasHighGlucose) {
                guidance.push("Focus on non-starchy vegetables and lean protein");
                guidance.push("Limit refined carbs and add healthy fats for satiety");
            }
            break;
        case "dinner":
            if (hasHighGlucose) {
                guidance.push("Keep dinner lighter in carbs to avoid overnight highs");
                guidance.push("Include plenty of fiber to slow glucose absorption");
            }
            break;
        case "snack":
            if (hasHighGlucose) {
                guidance.push("Choose protein + fat combinations over carb-heavy snacks");
                guidance.push("Examples: nuts, cheese with vegetables, or hummus with cucumber");
            }
            break;
    }

    return guidance.join('. ');
}

// Helper function for insulin summary
function generateInsulinSummary(recommendations: string[], warnings: string[], monitoringTips: string[]): string {
    let summary = "**Insulin Management Based on Your Blood Work:**\n\n";

    if (warnings.length > 0) {
        summary += warnings.join('\n') + '\n\n';
    }

    if (recommendations.length > 0) {
        summary += "**Key Recommendations:**\n" + recommendations.join('\n') + '\n\n';
    }

    summary += "**Monitoring Guidelines:**\n" + monitoringTips.map(tip => `• ${tip}`).join('\n');
    summary += "\n\n⚠️ **Important:** These are general guidelines based on your lab results. Always consult with your healthcare provider before making insulin adjustments.";

    return summary;
}

/**
 * Creates a tool for querying blood work data from Pinecone using natural language
 */
export function queryBloodWorkVectorTool(userId: string): DynamicStructuredTool {
    const embeddingService = new BloodWorkEmbeddingService();

    return new DynamicStructuredTool({
        name: "query_blood_work_vector",
        description: "Search through user's blood work data using natural language queries. This tool can find specific test results, trends, and values from uploaded blood work files. Use this when users ask about their lab results, specific test values, or blood work history.",
        schema: z.object({
            query: z.string().describe("Natural language query about blood work (e.g., 'what was my glucose level', 'show me abnormal results', 'cholesterol values')")
        }) as any,
        func: async ({ query }) => {
            try {
                console.log(`Querying blood work vectors for user ${userId}: ${query}`);

                // Initialize embedding service if needed
                await embeddingService.initialize();

                // Query blood work data
                const results = await embeddingService.queryBloodWork(query, userId, 10);

                if (!results.success || results.results.length === 0) {
                    return {
                        success: false,
                        message: "No blood work data found for your query. Make sure you've uploaded blood work files first.",
                        context: ""
                    };
                }

                // Get formatted context for the AI
                const context = await embeddingService.getBloodWorkContext(query, userId);

                return {
                    success: true,
                    query,
                    resultsCount: results.results.length,
                    context,
                    summary: `Found ${results.results.length} relevant blood work results for your query: "${query}"`
                };
            } catch (error) {
                console.error('Error querying blood work vectors:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred",
                    context: ""
                };
            }
        }
    });
}

/**
 * Get all blood work tools for a specific user
 */
export function bloodWorkTools(userId: string = 'default-user'): DynamicStructuredTool[] {
    console.debug(`Registering blood work tools for user: ${userId}`);

    return [
        uploadBloodWorkTool(userId),
        getBloodWorkRecordTool(userId),
        getAllBloodWorkRecordsTool(userId),
        searchBloodWorkTool(userId),
        generateBloodWorkInsightsTool(userId),
        bloodWorkNutritionRecommendationsTool(userId),
        bloodWorkInsulinRecommendationsTool(userId),
        queryBloodWorkVectorTool(userId)  // Add the new Pinecone query tool
    ];
} 