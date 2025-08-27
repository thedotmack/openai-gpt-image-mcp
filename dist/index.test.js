"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Tests for image tools and helper utilities.
 * Framework: Jest (with ts-jest) assumed. If the project uses Vitest, replace jest.* with vi.* and adjust mocks accordingly.
 */
const path_1 = __importDefault(require("path"));
jest.mock("openai", () => {
    // Minimal mock for OpenAI client used in images.generate and images.edit
    class ImagesAPI {
        constructor(mode, payloads) {
            this.mode = mode;
            this.payloads = payloads;
        }
        async generate(params) {
            // Return payloads for generate calls
            return { data: this.payloads };
        }
        async edit(params) {
            // Return payloads for edit calls
            return { data: this.payloads };
        }
    }
    class OpenAI {
        constructor(payloads = []) {
            this.images = new ImagesAPI("generate", payloads);
        }
    }
    // AzureOpenAI has same interface for tests
    const AzureOpenAI = OpenAI;
    // We expose factory helpers so tests can swap payloads
    const __setGeneratePayloads = (payloads) => {
        OpenAI.prototype.images = new ImagesAPI("generate", payloads);
        AzureOpenAI.prototype.images = new ImagesAPI("generate", payloads);
    };
    const __setEditPayloads = (payloads) => {
        OpenAI.prototype.images = new ImagesAPI("edit", payloads);
        AzureOpenAI.prototype.images = new ImagesAPI("edit", payloads);
    };
    return { OpenAI, AzureOpenAI, __setGeneratePayloads, __setEditPayloads };
});
jest.mock("fs", () => {
    const real = jest.requireActual("fs");
    const memFS = {};
    const mkdirSync = jest.fn((dirPath, opts) => {
        // emulate recursive creation
        const parts = dirPath.split(path_1.default.sep);
        let cur = "";
        for (const p of parts) {
            if (!p)
                continue;
            cur = cur ? path_1.default.join(cur, p) : (path_1.default.isAbsolute(dirPath) ? path_1.default.sep + p : p);
            memFS[cur] = memFS[cur] || { type: "dir" };
        }
        return undefined;
    });
    const readFileSync = jest.fn((filePath, enc) => {
        if (!(filePath in memFS) || memFS[filePath].type !== "file") {
            const err = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
            err.code = "ENOENT";
            throw err;
        }
        return memFS[filePath].content;
    });
    const writeFileSync = jest.fn((filePath, data) => {
        memFS[filePath] = { type: "file", content: data.toString() };
    });
    const createReadStream = jest.fn((filePath) => {
        if (!(filePath in memFS) || memFS[filePath].type !== "file") {
            const err = new Error(`ENOENT: ${filePath}`);
            err.code = "ENOENT";
            throw err;
        }
        // very lightweight fake stream-like object (only what toFile likely reads)
        return {
            path: filePath,
            on: jest.fn(),
            pipe: jest.fn(),
            read: jest.fn(),
        };
    });
    const promises = {
        writeFile: jest.fn(async (filePath, data) => {
            memFS[filePath] = { type: "file", content: Buffer.isBuffer(data) ? data : Buffer.from(String(data)) };
        }),
    };
    return {
        ...real,
        mkdirSync,
        readFileSync,
        writeFileSync,
        createReadStream,
        promises,
        __memFS: memFS,
    };
});
jest.mock("fs/promises", () => {
    const mem = jest.requireMock("fs").__memFS;
    return {
        writeFile: jest.fn(async (filePath, data) => {
            mem[filePath] = { type: "file", content: Buffer.isBuffer(data) ? data : Buffer.from(String(data)) };
        }),
    };
});
jest.mock("os", () => {
    let home = "/home/tester";
    let tmp = "/tmp";
    let platform = process.platform;
    return {
        homedir: () => home,
        tmpdir: () => tmp,
        __setHome: (h) => (home = h),
        __setTmp: (t) => (tmp = t),
    };
});
jest.mock("path", () => {
    const actual = jest.requireActual("path");
    return {
        ...actual,
    };
});
// Silence console logs in tests but capture warnings for assertions
const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => { });
// Import the module under test after mocks
// We assume the implementation resides in src/index.ts and exports schemas/helpers where possible.
// If not exported, the module's side-effects (server.tool registrations) are still executed for handler path tests.
let mod;
beforeAll(async () => {
    mod = await Promise.resolve().then(() => __importStar(require("./index")));
});
afterAll(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
});
describe("Helper: loadEnvFile", () => {
    test("loads key=value pairs, trims whitespace, ignores comments, supports quotes", () => {
        const fs = jest.requireMock("fs");
        const envPath = "/env/test.env";
        fs.__memFS[envPath] = {
            type: "file",
            content: [
                "# Comment line",
                "FOO=bar",
                "BAZ = qux quux",
                "QUOTED_SINGLE='hello world'",
                'QUOTED_DOUBLE="good bye"',
                "EMPTY=",
                "SPACED=  spaced value  ",
                "EQUALS_IN_VALUE=one=two=three",
            ].join("\n"),
        };
        // Access helper either via export or by re-importing private (if exported)
        const fn = mod.loadEnvFile ?? mod["loadEnvFile"];
        expect(typeof fn).toBe("function");
        fn(envPath);
        expect(process.env.FOO).toBe("bar");
        expect(process.env.BAZ).toBe("qux quux");
        expect(process.env.QUOTED_SINGLE).toBe("hello world");
        expect(process.env.QUOTED_DOUBLE).toBe("good bye");
        expect(process.env.EMPTY).toBe("");
        expect(process.env.SPACED).toBe("spaced value");
        expect(process.env.EQUALS_IN_VALUE).toBe("one=two=three");
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Loaded environment variables from ${envPath}`));
    });
    test("warns but does not throw when file cannot be read", () => {
        const fn = mod.loadEnvFile ?? mod["loadEnvFile"];
        expect(() => fn("/nonexistent/.env")).not.toThrow();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Warning: Could not read environment file"), expect.any(Error));
    });
});
describe("Helper: getDefaultImageDirectory", () => {
    test("returns Desktop/Generated_Images for linux/darwin and creates it", () => {
        const os = jest.requireMock("os");
        const fs = jest.requireMock("fs");
        os.__setHome("/home/alice");
        const fn = mod.getDefaultImageDirectory ?? mod["getDefaultImageDirectory"];
        const dir = fn();
        expect(dir).toBe(path_1.default.join("/home/alice", "Desktop", "Generated_Images"));
        expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    });
    test("falls back to os.tmpdir() when mkdir fails", () => {
        const os = jest.requireMock("os");
        const fs = jest.requireMock("fs");
        os.__setHome("/home/bob");
        fs.mkdirSync.mockImplementationOnce(() => {
            throw new Error("EACCES");
        });
        const fn = mod.getDefaultImageDirectory ?? mod["getDefaultImageDirectory"];
        const dir = fn();
        expect(dir).toBe(os.tmpdir());
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Warning: Could not create default image directory"), expect.any(Error));
    });
});
describe("Schema: createImageSchema", () => {
    test("accepts minimal valid input with defaults", () => {
        const { z } = mod;
        const schema = mod.createImageSchema ?? mod["createImageSchema"];
        const parsed = schema.parse({ prompt: "draw a cat" });
        expect(parsed.model).toBe("gpt-image-1");
        expect(parsed.output).toBe("base64");
    });
    test("validates absolute file_output when output is 'file_output'", () => {
        const schema = mod.createImageSchema ?? mod["createImageSchema"];
        expect(() => schema.parse({ prompt: "x", output: "file_output", file_output: "relative/path.png" })).toThrow(/absolute path/i);
        // Valid absolute (unix)
        expect(() => schema.parse({ prompt: "x", output: "file_output", file_output: "/abs/path.png" })).not.toThrow();
        // Valid absolute (win)
        expect(() => schema.parse({ prompt: "x", output: "file_output", file_output: "C:\\\\abs\\\\path.png" })).not.toThrow();
    });
    test("enforces model-specific rules: dall-e-3 only n=1 and restricts params", () => {
        const schema = mod.createImageSchema ?? mod["createImageSchema"];
        expect(() => schema.parse({ prompt: "x", model: "dall-e-3", n: 2 })).toThrow(/Invalid parameter combination/i);
        expect(() => schema.parse({ prompt: "x", model: "dall-e-3", background: "transparent" })).toThrow(/Invalid parameter combination/i);
        expect(() => schema.parse({ prompt: "x", model: "dall-e-3", size: "1792x1024" })).not.toThrow();
    });
    test("enforces model-specific rules: dall-e-2 restrictions and size/quality", () => {
        const schema = mod.createImageSchema ?? mod["createImageSchema"];
        expect(() => schema.parse({ prompt: "x", model: "dall-e-2", quality: "hd" })).toThrow(/Invalid parameter combination/i);
        expect(() => schema.parse({ prompt: "x", model: "dall-e-2", size: "1024x1024" })).not.toThrow();
        expect(() => schema.parse({ prompt: "x", model: "dall-e-2", style: "vivid" })).toThrow(/Invalid parameter combination/i);
    });
    test("gpt-image-1: forbids response_format/style and validates quality/size", () => {
        const schema = mod.createImageSchema ?? mod["createImageSchema"];
        expect(() => schema.parse({ prompt: "x", response_format: "url" })).toThrow(/Invalid parameter combination/i);
        expect(() => schema.parse({ prompt: "x", style: "vivid" })).toThrow(/Invalid parameter combination/i);
        expect(() => schema.parse({ prompt: "x", quality: "high" })).not.toThrow();
        expect(() => schema.parse({ prompt: "x", size: "1536x1024" })).not.toThrow();
    });
});
describe("Schema: editImageSchema", () => {
    test("accepts single or multiple image inputs for gpt-image-1", () => {
        const base = mod.editImageBaseSchema ?? mod["editImageBaseSchema"];
        const schema = mod.editImageSchema ?? mod["editImageSchema"];
        expect(() => schema.parse({ image: "/abs/a.png", prompt: "p" })).not.toThrow();
        expect(() => schema.parse({ image: ["/abs/a.png", "/abs/b.png"], prompt: "p", model: "gpt-image-1" })).not.toThrow();
    });
    test("dall-e-2: rejects multiple images and long prompts; restricts quality/size", () => {
        const schema = mod.editImageSchema ?? mod["editImageSchema"];
        expect(() => schema.parse({ image: ["/abs/a.png", "/abs/b.png"], prompt: "p", model: "dall-e-2" })).toThrow(/Invalid parameter combination/i);
        expect(() => schema.parse({ image: "/abs/a.png", prompt: "x".repeat(1001), model: "dall-e-2" })).toThrow(/Invalid parameter combination/i);
        expect(() => schema.parse({ image: "/abs/a.png", prompt: "ok", model: "dall-e-2", quality: "standard" })).not.toThrow();
        expect(() => schema.parse({ image: "/abs/a.png", prompt: "ok", model: "dall-e-2", size: "256x256" })).not.toThrow();
    });
    test("file_output absolute path enforcement when output is file_output", () => {
        const schema = mod.editImageSchema ?? mod["editImageSchema"];
        expect(() => schema.parse({ image: "/abs/a.png", prompt: "p", output: "file_output", file_output: "rel/out.png" })).toThrow(/absolute path/i);
        expect(() => schema.parse({ image: "/abs/a.png", prompt: "p", output: "file_output", file_output: "/abs/out.png" })).not.toThrow();
    });
});
describe("Handler: create-image behavior", () => {
    test("gpt-image-1 base64 response under 1MB returns base64 images", async () => {
        const { __setGeneratePayloads } = await Promise.resolve().then(() => __importStar(require("openai")));
        // ~100 bytes base64 per image
        const b64 = Buffer.from("small").toString("base64");
        __setGeneratePayloads([{ b64_json: b64 }]);
        const server = mod.server ?? mod["server"];
        // Locate the tool invocation function registered for "create-image"
        // Assume server.tool attaches handlers accessible via server._tools["create-image"]
        const handler = server?._tools?.["create-image"]?.handler || server?.tools?.["create-image"]?.handler;
        expect(typeof handler).toBe("function");
        const res = await handler({ prompt: "p", model: "gpt-image-1" }, {});
        expect(res).toEqual({
            content: [
                {
                    type: "image",
                    data: b64,
                    mimeType: "image/png",
                },
            ],
        });
    });
    test("auto-switches to file_output if base64 size > 1MB and no file_output provided", async () => {
        const { __setGeneratePayloads } = await Promise.resolve().then(() => __importStar(require("openai")));
        // Create a >1MB buffer
        const big = Buffer.alloc(1048577, 1).toString("base64");
        __setGeneratePayloads([{ b64_json: big }]);
        const server = mod.server ?? mod["server"];
        const handler = server?._tools?.["create-image"]?.handler || server?.tools?.["create-image"]?.handler;
        const res = await handler({ prompt: "p", model: "gpt-image-1" }, {});
        // Should respond with file:// path text
        const content = (res && res.content) || [];
        expect(Array.isArray(content)).toBe(true);
        expect(content[0].type).toBe("text");
        expect(content[0].text).toMatch(/^Image saved to: file:\/\//);
    });
    test("transparent background requires png or webp", async () => {
        const server = mod.server ?? mod["server"];
        const handler = server?._tools?.["create-image"]?.handler || server?.tools?.["create-image"]?.handler;
        await expect(handler({ prompt: "p", model: "gpt-image-1", background: "transparent", output_format: "jpeg" }, {}))
            .rejects.toThrow(/background.*png.*webp/i);
    });
    test("dall-e-3 with response_format=url returns URLs", async () => {
        const { __setGeneratePayloads } = await Promise.resolve().then(() => __importStar(require("openai")));
        __setGeneratePayloads([{ url: "https://example.com/image.png" }]);
        const server = mod.server ?? mod["server"];
        const handler = server?._tools?.["create-image"]?.handler || server?.tools?.["create-image"]?.handler;
        const res = await handler({ prompt: "p", model: "dall-e-3", response_format: "url" }, {});
        const lines = res.content.map((c) => c.text);
        expect(lines[0]).toMatch(/Generated image URL: https:\/\/example\.com\/image\.png/);
    });
});
describe("Handler: edit-image behavior", () => {
    test("rejects invalid image inputs not absolute or base64", async () => {
        const server = mod.server ?? mod["server"];
        const handler = server?._tools?.["edit-image"]?.handler || server?.tools?.["edit-image"]?.handler;
        await expect(handler({ image: "relative/path.png", prompt: "p" }, {}))
            .rejects.toThrow(/Invalid 'image' input/i);
    });
    test("writes multiple outputs with indexed filenames when n>1 and file_output chosen", async () => {
        const { __setEditPayloads } = await Promise.resolve().then(() => __importStar(require("openai")));
        const img = Buffer.from("payload").toString("base64");
        __setEditPayloads([{ b64_json: img }, { b64_json: img }]);
        const server = mod.server ?? mod["server"];
        const handler = server?._tools?.["edit-image"]?.handler || server?.tools?.["edit-image"]?.handler;
        const res = await handler({
            image: "/abs/in.png",
            prompt: "p",
            model: "gpt-image-1",
            output: "file_output",
            file_output: "/home/tester/Desktop/Generated_Images/out.png",
            n: 2,
        }, {});
        const out = res.content.map((c) => c.text);
        expect(out[0]).toMatch(/file:\/\/.*out_1\.png$/);
        expect(out[1]).toMatch(/file:\/\/.*out_2\.png$/);
    });
    test("dall-e-2 with response_format=url yields URL lines", async () => {
        const { __setEditPayloads } = await Promise.resolve().then(() => __importStar(require("openai")));
        __setEditPayloads([{ url: "https://example.com/edited.png" }]);
        const server = mod.server ?? mod["server"];
        const handler = server?._tools?.["edit-image"]?.handler || server?.tools?.["edit-image"]?.handler;
        const res = await handler({
            image: "/abs/in.png",
            prompt: "p",
            model: "dall-e-2",
            response_format: "url",
        }, {});
        expect(res.content[0].text).toMatch(/Edited image URL: https:\/\/example\.com\/edited\.png/);
    });
    test("auto-switch to file_output when base64 > 1MB and ensure .png extension retained", async () => {
        const { __setEditPayloads } = await Promise.resolve().then(() => __importStar(require("openai")));
        const big = Buffer.alloc(1048577, 1).toString("base64");
        __setEditPayloads([{ b64_json: big }]);
        const server = mod.server ?? mod["server"];
        const handler = server?._tools?.["edit-image"]?.handler || server?.tools?.["edit-image"]?.handler;
        const res = await handler({
            image: "/abs/in.png",
            prompt: "p",
            model: "gpt-image-1",
        }, {});
        expect(res.content[0].text).toMatch(/Image saved to: file:\/\/.*\.png$/);
    });
});
