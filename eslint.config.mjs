import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        ignores: [".next/*", "node_modules/*"]
    },
    {
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "warn"
        }
    }
];
