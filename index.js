import express from "express";
import cors from "cors";
import multer from "multer";
import ExcelJS from "exceljs";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import csv from "csv-parser";
import path from "path";
import dotenv from "dotenv";
dotenv.config(); 
// 👇 Import Google GenAI SDK
import { FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
const APIKEY= process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: APIKEY , // Replace with your key
});



const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;

// ✅ Multer storage that keeps original extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // keep extension
    const filename = `${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({ storage });
const sessions = new Map(); // sessionId → context text

// 🧠 Convert Excel or CSV to structured text
async function fileToText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let text = "";

  if (ext === ".xlsx" || ext === ".xls") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    workbook.eachSheet((sheet) => {
      text += `Sheet: ${sheet.name}\n`;
      sheet.eachRow((row, rowIndex) => {
        const rowData = row.values.filter((v) => v !== undefined).join(" | ");
        text += `${rowIndex}: ${rowData}\n`;
      });
      text += "\n";
    });
  } else if (ext === ".csv") {
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => rows.push(data))
        .on("end", resolve)
        .on("error", reject);
    });
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      text += `CSV Headers: ${headers.join(" | ")}\n`;
      rows.forEach((row, i) => {
        const values = headers.map((h) => row[h]);
        text += `${i + 1}: ${values.join(" | ")}\n`;
      });
    } else {
      text += "CSV file appears empty.\n";
    }
  } else {
    throw new Error(
      "Unsupported file type. Please upload .xlsx, .xls, or .csv"
    );
  }

  return text.trim();
}

// 🚀 Routes

// Test server
app.get("/", (req, res) => {
  res.status(200).json({ message: "Server is alive" });
});

// Upload file
app.post("/upload-context", upload.single("excelFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded." });
    }

    const textData = await fileToText(req.file.path);
    const sessionId = uuidv4();
    sessions.set(sessionId, textData);
    fs.unlinkSync(req.file.path); // cleanup uploaded file

    res.json({
      success: true,
      sessionId,
      message: "File successfully processed and ready for querying.",
      next_step:
        "Use this sessionId and your question in the /query-gemini endpoint.",
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing file.",
      details: error.message,
    });
  }
});

// Query Gemini 2.5 using @google/genai
app.post("/query-gemini", async (req, res) => {
  try {
    const { sessionId, question } = req.body;
    if (!sessionId || !question)
      return res
        .status(400)
        .json({
          success: false,
          message: "sessionId and question are required.",
        });

    const context = sessions.get(sessionId);
    if (!context)
      return res
        .status(404)
        .json({ success: false, message: "Invalid or expired sessionId." });

    const prompt = `
You are a data analyst. Based only on the provided Excel or CSV data context, answer the user's question clearly.

Data Context:
${context}

User Question:
${question}
`;

    // ✅ Gemini 2.5 model call
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    res.json({ success: true, question, answer: response.text });
  } catch (error) {
    console.error("Gemini Query Error:", error);
    res.status(500).json({
      success: false,
      message: "Error querying Gemini API.",
      details: error.message,
    });
  }
});

app.get("/config", (req, res) => {
  res.json({ baseUrl: process.env.BASE_URL || "http://localhost:5000" });
});


// ✅ Single app.listen
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
