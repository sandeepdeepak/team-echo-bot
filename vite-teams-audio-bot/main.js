import { CallClient, LocalAudioStream } from "@azure/communication-calling";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

// 🔑 Global variables (make sure these are at module level)
let callAgent;
let activeCall;
let audioContext = null;
let remoteParticipantsAudio = new Map(); // Store remote participants' audio streams
let isCapturingAudio = false;
let speechRecognizer = null; // For local microphone speech recognition
let speechRecognizers = new Map(); // Map to store speech recognizers for each participant
let localAudioStream;

const token =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6IkRCQTFENTczNEY1MzM4QkRENjRGNjA4NjE2QTQ5NzFCOTEwNjU5QjAiLCJ4NXQiOiIyNkhWYzA5VE9MM1dUMkNHRnFTWEc1RUdXYkEiLCJ0eXAiOiJKV1QifQ.eyJza3lwZWlkIjoiYWNzOjBjM2U1OGJlLTRkNGQtNDM5Yy1iOGY4LTYyNDcwNzE3N2UzN18wMDAwMDAyOC01MTZmLTQ1YjYtN2RmNy0zYTNhMGQwMDUwOWUiLCJzY3AiOjE3OTIsImNzaSI6IjE3NTEwMzA1MzgiLCJleHAiOjE3NTExMTY5MzgsInJnbiI6ImFtZXIiLCJhY3NTY29wZSI6ImNoYXQsdm9pcCIsInJlc291cmNlSWQiOiIwYzNlNThiZS00ZDRkLTQzOWMtYjhmOC02MjQ3MDcxNzdlMzciLCJyZXNvdXJjZUxvY2F0aW9uIjoidW5pdGVkc3RhdGVzIiwiaWF0IjoxNzUxMDMwNTM4fQ.PKGnxJjjHbizZvGvwL99NlUPE7Nc3SCSpS4sgvO0B7g6Ix9p1iPGILE4VmeNNy8iENW3ST8tUqWPU_U05k3loanw_KgV9OzspxN6ml0o_1z8bW5lNQEUuh-j2C5Hd2z-Zn310fMloYEJfKU2s8KU45t5VHPg_Ktp4kne69cgTFizEByu6bDC61xL2FLfMZEq7r9d82nZgV9vw9xsxLI_feq7ruaX6ppy70wfxcUBtjoqUWL8by2_3mDUqPagz5BcO_pZEqxZqtcW8tDN3bAvzEuoVsNyCFxAwfPzgsqpwdp3vQvvXPLj3LQolWjYSu1IqKpKsy2sTI_qBqYaAosxdg";
const meetingLink =
  "https://teams.microsoft.com/l/meetup-join/19%3ameeting_YmE1OWJlODAtMWY5OS00Y2Q5LWFlNjAtOTc1MmU0Y2I5NTU4%40thread.v2/0?context=%7b%22Tid%22%3a%22f6002a3e-5bf9-42fd-85ba-f5e499d8efb0%22%2c%22Oid%22%3a%22af8c340f-bc9e-4ad1-a90a-c751bf29d898%22%7d";
const speechKey =
  "Aaq8N0KEKKRSxm5bTm1fWXY7HfOsfObwehBmlIKQYxWxSSbsWqZvJQQJ99BFACYeBjFXJ3w3AAAYACOG4SsS";
const region = "eastus"; // e.g., "eastus"

const ws = new WebSocket("ws://localhost:3333");

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
    "https://innovation-sprint26.s3.us-east-1.amazonaws.com/ok-got-it.wav";

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

  localAudioStream = new LocalAudioStream(destination.stream);

  activeCall = await callAgent.join(
    { meetingLink }, // just a string here
    {
      audioOptions: { localAudioStreams: [localAudioStream] },
    }
  );

  console.log("Joined Teams meeting and playing audio.");

  // Set up event handlers for remote participants
  activeCall.on("remoteParticipantsUpdated", (e) => {
    // Handle participants joining
    e.added.forEach((participant) => {
      console.log(
        `Remote participant joined: ${participant.displayName || "Unknown"}`
      );
      setupRemoteParticipant(participant);
    });

    // Handle participants leaving
    e.removed.forEach((participant) => {
      console.log(
        `Remote participant left: ${participant.identifier.communicationUserId}`
      );
      remoteParticipantsAudio.delete(
        participant.identifier.communicationUserId
      );
    });
  });

  // Set up existing remote participants
  activeCall.remoteParticipants.forEach((participant) => {
    console.log(
      `Setting up existing remote participant: ${
        participant.displayName || "Unknown"
      }`
    );
    setupRemoteParticipant(participant);
  });

  ws.onopen = () => {
    console.log("WebSocket connected");
  };

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log("📥 Received from backend:", data);

    const audioElement = document.getElementById("ttsAudio");
    audioElement.src = data.s3Url;
    await new Promise((resolve, reject) => {
      audioElement.onplaying = () => resolve();
      audioElement.onerror = (e) => reject(e);
      audioElement.play().catch(reject);
    });
    const audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(audioElement);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    source.connect(audioContext.destination); // optional local playback
    localAudioStream = new LocalAudioStream(destination.stream);
  };
}

// Function to set up remote participant audio streams
function setupRemoteParticipant(participant) {
  // Set up event handler for streams
  participant.on("streamAdded", (e) => {
    if (e.stream.mediaStreamType === "Audio") {
      console.log(
        `Remote participant ${
          participant.displayName || "Unknown"
        } added audio stream`
      );

      // Store the stream for this participant
      remoteParticipantsAudio.set(
        participant.identifier.communicationUserId,
        e.stream
      );

      // If we're currently capturing audio, start capturing from this participant
      if (isCapturingAudio) {
        captureParticipantAudio(
          participant.identifier.communicationUserId,
          e.stream
        );
      }
    }
  });

  participant.on("streamRemoved", (e) => {
    if (e.stream.mediaStreamType === "Audio") {
      console.log(
        `Remote participant ${
          participant.displayName || "Unknown"
        } removed audio stream`
      );
      remoteParticipantsAudio.delete(
        participant.identifier.communicationUserId
      );
    }
  });
}

window.joinAndPlay = joinAndPlay;

// text to speech functionality

// Function to start capturing audio from all remote participants
window.startCapturingAudio = async function () {
  if (!activeCall) {
    alert("Join the call first!");
    return;
  }

  if (isCapturingAudio) {
    alert("Already capturing audio!");
    return;
  }

  isCapturingAudio = true;
  document.getElementById("captureStatus").textContent = "Capturing: Active";

  // Set up speech recognition
  setupSpeechRecognition();

  // Start capturing audio from all current participants
  for (const [participantId, stream] of remoteParticipantsAudio.entries()) {
    captureParticipantAudio(participantId, stream);
  }

  console.log("Started capturing audio from all participants");
};

// Function to stop capturing audio
window.stopCapturingAudio = function () {
  if (!isCapturingAudio) {
    return;
  }

  isCapturingAudio = false;
  document.getElementById("captureStatus").textContent = "Capturing: Inactive";

  // Close all speech recognizers
  if (speechRecognizer) {
    speechRecognizer.close();
    speechRecognizer = null;
  }

  // Close all participant-specific speech recognizers
  for (const [participantId, recognizer] of speechRecognizers.entries()) {
    recognizer.close();
    console.log(`Closed speech recognizer for participant ${participantId}`);
  }
  speechRecognizers.clear();

  // Clean up audio elements
  for (const [participantId, data] of remoteParticipantsAudio.entries()) {
    if (data.audioElement) {
      document.body.removeChild(data.audioElement);
    }
  }

  console.log("Stopped capturing audio");
};

// Function to capture and process audio from a specific participant
function captureParticipantAudio(participantId, stream) {
  if (!isCapturingAudio) return;

  try {
    console.log(`Starting to capture audio from participant ${participantId}`);

    // Create an HTML audio element to play the stream
    const audioElement = document.createElement("audio");
    audioElement.id = `participant-audio-${participantId}`;
    audioElement.autoplay = true;
    audioElement.muted = false; // We want to hear the audio
    document.body.appendChild(audioElement);

    // Subscribe to the stream
    stream.subscribe({
      audioElement: audioElement,
    });

    // Log that we're receiving audio
    console.log(
      `Successfully capturing audio from participant ${participantId}`
    );

    // Store the audio element for cleanup
    remoteParticipantsAudio.set(participantId, {
      stream,
      audioElement,
    });

    // Get the participant's display name from the active call
    let participantName = "Unknown";
    if (activeCall) {
      const participant = activeCall.remoteParticipants.find(
        (p) => p.identifier.communicationUserId === participantId
      );
      if (participant) {
        participantName =
          participant.displayName || participantId.substring(0, 8);
      }
    }

    // Set up speech recognition for this participant
    try {
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        speechKey,
        region
      );
      speechConfig.speechRecognitionLanguage = "en-US";

      // Create audio config from the audio element
      // Note: This is a workaround as we can't directly use the stream from ACS
      // In a production environment, you might need a different approach
      // Using default microphone as a fallback since we can't directly use the stream
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      // Create the speech recognizer for this participant
      const participantRecognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        audioConfig
      );

      // Start continuous recognition
      participantRecognizer.startContinuousRecognitionAsync(
        () => {
          console.log(
            `Speech recognition started for participant ${participantName}`
          );
        },
        (err) => {
          console.error(
            `Error starting speech recognition for participant ${participantName}:`,
            err
          );
        }
      );

      // Event for recognized speech
      participantRecognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const transcript = e.result.text;
          if (transcript && transcript.trim() !== "") {
            console.log(
              `Recognized speech from ${participantName}: ${transcript}`
            );

            // Add the transcript to the transcription area with participant name
            const transcriptionArea =
              document.getElementById("transcriptionArea");
            const timestamp = new Date().toLocaleTimeString();

            // Format with CSS classes (note: we can't use HTML in textarea, but we'll keep the format consistent)
            transcriptionArea.value += `[${timestamp}] ${participantName}: ${transcript}\n`;
            transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
          }
        }
      };

      // Store the recognizer for cleanup
      speechRecognizers.set(participantId, participantRecognizer);
    } catch (error) {
      console.error(
        `Error setting up speech recognition for participant ${participantName}:`,
        error
      );
    }

    // Update the transcription area
    const transcriptionArea = document.getElementById("transcriptionArea");
    const timestamp = new Date().toLocaleTimeString();
    transcriptionArea.value += `[${timestamp}] Started capturing audio from participant ${participantName}\n`;
    transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
  } catch (error) {
    console.error(
      `Error capturing audio from participant ${participantId}:`,
      error
    );
  }
}

// Function to set up speech recognition
function setupSpeechRecognition() {
  try {
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      speechKey,
      region
    );
    speechConfig.speechRecognitionLanguage = "en-US";

    // Create audio config for the recognizer
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

    // Create the speech recognizer
    speechRecognizer = new SpeechSDK.SpeechRecognizer(
      speechConfig,
      audioConfig
    );

    // Start continuous recognition
    speechRecognizer.startContinuousRecognitionAsync(
      () => {
        console.log("Speech recognition started for local microphone");
      },
      (err) => {
        console.error("Error starting speech recognition:", err);
        speechRecognizer = null;
      }
    );

    // Event for recognized speech
    speechRecognizer.recognized = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const transcript = e.result.text;
        if (transcript && transcript.trim() !== "") {
          console.log(`Recognized speech from local microphone: ${transcript}`);
          ws.send(
            JSON.stringify({
              meetingId: "demo123",
              transcriptText: transcript,
            })
          );

          // Add the transcript to the transcription area with "Local" label
          const transcriptionArea =
            document.getElementById("transcriptionArea");
          const timestamp = new Date().toLocaleTimeString();

          // Format with CSS classes (note: we can't use HTML in textarea, but we'll keep the format consistent)
          transcriptionArea.value += `[${timestamp}] Local: ${transcript}\n`;
          transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
        }
      }
    };
  } catch (error) {
    console.error("Error setting up speech recognition:", error);
  }
}

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
        const source = audioContext.createMediaElementSource(audio);
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
