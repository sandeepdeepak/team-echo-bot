import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { storeAudioToS3 } from "./storage.js";
import { synthesizeSpeechToWavBuffer } from "./speech.js";
import { handlePrompt } from "./integration.js";

dotenv.config();
const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const activeConnections = new Set();

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("📡 WebSocket client connected");
  activeConnections.add(ws);

  ws.on("message", async (message) => {
    try {
      const { transcriptText, meetingId } = JSON.parse(message.toString());
      const { summary, mode } = await handlePrompt(transcriptText);
      const audioBuffer = await synthesizeSpeechToWavBuffer(summary);
      const fileUrl = await storeAudioToS3(meetingId, audioBuffer);

      ws.send(JSON.stringify({ meetingId, s3Url: fileUrl }));
    } catch (error) {
      console.error("WebSocket processing error:", error);
      ws.send(JSON.stringify({ error: "Failed to process transcript." }));
    }
  });

  ws.on("close", () => {
    activeConnections.delete(ws);
    console.log("🔌 WebSocket client disconnected");
  });
});

// Optional: keep the REST route too
app.post("/transcript", async (req, res) => {
  const { transcriptText, meetingId } = req.body;
  const { summary, mode } = await handlePrompt(transcriptText);

  res.status(200).json({ message: "Processed successfully", mode, summary });
});

// Start HTTP + WebSocket server
const PORT = 3333;
server.listen(PORT, () =>
  console.log(`🚀 HTTP + WS server at http://localhost:${PORT}`)
);
