import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import wavEncoder from "wav-encoder";

const polly = new PollyClient({ region: "us-east-1" });

export async function synthesizeSpeechToWavBuffer(text) {
  const command = new SynthesizeSpeechCommand({
    OutputFormat: "pcm", // raw
    Text: text,
    VoiceId: "Kajal",
    SampleRate: "16000",
    TextType: "text",
    Engine: "neural",
  });

  const response = await polly.send(command);
  const pcmBuffer = Buffer.from(
    await response.AudioStream.transformToByteArray()
  );

  // Convert to Float32Array required by wav-encoder
  const floatArray = new Float32Array(pcmBuffer.length / 2);
  for (let i = 0; i < floatArray.length; i++) {
    floatArray[i] = pcmBuffer.readInt16LE(i * 2) / 32768;
  }

  const audioData = {
    sampleRate: 16000,
    channelData: [floatArray],
  };

  const wavBuffer = await wavEncoder.encode(audioData);
  return Buffer.from(wavBuffer);
}
