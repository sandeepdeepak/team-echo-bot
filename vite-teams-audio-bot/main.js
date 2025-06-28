import { CallClient, LocalAudioStream } from "@azure/communication-calling";

// 🔑 Global variables (make sure these are at module level)
let callAgent;
let activeCall;
let audioContext = null;

const token = "";
const meetingLink = "";
const speechKey = "";
const region = ""; // e.g., "eastus"

export async function joinAndPlay() {
  const callClient = new CallClient();
  const deviceManager = await callClient.getDeviceManager();
  await deviceManager.askDevicePermission({ audio: true });

  const tokenCredential = {
    getToken: async () => ({
      token,
      expiresOnTimestamp: Date.now() + 3600 * 1000,
    }),
  };

  callAgent = await callClient.createCallAgent(tokenCredential, {
    displayName: "EchoBot",
  });

  const audioElement = document.getElementById("ttsAudio");
  audioElement.src =
    "https://innovation-sprint26.s3.us-east-1.amazonaws.com/audio.wav";

  await new Promise((resolve, reject) => {
    audioElement.onplaying = () => resolve();
    audioElement.onerror = (e) => reject(e);
    audioElement.play().catch(reject);
  });

  audioContext = new AudioContext();
  const source = audioContext.createMediaElementSource(audioElement);
  const destination = audioContext.createMediaStreamDestination();
  source.connect(destination);
  source.connect(audioContext.destination); // optional local playback

  const localAudioStream = new LocalAudioStream(destination.stream);

  activeCall = await callAgent.join(
    { meetingLink }, // just a string here
    {
      audioOptions: { localAudioStreams: [localAudioStream] },
    }
  );

  console.log("Joined Teams meeting and playing audio.");
}

window.joinAndPlay = joinAndPlay;

// text to speech functionality
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

window.speakAndInject = async function () {
  const text = document.getElementById("textInput").value;
  if (!activeCall) return alert("Join the call first!");
  if (!text) return alert("Enter text to speak!");

  const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
    speechKey,
    region
  );
  speechConfig.speechSynthesisOutputFormat =
    SpeechSDK.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;

  const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
  synthesizer.speakTextAsync(
    text,
    async (result) => {
      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        const blob = new Blob([result.audioData], { type: "audio/wav" });

        const url = URL.createObjectURL(blob);
        const audio = document.getElementById("ttsAudio");
        audio.src =
          "https://innovation-sprint26.s3.us-east-1.amazonaws.com/audio.wav";

        // await new Promise((resolve, reject) => {
        //   audio.onplaying = () => resolve();
        //   audio.onerror = (e) => reject(e);
        //   audio.play().catch(reject);
        // });

        // console.log("Audio playback started");

        // // Wait for audio to fully end so track is definitely "live"
        // await new Promise((resolve) => {
        //   audio.onended = () => resolve();
        // });

        // await new Promise((r) => setTimeout(r, 1000));
        // console.log("Waited 1 second after end");

        console.log("Audio playback ended");

        // const stream = audio.captureStream();
        // const [track] = stream.getAudioTracks();

        // if (!track || track.readyState !== "live") {
        //   console.error("Track still not live:", track);
        //   return;
        // }

        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(audioElement);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        source.connect(audioContext.destination); // optional local playback

        const localAudioStream = new LocalAudioStream(destination.stream);

        try {
          await activeCall.startAudio({
            localAudioStreams: [localAudioStream],
          });
          console.log("✅ Injected full audio stream into Teams call.");
        } catch (err) {
          console.error("❌ Error injecting TTS audio:", err);
        }
      } else {
        console.error("TTS synthesis failed:", result.reason);
      }
      synthesizer.close();
    },
    (err) => {
      console.error("Speech SDK error:", err);
      synthesizer.close();
    }
  );
};
