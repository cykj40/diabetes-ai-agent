# Diabetes AI Agent

A diabetes assistance to help with your day to day diabetes related tasks.

## Project Structure
```
diabetes-ai-agent/
├── frontend/          # Next.js frontend
│   └── ...
├── backend/          # Express backend
│   └── ...
└── README.md
```

## Getting Started

1. Install dependencies:
```bash
npm run install:all
```

2. Set up environment variables:
```bash
# In backend/.env
DATABASE_URL="your-neon-db-url"
PINECONE_API_KEY="your-pinecone-key"
PINECONE_ENVIRONMENT="your-pinecone-env"
CLERK_SECRET_KEY="your-clerk-secret"
CLERK_PUBLISHABLE_KEY="your-clerk-publishable"
PORT=3000

# In frontend/.env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-clerk-publishable"
NEXT_PUBLIC_CLERK_SECRET_KEY="your-clerk-secret"
```

3. Start development servers:
```bash
npm run dev
```

## Features
- Real-time glucose monitoring
- AI-powered health insights
- Secure authentication with Clerk.js
- Vector embeddings for health data analysis 
