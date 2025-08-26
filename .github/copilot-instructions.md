# OpenAI GPT Image MCP Server

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

OpenAI GPT Image MCP is a TypeScript-based Model Context Protocol (MCP) server that provides image generation and editing capabilities using OpenAI's gpt-image-1 model. The server supports both create-image and edit-image operations with advanced options for size, quality, background, and file output handling.

## Working Effectively

### Bootstrap and Build
Run these commands in sequence to set up the development environment:

```bash
# Install dependencies (choose one)
yarn install          # Takes ~6 seconds - PREFERRED
# OR
npm install           # Takes ~9 seconds, may require: npm audit fix

# Build the TypeScript source
yarn build            # Takes ~2 seconds. NEVER CANCEL.
# OR  
npm run build         # Takes ~2 seconds. NEVER CANCEL.
```

**NEVER CANCEL** build operations. Both yarn and npm builds complete quickly (~2 seconds) but should be allowed to finish completely.

### Run the MCP Server
```bash
# Basic server start (waits for JSON-RPC input via stdio)
node dist/index.js

# With environment file (recommended for development)
node dist/index.js --env-file path/to/.env

# Test server functionality
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/index.js --env-file /tmp/test.env
```

The server runs as an MCP (Model Context Protocol) server using stdio transport. It expects JSON-RPC messages and will appear to "hang" when run without input - this is normal behavior.

### Environment Configuration
Create a `.env` file for testing:
```bash
# Required for OpenAI API
OPENAI_API_KEY=sk-your-api-key-here

# Optional for Azure OpenAI
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=your-azure-endpoint
OPENAI_API_VERSION=2024-12-01-preview

# Optional work directory for file outputs
MCP_HF_WORK_DIR=/tmp/mcp-outputs
```

## Validation

### Manual Validation Requirements
Always test MCP server functionality after making changes:

1. **Build Validation**: Verify TypeScript compilation succeeds without errors
2. **Server Start Test**: Confirm server starts and loads environment correctly
3. **MCP Protocol Test**: Test JSON-RPC communication with tools/list call
4. **Tool Schema Validation**: Verify both create-image and edit-image tools are available with correct schemas

### Complete End-to-End Scenario
After making changes, run this validation sequence:
```bash
# 1. Clean build
rm -rf dist/ node_modules/
yarn install && yarn build

# 2. Create test environment
mkdir -p /tmp/mcp-test
echo "OPENAI_API_KEY=test-key-placeholder" > /tmp/mcp-test/.env
echo "MCP_HF_WORK_DIR=/tmp/mcp-test" >> /tmp/mcp-test/.env

# 3. Test server startup and tool listing
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
  timeout 5 node dist/index.js --env-file /tmp/mcp-test/.env

# 4. Verify expected output contains both tools
# Expected: {"result":{"tools":[{"name":"create-image",...},{"name":"edit-image",...}]},...}
```

The MCP server should respond with a JSON object containing exactly two tools: `create-image` and `edit-image` with their complete input schemas.

### Build Timing Expectations
- **yarn install**: ~6 seconds (preferred)
- **npm install**: ~9 seconds + potential audit fixes
- **TypeScript build**: ~2 seconds
- **Total setup time**: Under 10 seconds for complete fresh build

**CRITICAL**: Set timeouts to 30+ seconds for all operations to account for network variability. NEVER CANCEL build operations.

## Key Files and Navigation

### Primary Source Files
- `src/index.ts` - Main MCP server implementation with both create-image and edit-image tools
- `package.json` - Dependencies and build configuration (uses tsc only)
- `tsconfig.json` - TypeScript configuration (outputs to dist/)
- `README.md` - User documentation and configuration examples

### Build Output
- `dist/index.js` - Compiled JavaScript (single file output)
- Distribution is self-contained Node.js application

### Configuration Files
- `.env` files - Environment variables (not committed)
- `yarn.lock` / `package-lock.json` - Dependency locks

### Important Code Patterns
When editing `src/index.ts`:
- Tool definitions use Zod schemas for validation
- Both OpenAI and Azure OpenAI clients are supported via environment detection
- File output automatically switches when base64 response exceeds 1MB
- Environment file loading supports --env-file command line argument
- Absolute path validation is required for file inputs/outputs

## Common Tasks

### Dependency Management
```bash
# Add new dependency
yarn add package-name
# OR
npm install package-name

# Add dev dependency  
yarn add -D package-name
# OR
npm install --save-dev package-name
```

### Development Workflow
```bash
# Make changes to src/index.ts
# Build and test
yarn build && echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/index.js

# For file watching during development
# Note: No watch script exists - manual rebuild required
```

### Testing Changes
No formal test framework exists. Validate changes by:
1. Successful TypeScript compilation
2. MCP server startup without errors
3. JSON-RPC tools/list response contains expected schemas
4. Environment file loading works correctly

### Common Command Reference

#### Repository Structure (ls -la)
```
.
..
.cursorignore
.git/
.github/              # GitHub configuration
.gitignore
LICENSE               # MIT license
README.md            # User documentation
package.json         # Project configuration
src/                 # TypeScript source
  index.ts          # Main MCP server
test_*.png          # Example test images
tsconfig.json       # TypeScript config
yarn.lock           # Yarn dependencies
```

#### package.json Scripts
```json
{
  "scripts": {
    "build": "tsc"
  }
}
```

Only one script exists. No lint, test, or format scripts are configured.

#### Key Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `openai` - OpenAI API client (supports both OpenAI and Azure)
- `zod` - Schema validation for tool parameters

## Troubleshooting

### Server Won't Start
- Verify `dist/index.js` exists (run `yarn build`)
- Check environment file path if using --env-file
- Ensure Node.js version compatibility (ES2020 target)

### Build Failures
- Remove `node_modules/` and reinstall dependencies
- Verify TypeScript version compatibility
- Check for syntax errors in `src/index.ts`

### MCP Communication Issues
- Server communicates via stdio - input must be valid JSON-RPC
- Server will wait indefinitely for input when run interactively
- Use `timeout` command for testing to avoid hanging processes

Remember: This is an MCP server, not a traditional CLI application. It requires JSON-RPC input via stdin and responds via stdout using the MCP protocol.