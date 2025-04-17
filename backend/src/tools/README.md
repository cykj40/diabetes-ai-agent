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

## Peloton Tools

### Overview
The Peloton tools allow the agent to fetch and analyze workout data from the Peloton API. These tools provide insights about recent workouts, workout details, and how exercise impacts blood glucose levels.

### Available Tools
1. `get_recent_peloton_workouts`: Fetches recent workout data from Peloton
2. `get_peloton_workout_details`: Gets detailed information about a specific workout
3. `analyze_exercise_impact`: Analyzes the relationship between Peloton workouts and blood glucose levels

### Setup Instructions
To use the Peloton tools, you need to provide your Peloton session cookie in the `.env` file:

```
PELOTON_SESSION_COOKIE=your_peloton_session_cookie_here
```

#### How to obtain your Peloton session cookie:
1. Log in to your Peloton account in a web browser (https://members.onepeloton.com)
2. Open your browser's developer tools (F12 or right-click and select "Inspect")
3. Go to the "Application" or "Storage" tab
4. Look for "Cookies" in the sidebar and select the Peloton domain
5. Find the cookie named `peloton_session`
6. Copy the value and add it to your `.env` file

### Usage Examples
The agent can use these tools to answer questions like:
- "What were my recent Peloton workouts?"
- "Give me details about my last cycling class"
- "How do my workouts affect my blood sugar?"
- "Analyze how exercise impacts my glucose levels"

### Implementation
The tools are implemented in the `backend/src/tools/peloton` directory:
- `pelotonClient.ts`: Handles API communication with Peloton
- `recent-workouts.ts`: Implements the recent workouts tool
- `workout-details.ts`: Implements the workout details tool
- `exercise-impact.ts`: Implements the exercise impact analysis tool 