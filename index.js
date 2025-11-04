require("dotenv").config();
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const {exec}= require("child_process");

// 🔧 Example tool implementation
function getWeatherInfo(city) {
  return `${city} weather is 42°C.`;
}

// 🧰 Tool registry (you can add more later)
const TOOLS_MAP = {
  getWeatherInfo: getWeatherInfo,
  weather_tool: getWeatherInfo,
  executeCommand: executeCommand,
  writeFile: writeFile,
};

function executeCommand(command) {
  // Prevent repeated mkdir errors
  if (command.startsWith("mkdir")) {
    const folderName = command.match(/["']?([^"']+)["']?$/)?.[1]; // extract name like todo app
    if (fs.existsSync(folderName)) {
      console.log(`⚠️ Folder "${folderName}" already exists. Skipping mkdir.`);
      return `Folder "${folderName}" already exists.`;
    }
  }

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout || "Command executed successfully");
      }
    });
  });
}
function writeFile({ path, content }) {
  return new Promise((resolve, reject) => {
    const dir = path.substring(0, path.lastIndexOf("/"));
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFile(path, content, (err) => {
      if (err) reject(err.message);
      else {
        console.log(`✅ File written: ${path}`);
        resolve(`File ${path} written successfully`);
      }
    });
  });
}
// 🧠 System prompt to enforce structured reasoning
const SYSTEM_PROMPT = `
You are a reasoning AI that outputs each step as JSON.
Each response must strictly be in this format:
{
  "step": "<think|action|observe|output>",
  "tool": "<optional tool name>",
  "input": "<optional tool input>",
  "content": "<description>"
}

Available tools:
- executeCommand(command: string): executes shell commands
- writeFile(path: string, content: string): creates or edits a file

Rules:
- Only output one step at a time.
- Never repeat the same mkdir or writeFile command if already done.
- If you finish reasoning, set step="output" with the final result.
- Always respond with valid JSON.
`;



const userMessage = "Create a folder todo app and inside it add index.html, style.css, and script.js for a basic working To-Do app.";


async function main() {
  try {
    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash-preview-05-20",
    });

    const messages = [
      {
        role: "user",
        parts: [{ text: `${SYSTEM_PROMPT}\nSTART: ${userMessage}` }],
      },
    ];

    while (true) {
      const result = await model.generateContent({ contents: messages });
      const text = result.response.text();
      console.log("🧠 Gemini:", text);

      // Safely parse the JSON
      let step;
      try {
        // Remove Markdown-style ```json ... ``` wrappers if present
        const cleanText = text
          .replace(/```json\s*/gi, "") // remove ```json
          .replace(/```/g, "")         // remove closing ```
          .trim();

        step = JSON.parse(cleanText);
      } catch (err) {
        console.error("⚠️ Invalid JSON output:", text);
        break;
      }

      // ✅ THINK step
      if (step.step === "think") {
        console.log("💭 Thinking:", step.content);
        messages.push({ role: "model", parts: [{ text }] });
        messages.push({ role: "user", parts: [{ text: "Continue next step" }] });
        continue;
      }

      // ⚙️ ACTION step
      // ⚙️ ACTION step
      if (step.step === "action") {
        const tool = step.tool;
        const input = step.input; // do NOT destructure or flatten

        console.log(`⚙️ Performing action: ${tool}(${JSON.stringify(input)})`);

        const toolFn = TOOLS_MAP[tool];
        if (!toolFn) {
          console.log(`🚫 Tool ${tool} not found.`);
          break;
        }

        // Pass the input directly — whether string or object
        const value = await toolFn(input);

        messages.push({ role: "user", parts: [{ text: `OBSERVE: ${value}` }] });
        messages.push({ role: "user", parts: [{ text: "Continue next step" }] });
        continue;
      }



      // 👁️ OBSERVE step (optional, handled automatically after action)
      if (step.step === "observe") {
        console.log("👁️ Observed:", step.content);
        messages.push({ role: "model", parts: [{ text }] });
        messages.push({ role: "user", parts: [{ text: "Continue next step" }] });
        continue;
      }

      // ✅ OUTPUT step
      if (step.step === "output") {
        console.log("✅ Final Output:", step.content);
        break;
      }

      // 🚫 Unknown step
      console.log("🚫 Unknown step:", step);
      break;
    }
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
