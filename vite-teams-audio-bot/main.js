import { CallClient, LocalAudioStream } from "@azure/communication-calling";

// 🔑 Global variables (make sure these are at module level)
let callAgent;
let activeCall;
let audioContext = null;

const token =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6IkRCQTFENTczNEY1MzM4QkRENjRGNjA4NjE2QTQ5NzFCOTEwNjU5QjAiLCJ4NXQiOiIyNkhWYzA5VE9MM1dUMkNHRnFTWEc1RUdXYkEiLCJ0eXAiOiJKV1QifQ.eyJza3lwZWlkIjoiYWNzOjBjM2U1OGJlLTRkNGQtNDM5Yy1iOGY4LTYyNDcwNzE3N2UzN18wMDAwMDAyOC01MTZmLTQ1YjYtN2RmNy0zYTNhMGQwMDUwOWUiLCJzY3AiOjE3OTIsImNzaSI6IjE3NTEwMzA1MzgiLCJleHAiOjE3NTExMTY5MzgsInJnbiI6ImFtZXIiLCJhY3NTY29wZSI6ImNoYXQsdm9pcCIsInJlc291cmNlSWQiOiIwYzNlNThiZS00ZDRkLTQzOWMtYjhmOC02MjQ3MDcxNzdlMzciLCJyZXNvdXJjZUxvY2F0aW9uIjoidW5pdGVkc3RhdGVzIiwiaWF0IjoxNzUxMDMwNTM4fQ.PKGnxJjjHbizZvGvwL99NlUPE7Nc3SCSpS4sgvO0B7g6Ix9p1iPGILE4VmeNNy8iENW3ST8tUqWPU_U05k3loanw_KgV9OzspxN6ml0o_1z8bW5lNQEUuh-j2C5Hd2z-Zn310fMloYEJfKU2s8KU45t5VHPg_Ktp4kne69cgTFizEByu6bDC61xL2FLfMZEq7r9d82nZgV9vw9xsxLI_feq7ruaX6ppy70wfxcUBtjoqUWL8by2_3mDUqPagz5BcO_pZEqxZqtcW8tDN3bAvzEuoVsNyCFxAwfPzgsqpwdp3vQvvXPLj3LQolWjYSu1IqKpKsy2sTI_qBqYaAosxdg";
const meetingLink =
  "https://teams.microsoft.com/l/meetup-join/19%3ameeting_YmE1OWJlODAtMWY5OS00Y2Q5LWFlNjAtOTc1MmU0Y2I5NTU4%40thread.v2/0?context=%7b%22Tid%22%3a%22f6002a3e-5bf9-42fd-85ba-f5e499d8efb0%22%2c%22Oid%22%3a%22af8c340f-bc9e-4ad1-a90a-c751bf29d898%22%7d";
const speechKey =
  "Aaq8N0KEKKRSxm5bTm1fWXY7HfOsfObwehBmlIKQYxWxSSbsWqZvJQQJ99BFACYeBjFXJ3w3AAAYACOG4SsS";
const region = "eastus"; // e.g., "eastus"

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
