# GraphQL Page Analyzer

A specialized tool that uses Google Gemini 2.0 Flash to analyze your codebase for pages and their associated GraphQL operations.

## Features

- Automatically identifies all pages/routes in your codebase
- Analyzes each page for GraphQL queries and mutations
- Provides detailed information about GraphQL operations including:
  - Query names and fields
  - Mutation names and variables
  - Descriptions of operations
- Saves analysis results to a JSON file

## Prerequisites

- Node.js 18 or higher
- Google Gemini API key

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install