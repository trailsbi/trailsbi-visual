import powerbiVisualsConfigs from "eslint-plugin-powerbi-visuals";

export default [
    powerbiVisualsConfigs.configs.recommended,
    {
        // tools/ holds Node and Python build helpers, not code that ships in the visual.
        // src/generated/page.ts (the TrailsBI page script) is linted like the rest.
        ignores: ["node_modules/**", "dist/**", ".vscode/**", ".tmp/**", "tools/**"],
    },
];
