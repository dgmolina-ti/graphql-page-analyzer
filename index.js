import fs from 'fs/promises';
import { OpenRouterAnalyzer } from './analyzer.js';

async function main(filePath, model) {
    // Initialize the analyzer with the OpenRouter API key and model
    const analyzer = new OpenRouterAnalyzer(process.env.OPENROUTER_API_KEY, model);

    const repoPath = `./repo_to_analyze/${filePath}`

    // Scan and group by pages folder
    const groupedFiles = await analyzer.scanForGraphQLTags(repoPath, `${repoPath}/src/components/pages`);

    console.log({ groupedFiles });

    // Analyze each page group
    const analysisResults = await analyzer.analyzeGroupedFiles(groupedFiles);

    // Save the analysis results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = `analysis-${timestamp}.json`;
    await fs.writeFile(
        outputFile,
        JSON.stringify(analysisResults, null, 2)
    );

    console.log(`\n✅ Analysis complete! Results saved to ${outputFile}`);
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('❌ Please provide required arguments:');
    console.log('Usage: node index.js <path-to-text-file> [model]');
    console.log('Example: node index.js input.txt anthropic/claude-3-opus');
    process.exit(1);
}

const filePath = args[0];
const model = args[1]; // Optional model parameter

main(filePath, model).catch(console.error);