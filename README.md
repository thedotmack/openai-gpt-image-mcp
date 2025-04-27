# <img src="https://cdn.jsdelivr.net/gh/openai/openai-cookbook/images/openai.png" alt="OpenAI Logo" width="36" style="vertical-align:middle;"/> openai-gpt-image-mcp

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

- **create-image**: Generate images from a prompt, with advanced options (size, quality, background, etc).
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

```sh
export OPENAI_API_KEY=sk-...
```

---

## 🛠️ Usage Examples

### Claude Desktop

```yaml
create-image:
  prompt: "A photorealistic portrait of a cat wearing sunglasses"
  size: "1024x1024"
  output: "file_output"
  file_output: "/Users/youruser/Desktop/cool_cat.png"

edit-image:
  image: "/Users/youruser/Desktop/cool_cat.png"
  prompt: "Make the cat's sunglasses neon pink"
  output: "file_output"
  file_output: "/Users/youruser/Desktop/cool_cat_edited.png"
```

---

### VSCode / Cursor / Windsurf

```yaml
create-image:
  prompt: "A futuristic city skyline at sunset, ultra detailed"
  size: "1024x1024"
  output: "file_output"
  file_output: "/absolute/path/to/future_city.png"

edit-image:
  image: "/absolute/path/to/future_city.png"
  prompt: "Add flying cars in the sky"
  output: "file_output"
  file_output: "/absolute/path/to/future_city_flyingcars.png"
```

---

## ⚡ Advanced

- For `create-image`, set `n` to generate up to 10 images at once.
- For `edit-image`, provide a mask image (file path or base64) to control where edits are applied.
- See `src/index.ts` for all options.

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
- For file output, ensure the directory is writable.
- If you see errors about file types, check your image file extensions and formats.

---

## 🙏 Credits

- Built with [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- Uses [openai](https://www.npmjs.com/package/openai) Node.js SDK 