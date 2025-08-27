Test Framework Assumptions:

- Jest with ts-jest is assumed based on common TypeScript setups. If the repository uses Vitest, replace `jest.*` with `vi.*` and configure the Vitest globals accordingly.
- These tests mock Node built-ins (fs, fs/promises, os, path) and the OpenAI client surface used by the code.