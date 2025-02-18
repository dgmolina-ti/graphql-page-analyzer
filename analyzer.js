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
                temperature: 0.1,
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
            Given the following codebase context, identify and list every component that uses GraphQL queries or mutations. For each component, extract the following details:

            path: the route or file path where the component is accessible.
            component: the file name where the component is defined.
            description: a short explanation of what the component does.
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
        const graphqlPrompt = `
        Analyze the following page in the codebase and identify the GraphQL queries and mutations used by it.
        Component: ${page.component}

        Format the response as a JSON object with:
        - queries: array of objects containing { name }
        - mutations: array of objects containing { name }

        Only include actual GraphQL operations found in the code. Look for gql tags, useQuery, useMutation, etc.

        Context:
        ${context}

        Response should be valid JSON only, no additional text.`;

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
