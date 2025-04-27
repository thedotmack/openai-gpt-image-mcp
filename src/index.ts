// Suppress all Node.js warnings (including deprecation)
(process as any).emitWarning = () => {};

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OpenAI } from "openai";

(async () => {
  const server = new McpServer({
    name: "openai-gpt-image-mcp",
    version: "1.0.0"
  }, {
    capabilities: {
      tools: { listChanged: false }
    }
  });

  // Zod schema for create-image tool input
  const createImageSchema = z.object({
    prompt: z.string().max(32000),
    background: z.enum(["transparent", "opaque", "auto"]).optional(),
    model: z.literal("gpt-image-1").default("gpt-image-1"),
    moderation: z.enum(["auto", "low"]).optional(),
    n: z.number().int().min(1).max(10).optional(),
    output_compression: z.number().int().min(0).max(100).optional(),
    output_format: z.enum(["png", "jpeg", "webp"]).optional(),
    quality: z.enum(["auto", "high", "medium", "low"]).optional(),
    size: z.enum(["1024x1024", "1536x1024", "1024x1536", "auto"]).optional(),
    user: z.string().optional(),
    output: z.enum(["base64", "file_output"]).default("base64"),
    file_output: z.string().optional().refine(
      (val) => !val || val.startsWith("/"),
      { message: "file_output must be an absolute path" }
    ).describe("Absolute path to save the image file, including the desired file extension (e.g., /path/to/image.png). If multiple images are generated (n > 1), an index will be appended (e.g., /path/to/image_1.png)."),
  }).refine(
    (data) => data.output !== "file_output" || (typeof data.file_output === "string" && data.file_output.startsWith("/")),
    { message: "file_output must be an absolute path when output is 'file_output'", path: ["file_output"] }
  );

  server.tool(
    "helloWorld",
    {},
    async () => ({
      content: [{ type: "text", text: "Hello, world!" }]
    })
  );

  // Use ._def.schema.shape to get the raw shape for server.tool due to Zod refinements
  server.tool(
    "create-image",
    (createImageSchema as any)._def.schema.shape,
    async (args, _extra) => {
      const openai = new OpenAI();
      // Only allow gpt-image-1
      const {
        prompt,
        background,
        model = "gpt-image-1",
        moderation,
        n,
        output_compression,
        output_format,
        quality,
        size,
        user,
        output = "base64",
        file_output,
      } = args;

      // Enforce: if background is 'transparent', output_format must be 'png' or 'webp'
      if (background === "transparent" && output_format && !["png", "webp"].includes(output_format)) {
        throw new Error("If background is 'transparent', output_format must be 'png' or 'webp'");
      }

      // Only include output_compression if output_format is webp or jpeg
      const imageParams: any = {
        prompt,
        model,
        ...(background ? { background } : {}),
        ...(moderation ? { moderation } : {}),
        ...(n ? { n } : {}),
        ...(output_format ? { output_format } : {}),
        ...(quality ? { quality } : {}),
        ...(size ? { size } : {}),
        ...(user ? { user } : {}),
      };
      if (
        typeof output_compression !== "undefined" &&
        output_format &&
        ["webp", "jpeg"].includes(output_format)
      ) {
        imageParams.output_compression = output_compression;
      }

      const result = await openai.images.generate(imageParams);

      // gpt-image-1 always returns base64 images in data[].b64_json
      const images = (result.data ?? []).map((img: any) => ({
        b64: img.b64_json,
        mimeType: output_format === "jpeg" ? "image/jpeg" : output_format === "webp" ? "image/webp" : "image/png",
        ext: output_format === "jpeg" ? "jpg" : output_format === "webp" ? "webp" : "png",
      }));

      if (output === "file_output") {
        const fs = await import("fs/promises");
        const path = await import("path");
        // If multiple images, append index to filename
        const basePath = file_output!;
        const responses = [];
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          let filePath = basePath;
          if (images.length > 1) {
            const parsed = path.parse(basePath);
            filePath = path.join(parsed.dir, `${parsed.name}_${i + 1}.${img.ext ?? "png"}`);
          } else {
            // Ensure correct extension
            const parsed = path.parse(basePath);
            filePath = path.join(parsed.dir, `${parsed.name}.${img.ext ?? "png"}`);
          }
          await fs.writeFile(filePath, Buffer.from(img.b64, "base64"));
          // Use the 'resource' type expected by the MCP SDK
          responses.push({ type: "resource", resource: { uri: `file://${filePath}`, mimeType: img.mimeType } });
        }
        return { content: responses };
      } else {
        // Default: base64
        return {
          content: images.map((img) => ({
            type: "image",
            data: img.b64,
            mimeType: img.mimeType,
          })),
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
})(); 