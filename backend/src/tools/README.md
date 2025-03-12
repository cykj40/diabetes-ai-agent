# Agent Tools Directory

This directory contains all the tools that can be used by the diabetes AI agent. The tools are organized by category to make it easier to maintain and extend.

## Directory Structure

```
tools/
├── index.ts                # Main entry point that exports all tools
├── dexcom/                 # Tools for interacting with Dexcom API
│   ├── index.ts            # Exports all Dexcom tools
│   ├── current-reading.ts  # Tool for getting current blood sugar reading
│   ├── recent-readings.ts  # Tool for getting recent blood sugar readings
│   └── patterns.ts         # Tool for analyzing blood sugar patterns
├── charts/                 # Tools for generating visualizations
│   ├── index.ts            # Exports all chart tools
│   ├── line-chart.ts       # Tool for generating line charts
│   └── pie-chart.ts        # Tool for generating pie charts
└── nutrition/              # Tools for nutrition-related functionality
    ├── index.ts            # Exports all nutrition tools
    ├── food-info.ts        # Tool for getting nutritional information
    └── meal-suggestion.ts  # Tool for suggesting meals based on blood sugar
```

## Adding New Tools

To add a new tool:

1. Create a new file in the appropriate category directory
2. Implement the tool using the `DynamicStructuredTool` from LangChain
3. Export the tool from the category's index.ts file
4. The main index.ts will automatically include the new tool

## Tool Implementation Guidelines

Each tool should:

1. Accept a userId parameter for personalization
2. Use Zod for input validation
3. Include comprehensive error handling
4. Return user-friendly responses
5. Be well-documented with JSDoc comments

## Example Tool Implementation

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export function myNewTool(userId: string): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "my_new_tool",
        description: "Description of what the tool does",
        schema: z.object({
            // Define input parameters with Zod
            param1: z.string().describe("Description of parameter 1"),
            param2: z.number().optional().describe("Optional parameter 2"),
        }),
        func: async ({ param1, param2 }) => {
            try {
                // Tool implementation
                return "Result of the tool execution";
            } catch (error) {
                console.error("Error in my_new_tool:", error);
                return "Error message for the user";
            }
        },
    });
}
``` 