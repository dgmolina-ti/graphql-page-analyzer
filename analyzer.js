import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

class OpenRouterAnalyzer {
    constructor(apiKey, model = 'google/gemini-2.0-flash-thinking-exp:free') {
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
            console.error('Error response:', await response.text());
            throw new Error(`API call failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            response: {
                text: () => data.choices[0].message.content
            }
        };
    }

    async analyzePageGraphQL(pageFiles, pageName) {
        const graphqlPrompt = `
        Objective: Thoroughly identify and extract all GraphQL queries and mutations from the provided set of files that belong to a specific page component.

        Instructions:

        1. **Analyze the Files:** Examine all provided files that belong to this page component and its related functionality.

        2. **Scan for GraphQL Operations:** Within each file, meticulously search for GraphQL queries and mutations. Look for:
            * **\`gql\` template literals**
            * **\`useQuery\` and \`useMutation\` hooks**
            * **GraphQL client methods**
            * **Imported GraphQL documents**

        3. **Extract Operation Names:** For each identified GraphQL query and mutation, extract its name.

        4. **Format the Output:** Structure your findings as a JSON object with queries and mutations arrays.

        Page Component: ${pageName}

        Files to analyze:
        ${pageFiles.join('\n')}

        Format the response as a JSON object with:
        {
            "queries": [{ "name": "QueryName" }],
            "mutations": [{ "name": "MutationName" }]
        }

        Context for each file follows:

        ${await this.getFilesContent(pageFiles)}`;

        try {
            const result = await this.generateContent(graphqlPrompt);
            const response = await result.response;
            const cleanedResponse = response.text()
              .replace(/^```json\n/, '')
              .replace(/\n```$/, '');

            const analysis = JSON.parse(cleanedResponse);

            console.log(`\n📑 GraphQL Analysis for ${pageName}`);
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
                page: pageName,
                analysis,
                queryCount: analysis.queries.length,
                mutationCount: analysis.mutations.length
            };

        } catch (error) {
            console.error(`Error analyzing GraphQL for page ${pageName}:`, error);
            return {
                page: pageName,
                error: error.message
            };
        }
    }

    async getFilesContent(files) {
        const contents = [];
        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf-8');
                contents.push(`FILE: ${file}\n${content}`);
            } catch (error) {
                console.error(`Error reading file ${file}:`, error);
            }
        }
        return contents.join('\n\n');
    }

    async analyzeGroupedFiles(groupedFiles) {
        const results = [];
        console.log('\n🔍 Analyzing GraphQL operations for each page group...');

        for (const [pageName, files] of Object.entries(groupedFiles)) {
            console.log(`\n📂 Analyzing page group: ${pageName}`);
            const analysis = await this.analyzePageGraphQL(files, pageName);
            results.push(analysis);

            if (Object.keys(groupedFiles).indexOf(pageName) < Object.keys(groupedFiles).length - 1) {
                console.log(`\n⏳ Waiting 10 seconds before analyzing next page group...\n`);
                await this.delay(10000);
            }
        }

        return results;
    }

    async findGraphQLFiles(dirPath) {
        const files = [];

        const processDirectory = async (currentPath) => {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                if (entry.isDirectory()) {
                    await processDirectory(fullPath);
                } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
                    const content = await fs.promises.readFile(fullPath, 'utf-8');
                    if (content.includes('gql`') || content.includes('graphql`')) {
                        files.push(fullPath);
                    }
                }
            }
        };

        await processDirectory(dirPath);
        return files;
    }

    async groupFilesByPagesFolder(files, pagesPath) {
        const groupedFiles = new Map();

        for (const file of files) {
            const relativePath = path.relative(pagesPath, file);
            const topLevelFolder = relativePath.split(path.sep)[0];

            if (!groupedFiles.has(topLevelFolder)) {
                groupedFiles.set(topLevelFolder, []);
            }

            groupedFiles.get(topLevelFolder).push(file);
        }

        return Object.fromEntries(groupedFiles);
    }

    async scanForGraphQLTags(folderPath, pagesComponentsPath = null) {
        try {
            console.log('\n🔍 Scanning for files with GraphQL tags...');
            const files = await this.findGraphQLFiles(folderPath);

            console.log(`\n📁 Found ${files.length} files containing GraphQL tags:`);
            files.forEach(file => {
                console.log(`   • ${file}`);
            });

            if (pagesComponentsPath) {
                console.log('\n📑 Grouping files by pages folder...');
                const groupedFiles = await this.groupFilesByPagesFolder(files, pagesComponentsPath);

                console.log('\n📊 Files grouped by pages folder:');
                Object.entries(groupedFiles).forEach(([folder, files]) => {
                    console.log(`\n📁 ${folder}:`);
                    files.forEach(file => {
                        console.log(`   • ${path.relative(pagesComponentsPath, file)}`);
                    });
                });

                return groupedFiles;
            }

            return files;
        } catch (error) {
            console.error('Error scanning for GraphQL tags:', error);
            throw error;
        }
    }
}

export { OpenRouterAnalyzer };
