// Test backreference conversion
const vimReplacement = " \"\\1\": \"\\2\",";
console.log("Vim replacement:", vimReplacement);

// Convert \1 to $1, \2 to $2
const jsReplacement = vimReplacement.replace(/\\(\d)/g, "$$$1");
console.log("JS replacement:", jsReplacement);

// Now test the actual regex replacement
const pattern = /^([^=]*)=(.*)$/;
const testLine = "JOBS_API_URL=http://localhost:5000";

const result = testLine.replace(pattern, jsReplacement);
console.log("Result:", result);
console.log("Expected:", ` "JOBS_API_URL": "http://localhost:5000",`);
