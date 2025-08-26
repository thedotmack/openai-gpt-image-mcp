# openai-gpt-image-mcp

<p align="center">
  <a href="https://www.npmjs.com/package/@modelcontextprotocol/sdk"><img src="https://img.shields.io/npm/v/@modelcontextprotocol/sdk?label=MCP%20SDK&color=blue" alt="MCP SDK"></a>
  <a href="https://www.npmjs.com/package/openai"><img src="https://img.shields.io/npm/v/openai?label=OpenAI%20SDK&color=blueviolet" alt="OpenAI SDK"></a>
  <a href="https://github.com/SureScaleAI/openai-gpt-image-mcp/blob/main/LICENSE"><img src="https://img.shields.io/github/license/SureScaleAI/openai-gpt-image-mcp?color=brightgreen" alt="License"></a>
  <a href="https://github.com/SureScaleAI/openai-gpt-image-mcp/stargazers"><img src="https://img.shields.io/github/stars/SureScaleAI/openai-gpt-image-mcp?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/SureScaleAI/openai-gpt-image-mcp/actions"><img src="https://img.shields.io/github/actions/workflow/status/SureScaleAI/openai-gpt-image-mcp/main.yml?label=build&logo=github" alt="Build Status"></a>
</p>

---

A Model Context Protocol (MCP) tool server for OpenAI's GPT-4o/gpt-image-1 image generation and editing APIs.

- **Generate images** from text prompts using OpenAI's latest models.
- **Edit images** (inpainting, outpainting, compositing) with advanced prompt control.
- **Supports**: Claude Desktop, Cursor, VSCode, Windsurf, and any MCP-compatible client.

---

## ✨ Features

- **create-image**: Generate images from a prompt, with advanced options (size, quality, background, etc). Supports optional reference images to guide generation.
- **edit-image**: Edit or extend images using a prompt and optional mask, supporting both file paths and base64 input.
- **File output**: Save generated images directly to disk, or receive as base64.

---

## 🚀 Installation

```sh
git clone https://github.com/SureScaleAI/openai-gpt-image-mcp.git
cd openai-gpt-image-mcp
yarn install
yarn build
```

---

## 🔑 Configuration

Add to Claude Desktop or VSCode (including Cursor/Windsurf) config:

```json
{
  "mcpServers": {
    "openai-gpt-image-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

Also supports Azure deployments:

```json
{
  "mcpServers": {
    "openai-gpt-image-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": { 
        "AZURE_OPENAI_API_KEY": "sk-...",
        "AZURE_OPENAI_ENDPOINT": "my.endpoint.com",
        "OPENAI_API_VERSION": "2024-12-01-preview"
      }
    }
  }
}
```

Also supports supplying an environment files:

```json
{
  "mcpServers": {
    "openai-gpt-image-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js", "--env-file", "./deployment/.env"]
    }
  }
}
```

---

## ⚡ Advanced

- For `create-image`, set `n` to generate up to 10 images at once.
- For `create-image`, provide a `reference_image` (absolute file path, base64 string, or data URL) to guide image generation with visual context.
- For `edit-image`, provide a mask image (file path or base64) to control where edits are applied.
- Provide an environment file with `--env-file path/to/file/.env`
- See `src/index.ts` for all options.

---

## 🖼️ Reference Images

The `create-image` tool now supports reference images to guide the generation process. You can provide a reference image in three ways:

- **Absolute file path**: `/path/to/reference-image.jpg`
- **Base64 string**: `iVBORw0KGgoAAAANSUhEUgAAAAE...`
- **Data URL**: `data:image/jpeg;base64,/9j/4AAQSkZJRgABA...`

The reference image helps the AI understand the style, composition, or content you want to achieve in the generated image. Simply include it in the `reference_image` parameter when calling the `create-image` tool.

**Example**: Generate a landscape painting in the style of a reference artwork by providing both a descriptive prompt and the reference image.

---

## 🧑‍💻 Development

- TypeScript source: `src/index.ts`
- Build: `yarn build`
- Run: `node dist/index.js`

---

## 📝 License

MIT

---

## 🩺 Troubleshooting

- Make sure your `OPENAI_API_KEY` is valid and has image API access.
- You must have a [verified OpenAI organization](https://platform.openai.com/account/organization). After verifying, it can take 15–20 minutes for image API access to activate.
- File paths must be absolute.
  - **Unix/macOS/Linux**: Starting with `/` (e.g., `/path/to/image.png`)
  - **Windows**: Drive letter followed by `:` (e.g., `C:/path/to/image.png` or `C:\path\to\image.png`)
- For file output, ensure the directory is writable.
- If you see errors about file types, check your image file extensions and formats.

---

## ⚠️ Limitations & Large File Handling

- **1MB Payload Limit:** MCP clients (including Claude Desktop) have a hard 1MB limit for tool responses. Large images (especially high-res or multiple images) can easily exceed this limit if returned as base64.
- **Auto-Switch to File Output:** If the total image size exceeds 1MB, the tool will automatically save images to disk and return the file path(s) instead of base64. This ensures compatibility and prevents errors like `result exceeds maximum length of 1048576`.
- **Default File Location:** If you do not specify a `file_output` path, images will be saved to `~/Desktop/Generated_Images` (or the directory set by the `MCP_HF_WORK_DIR` environment variable) with a unique filename. The default directory is automatically created if it doesn't exist.
- **Environment Variable:**
  - `MCP_HF_WORK_DIR`: Set this to control where large images and file outputs are saved. Example: `export MCP_HF_WORK_DIR=/your/desired/dir`
  - If not set, defaults to `~/Desktop/Generated_Images` on macOS/Linux or `%USERPROFILE%\Desktop\Generated_Images` on Windows
- **Best Practice:** For large or production images, always use file output and ensure your client is configured to handle file paths.

---

## 📚 References

- [OpenAI Images API Documentation](https://platform.openai.com/docs/api-reference/images)

---

## 🙏 Credits

- Built with [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- Uses [openai](https://www.npmjs.com/package/openai) Node.js SDK 
- Built by [SureScale.ai](https://surescale.ai)
- Contributions from [Axle Research and Technology](https://axleinfo.com/)