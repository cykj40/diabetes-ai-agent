import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { BloodWorkService } from "../../services/blood-work.service";

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
 * Get all blood work tools for a specific user
 */
export function bloodWorkTools(userId: string = 'default-user'): DynamicStructuredTool[] {
    console.debug(`Registering blood work tools for user: ${userId}`);

    return [
        uploadBloodWorkTool(userId),
        getBloodWorkRecordTool(userId),
        getAllBloodWorkRecordsTool(userId),
        searchBloodWorkTool(userId),
        generateBloodWorkInsightsTool(userId)
    ];
} 