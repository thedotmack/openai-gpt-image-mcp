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
  });

  server.tool(
    "helloWorld",
    {},
    async () => ({
      content: [{ type: "text", text: "Hello, world!" }]
    })
  );

  server.tool(
    "create-image",
    createImageSchema.shape,
    async (input) => {
      console.error("OPENAI_API_KEY at runtime:", process.env.OPENAI_API_KEY);
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
      } = input;

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
      return {
        content: (result.data ?? []).map((img: any) => ({
          type: "image",
          data: img.b64_json,
          mimeType: output_format === "jpeg" ? "image/jpeg" : output_format === "webp" ? "image/webp" : "image/png",
        })),
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
})(); 