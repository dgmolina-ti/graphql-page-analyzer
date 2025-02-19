import dotenv from 'dotenv';
dotenv.config();

class OpenRouterAnalyzer {
    constructor(apiKey, model = 'anthropic/claude-3-opus') {
        this.apiKey = apiKey;
        this.model = model;
    }

    // Helper function to create a delay
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async generateContent(prompt) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'CodeAnalyzer'
            },
            body: JSON.stringify({
                model: this.model,
                temperature: 0,
                messages: [
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`API call failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            response: {
                text: () => data.choices[0].message.content
            }
        };
    }

    async analyzePages(fileContent) {
        const pagesPrompt = `
            Given the following codebase context, analyze this frontend project code. Identify all defined "pages" or routes. For each page, extract:

            path: The route or URL path.
            component: The name of the component file associated with the page.
            description: A brief description of the page's purpose.
            Guidelines:

            Analyze the entire file content to ensure every component using GraphQL queries or mutations is included.
            Format your response exclusively as a JSON array. Each element in the array must be a JSON object with the keys "path", "component", and "description".
            Do not include any text or commentary outside the JSON array.
            Do not use any markdown syntax or additional formatting—return only valid JSON.
            If no components are found, return an empty JSON array.
            Context:
            ${fileContent}`;
        // const pagesPrompt = `
        // Given the following codebase context, list all the components using graphql queries or mutations.
        // Format the response as a JSON array of objects, where each object has:
        // - path: the path/route of component
        // - component: the file where the component is defined
        // - description: a brief description of what the component does

        // Context:
        // ${fileContent}

        // Response should be valid JSON only, no additional text. Do not use markdown syntax. Return only the array of objects.`;

        try {
            const pagesResult = await this.generateContent(pagesPrompt);
            const pagesResponse = await pagesResult.response;
            const cleanedPagesResponse = pagesResponse.text()
              .replace(/^```json\n/, '')  // Remove opening ```json and newline
              .replace(/\n```$/, '');     // Remove closing ``` and preceding newline
            const pages = JSON.parse(cleanedPagesResponse);

            console.log('\n📄 Found Pages:');
            console.log('----------------');
            pages.forEach(page => {
                console.log(`\n🔹 Path: ${page.path}`);
                console.log(`   Component: ${page.component}`);
                console.log(`   Description: ${page.description}`);
            });

            console.log('\n🔍 Analyzing GraphQL operations for each page in 60 seconds...\n');

            await this.delay(60000); // 60 seconds delay

            const analysisResults = [];
            for (const page of pages) {
                const analysis = await this.analyzePageGraphQL(page, fileContent);
                analysisResults.push(analysis);

                if (pages.indexOf(page) < pages.length - 1) {
                    console.log(`\n⏳ Waiting 60 seconds before analyzing next page...\n`);
                    await this.delay(60000); // 60 seconds delay
                }
            }

            console.log('\n✅ Analysis completed:');

            console.log(`\n📊 Total Pages Analyzed: ${pages.length}`);
            analysisResults.forEach((result, index) => {
                console.log(`\n📄 Analysis Result for Page ${index + 1}:`, result);
            });

            return {
                pages,
                analysisResults
            };

        } catch (error) {
            console.error('Error during analysis:', error);
            throw error;
        }
    }

    async analyzePageGraphQL(page, context) {
        // const graphqlPrompt = `
        // Given the following codebase context, analyze the following page in the codebase and identify the GraphQL queries and mutations
        // used by it directly and by its child components.
        // Page: ${page.component}

        // Format the response as a JSON object with:
        // - queries: array of objects containing { name }
        // - mutations: array of objects containing { name }

        // Only include actual GraphQL operations found in the code.
        // Look for gql tags, useQuery, useMutation, etc. In files related to the page, not just the component file.

        // Context:
        // ${context}

        // Response should be valid JSON only, no additional text.`;
        const graphqlPrompt = `
        Objective: Thoroughly identify and extract all GraphQL queries and mutations utilized by the specified page component and its entire dependency tree within the provided codebase context.

        Instructions:

        1. **Analyze the Page Component:** Begin your analysis with the component file designated as the 'Page Component'.

        2. **Trace Component Dependencies:**  Recursively examine the page component and all components it directly or indirectly imports and uses. This includes traversing the entire component hierarchy to identify all components contributing to the page's functionality and rendering. Consider both direct child components and components used deeper down the tree.

        3. **Scan for GraphQL Operations:** Within each component file identified in steps 1 and 2, meticulously search for GraphQL queries and mutations. Look for:
            * **\`gql\` template literals:**  Identify GraphQL operations defined using the \`gql\` tag from libraries like \`graphql-tag\` or similar.
            * **\`useQuery\` and \`useMutation\` hooks:**  Detect usage of these hooks (or equivalent hooks from libraries like Apollo Client, React Query, urql, etc.) and extract the associated GraphQL operation definitions.
            * **GraphQL client methods:**  Search for direct calls to GraphQL client methods (e.g., \`client.query()\`, \`client.mutate()\`) and analyze the arguments to identify the GraphQL operation.
            * **Imported GraphQL documents:**  Look for imports of \`.graphql\` files or JavaScript/TypeScript files containing exported GraphQL document nodes (queries/mutations).

        4. **Extract Operation Names:** For each identified GraphQL query and mutation, extract its name. This is typically the \`name\` field within the GraphQL operation definition (e.g., \`query GetUser { ... }\`, \`mutation UpdateProduct { ... }\`).

        5. **Format the Output:** Structure your findings as a JSON object with the following structure:

        \`\`\`json
        {
        "queries": [
            { "name": "QueryName1" },
            { "name": "QueryName2" },
            ...
        ],
        "mutations": [
            { "name": "MutationName1" },
            { "name": "MutationName2" },
            ...
        ]
        }

        Important Considerations:

        Scope: Ensure you analyze the entire component tree originating from the specified page component. Do not limit your search to just the immediate component file.

        Contextual Understanding: Utilize the provided context to understand import paths, file relationships, and any relevant project-specific conventions for GraphQL usage.

        Accuracy: Prioritize accuracy and completeness. Aim to identify all GraphQL operations used, avoiding both omissions and false positives.

        Codebase Variations: Be prepared to adapt to different coding styles and GraphQL library implementations within the codebase. Look for patterns and common practices.

        JSON Output Only: Strictly adhere to the JSON output format. Do not include any descriptive text or explanations outside of the JSON structure. If no queries or mutations are found, return empty arrays for both "queries" and "mutations".

        Page Component: ${page.component}

        Context:
        ${context}
        `;

        try {
            const result = await this.generateContent(graphqlPrompt);
            const response = await result.response;
            const cleanedResponse = response.text()
              .replace(/^```json\n/, '')  // Remove opening ```json and newline
              .replace(/\n```$/, '');     // Remove closing ``` and preceding newline

            const analysis = JSON.parse(cleanedResponse);

            console.log(`\n📑 GraphQL Analysis for ${page.path}`);
            console.log('----------------------------------------');

            if (analysis.queries.length > 0) {
                console.log('\n📥 Queries:');
                analysis.queries.forEach(query => {
                    console.log(`   • ${query.name}`);
                });
            }

            if (analysis.mutations.length > 0) {
                console.log('\n📤 Mutations:');
                analysis.mutations.forEach(mutation => {
                    console.log(`   • ${mutation.name}`);
                });
            }

            return {
                page: page.path,
                analysis,
                queryCount: analysis.queries.length,
                mutationCount: analysis.mutations.length
            };

        } catch (error) {
            console.error(`Error analyzing GraphQL for page ${page.path}:`, error);
            return {
                page: page.path,
                error: error.message
            };
        }
    }
}

export { OpenRouterAnalyzer };
