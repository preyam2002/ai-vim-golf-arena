// Direct JS regex test
const text = `JOBS_API_URL=http://localhost:5000
JOBS_BASE_URL=http://localhost:8000
SCRAPERS_BASE_URL=http://localhost:9900

JOBS_DATABASE_URI=mongodb://mongouser:mongopassword@127.0.0.1:27017/app`;

console.log("Original:");
console.log(text);

// The pattern after conversion: ^#.*\n becomes ^#.*\n, and \n? becomes \n?
const pattern1 = new RegExp("^#.*\\n", "gm");
console.log("\nPattern1 test (^#.*\\n):", pattern1.test(text));

// Test with optional newline
const pattern2 = new RegExp("^#.*\\n\\n?", "gm");  
console.log("Pattern2 (^#.*\\n\\n?):");
console.log(text.replace(pattern2, ""));

// The issue: after removing comment, we have \n\n (two newlines)
// We want to match the newline AFTER the comment line
const text2 = `# API Settings
JOBS_API_URL=http://localhost:5000

# Database Settings  
JOBS_DATABASE_URI=mongodb...`;

console.log("\n\nTest with comments:");
console.log("Original:", JSON.stringify(text2));

const pattern3 = new RegExp("^#.*\\n\\n?", "gm");
const result = text2.replace(pattern3, "");
console.log("After pattern (^#.*\\n\\n?):", JSON.stringify(result));

// Better pattern: match comment and ALL following blank lines
const pattern4 = new RegExp("^#.*\\n(\\n)*", "gm");
const result2 = text2.replace(pattern4, "");
console.log("After pattern (^#.*\\n(\\n)*):", JSON.stringify(result2));
