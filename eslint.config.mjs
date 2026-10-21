import powerbiVisualsConfigs from "eslint-plugin-powerbi-visuals";

export default [
    powerbiVisualsConfigs.configs.recommended,
    {
        // tools/ holds Node and Python build helpers, not code that ships in the visual.
        ignores: ["node_modules/**", "dist/**", ".vscode/**", ".tmp/**", "tools/**", "src/generated/**"],
    },
];
