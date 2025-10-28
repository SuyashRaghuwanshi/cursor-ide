require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ API key not found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function main() {
  try {
    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash-preview-05-20", // ✅ use a valid one from your list
    });

    const result = await model.generateContent("hey");
    console.log("✅ Response:", result.response.text());
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
