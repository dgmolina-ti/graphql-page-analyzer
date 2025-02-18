import fs from 'fs/promises';
import path from 'path';
import { OpenRouterAnalyzer } from './analyzer.js';

async function runAnalysis(filePath, model) {
    try {
        // Read the file content
        const fileContent = await fs.readFile(filePath, 'utf-8');
        console.log(`\n📂 Loaded file: ${path.basename(filePath)}`);
        console.log(`🤖 Using model: ${model || 'anthropic/claude-3-opus (default)'}`);

        const analyzer = new OpenRouterAnalyzer(process.env.OPENROUTER_API_KEY, model);
        const analysis = await analyzer.analyzePages(fileContent);

        // Save the analysis results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = `analysis-${timestamp}.json`;
        await fs.writeFile(
            outputFile,
            JSON.stringify(analysis, null, 2)
        );
        console.log(`\n✅ Analysis complete! Results saved to ${outputFile}`);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
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
runAnalysis(filePath, model);