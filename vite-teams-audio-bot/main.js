import {
  CallClient,
  LocalAudioStream,
  Features,
} from "@azure/communication-calling";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

// 🔑 Global variables (make sure these are at module level)
let callAgent;
let activeCall;
let audioContext = null;
let remoteParticipantsAudio = new Map(); // Store remote participants' audio streams
let isCapturingAudio = false;
// let speechRecognizer = null; // For local microphone speech recognition (not needed)
let speechRecognizers = new Map(); // Map to store speech recognizers for each participant
let localAudioStream;

const token =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6IkRCQTFENTczNEY1MzM4QkRENjRGNjA4NjE2QTQ5NzFCOTEwNjU5QjAiLCJ4NXQiOiIyNkhWYzA5VE9MM1dUMkNHRnFTWEc1RUdXYkEiLCJ0eXAiOiJKV1QifQ.eyJza3lwZWlkIjoiYWNzOjBjM2U1OGJlLTRkNGQtNDM5Yy1iOGY4LTYyNDcwNzE3N2UzN18wMDAwMDAyOC01ZjY5LTc2OGQtMDJjMy01OTNhMGQwMGRlNDkiLCJzY3AiOjE3OTIsImNzaSI6IjE3NTEyNjUwMzgiLCJleHAiOjE3NTEzNTE0MzgsInJnbiI6ImFtZXIiLCJhY3NTY29wZSI6ImNoYXQsdm9pcCIsInJlc291cmNlSWQiOiIwYzNlNThiZS00ZDRkLTQzOWMtYjhmOC02MjQ3MDcxNzdlMzciLCJyZXNvdXJjZUxvY2F0aW9uIjoidW5pdGVkc3RhdGVzIiwiaWF0IjoxNzUxMjY1MDM4fQ.ucH4dHADUjYXsDyF3H3MgoY54dCVynkUyKNK_LTP6DsOUBgFgZlV2aTqFZFOrWDjwatp7RPKOop9RsPu0Ud50o_HeyEesZXE2zDjVUx_sRseIgik04SuYqEQEU5viRfAv89c-KXqdkZBKDCZaUWuFH96fRvf2gCPxU6muaoSwzoAlcCowwGX1hKzQQHU2rluSgqBj_Y9LKtO2EFI472ptKw09q6SFUvxJnWmAvwbgsaxxLRiPBqiooISljhuRwaYj1pygK7OsNcSCzrJvceb34EtiGvxSdkNST7ozl3uFFBybnc3lRffwsydx_zJoAq2DWbsU4wrtx7DyNScCDQWlA";
const meetingLink =
  "https://teams.microsoft.com/l/meetup-join/19%3ameeting_OWVhODk3NmItNDlhYy00M2M3LTk0YTYtMGQyMTZiZWY0ZWY0%40thread.v2/0?context=%7b%22Tid%22%3a%22f6002a3e-5bf9-42fd-85ba-f5e499d8efb0%22%2c%22Oid%22%3a%22af8c340f-bc9e-4ad1-a90a-c751bf29d898%22%7d";
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

  const audioContext = new AudioContext();
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

  // Set up captions feature
  try {
    const captionsFeature = activeCall.feature(Features.Captions);

    // Subscribe to captions events
    captionsFeature.captions.on("CaptionsReceived", (captionInfo) => {
      console.log("Caption received:", captionInfo);

      // Only process final captions, not partial ones
      if (captionInfo.resultType === "Final") {
        // Add the caption to the captions area
        const captionsArea = document.getElementById("captionsArea");
        const speakerName = captionInfo.speaker.displayName || "Unknown";

        // Display only the speaker name and spoken text for final captions
        captionsArea.value += `${speakerName}: ${captionInfo.spokenText}\n`;
        captionsArea.scrollTop = captionsArea.scrollHeight;
        if (captionInfo.speaker.displayName !== "EchoBot") {
          ws.send(
            JSON.stringify({
              meetingId: "demo123",
              transcriptText: captionInfo.spokenText,
            })
          );
        }
      }
    });

    // Store the captions feature for later use with the toggle button
    window.captionsFeature = captionsFeature;

    console.log("Captions feature initialized");
  } catch (error) {
    console.error("Error setting up captions feature:", error);
  }

  // Set up dominant speakers feature
  try {
    const dominantSpeakersFeature = activeCall.feature(
      Features.DominantSpeakers
    );

    // Subscribe to dominant speakers changes
    dominantSpeakersFeature.on("dominantSpeakersChanged", () => {
      const dominantSpeakers =
        dominantSpeakersFeature.dominantSpeakers.speakersList;
      if (dominantSpeakers.length > 0) {
        // The first speaker in the list is the most dominant
        const dominantSpeakerId = dominantSpeakers[0];

        // Find the participant with this ID
        const dominantParticipant = activeCall.remoteParticipants.find(
          (p) =>
            p.identifier.communicationUserId ===
            dominantSpeakerId.communicationUserId
        );

        if (dominantParticipant) {
          const participantId =
            dominantParticipant.identifier.communicationUserId;
          const speakerName = dominantParticipant.displayName || participantId;
          console.log(`Current dominant speaker: ${speakerName}`);

          // Add to transcription area
          const transcriptionArea =
            document.getElementById("transcriptionArea");
          const timestamp = new Date().toLocaleTimeString();
          transcriptionArea.value += `[${timestamp}] Current dominant speaker: ${speakerName}\n`;
          transcriptionArea.scrollTop = transcriptionArea.scrollHeight;

          // Store the current dominant speaker globally so we can use it for transcription
          window.currentDominantSpeaker = {
            participantId,
            speakerName,
          };

          // Check if we have any "unknown" audio streams that need to be associated with this participant
          for (const [id, data] of remoteParticipantsAudio.entries()) {
            // If this is a temporary ID (not a real participant ID)
            if (id.startsWith("stream-")) {
              console.log(
                `Associating stream ${id} with participant ${speakerName}`
              );

              // Create a new entry with the correct participant ID
              remoteParticipantsAudio.set(participantId, {
                stream: data.stream,
                audioElement: data.audioElement,
                participantName: speakerName,
                participant: dominantParticipant,
              });

              // Remove the temporary entry
              remoteParticipantsAudio.delete(id);

              // If we have a speech recognizer for this stream, update it
              if (speechRecognizers.has(id)) {
                const recognizer = speechRecognizers.get(id);
                speechRecognizers.delete(id);
                speechRecognizers.set(participantId, recognizer);
              }

              // Set up speech recognition for this participant if they're speaking
              if (
                dominantParticipant.isSpeaking &&
                !speechRecognizers.has(participantId)
              ) {
                setupSpeechRecognizerForParticipant(participantId, speakerName);
              }

              break; // Only associate one stream for now
            }
          }
        }
      }
    });

    console.log("Dominant speakers feature initialized");
  } catch (error) {
    console.error("Error setting up dominant speakers feature:", error);
  }

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
}

// Function to set up remote participant audio streams
function setupRemoteParticipant(participant) {
  console.log(
    "Setting up remote participant:",
    participant.displayName || "Unknown"
  );

  // Listen for speaking state changes
  participant.on("isSpeakingChanged", () => {
    const participantId = participant.identifier.communicationUserId;
    const participantName = participant.displayName || participantId;

    if (participant.isSpeaking) {
      console.log(`${participantName} started speaking`);

      // Update the current speaker
      window.currentSpeaker = {
        participantId,
        speakerName: participantName,
      };

      console.log(`Set current speaker to: ${participantName}`);

      // Add to transcription area
      const transcriptionArea = document.getElementById("transcriptionArea");
      const timestamp = new Date().toLocaleTimeString();
      transcriptionArea.value += `[${timestamp}] ${participantName} started speaking\n`;
      transcriptionArea.scrollTop = transcriptionArea.scrollHeight;

      // If we're capturing audio, make sure we're capturing from this participant
      if (isCapturingAudio) {
        // Check if we already have a speech recognizer for this participant
        if (!speechRecognizers.has(participantId)) {
          // Find the audio stream for this participant
          const audioStream = remoteParticipantsAudio.get(participantId);
          if (audioStream) {
            console.log(
              `Setting up speech recognition for active speaker: ${participantName}`
            );
            setupSpeechRecognizerForParticipant(participantId, participantName);
          }
        }
      }
    } else {
      console.log(`${participantName} stopped speaking`);
    }
  });

  // Set up event handler for streams
  participant.on("streamAdded", (e) => {
    console.log("Stream added");
    if (e.stream.mediaStreamType === "Audio") {
      const participantId = participant.identifier.communicationUserId;
      const participantName = participant.displayName || participantId;

      console.log(`Remote participant ${participantName} added audio stream`);

      // Store the stream for this participant
      remoteParticipantsAudio.set(participantId, {
        stream: e.stream,
        participant: participant,
        participantName: participantName,
      });

      // If we're currently capturing audio, start capturing from this participant
      if (isCapturingAudio) {
        captureParticipantAudio(participantId, e.stream, participant);
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

// Global variable to track captions state
let isCaptionsActive = false;

// Function to toggle captions on/off
window.toggleCaptions = async function () {
  if (!activeCall) {
    alert("Join the call first!");
    return;
  }

  const toggleButton = document.getElementById("toggleCaptionsBtn");

  if (!window.captionsFeature) {
    try {
      window.captionsFeature = activeCall.feature(Features.Captions);
    } catch (error) {
      console.error("Error getting captions feature:", error);
      alert("Failed to initialize captions feature");
      return;
    }
  }

  if (!isCaptionsActive) {
    // Start captions
    try {
      await window.captionsFeature.captions.startCaptions({
        spokenLanguage: "en-us",
      });
      isCaptionsActive = true;
      toggleButton.textContent = "Stop Captions";
      console.log("Captions started");
    } catch (error) {
      console.error("Error starting captions:", error);
      alert("Failed to start captions");
    }
  } else {
    // Stop captions
    try {
      await window.captionsFeature.captions.stopCaptions();
      isCaptionsActive = false;
      toggleButton.textContent = "Start Captions";
      console.log("Captions stopped");
    } catch (error) {
      console.error("Error stopping captions:", error);
      alert("Failed to stop captions");
    }
  }
};

// Function to test speech recognition directly
window.testSpeechRecognition = async function () {
  console.log("Testing speech recognition directly");

  try {
    // Create a speech config
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      speechKey,
      region
    );
    speechConfig.speechRecognitionLanguage = "en-US";

    // Use the default microphone for testing
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

    // Create the speech recognizer
    const testRecognizer = new SpeechSDK.SpeechRecognizer(
      speechConfig,
      audioConfig
    );

    // Add event handlers
    testRecognizer.recognizing = (s, e) => {
      console.log("TEST RECOGNIZING:", e.result.text);

      // Show partial results in the transcription area
      const transcriptionArea = document.getElementById("transcriptionArea");
      transcriptionArea.value += `[TEST RECOGNIZING] ${e.result.text}\n`;
      transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
    };

    testRecognizer.recognized = (s, e) => {
      console.log("TEST RECOGNIZED:", e.result.text);

      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        // Show final results in the transcription area
        const transcriptionArea = document.getElementById("transcriptionArea");
        const timestamp = new Date().toLocaleTimeString();
        transcriptionArea.value += `[${timestamp}] TEST: ${e.result.text}\n`;
        transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
      }
    };

    // Start continuous recognition
    await testRecognizer.startContinuousRecognitionAsync();

    console.log("Test speech recognition started - speak into your microphone");

    // Store the recognizer for later cleanup
    window.testRecognizer = testRecognizer;

    // Add a button to stop the test
    const transcriptionArea = document.getElementById("transcriptionArea");
    transcriptionArea.value +=
      "Speech recognition test started. Speak into your microphone.\n";
    transcriptionArea.value +=
      "Call window.stopTestSpeechRecognition() to stop the test.\n";
    transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
  } catch (error) {
    console.error("Error testing speech recognition:", error);
  }
};

// Function to stop the speech recognition test
window.stopTestSpeechRecognition = function () {
  if (window.testRecognizer) {
    window.testRecognizer.stopContinuousRecognitionAsync(
      () => {
        console.log("Test speech recognition stopped");
        window.testRecognizer.close();
        window.testRecognizer = null;

        const transcriptionArea = document.getElementById("transcriptionArea");
        transcriptionArea.value += "Speech recognition test stopped.\n";
        transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
      },
      (err) => {
        console.error("Error stopping test speech recognition:", err);
      }
    );
  }
};

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

  // Set up speech recognition for local microphone (not needed)
  // setupSpeechRecognition();

  console.log("Starting to capture audio from all participants");

  // Directly access remoteAudioStreams from the call object
  console.log(
    `Found ${activeCall.remoteAudioStreams.length} remote audio streams`
  );

  // Create a mapping of participants to their streams
  const participantStreamMap = new Map();

  // First, set up all participants with their IDs
  activeCall.remoteParticipants.forEach((participant) => {
    const participantId = participant.identifier.communicationUserId;
    participantStreamMap.set(participantId, {
      participant: participant,
      stream: null,
    });
  });

  // Process each remote audio stream
  activeCall.remoteAudioStreams.forEach((audioStream) => {
    console.log("Processing remote audio stream");

    // For now, we'll use the dominant speaker feature to determine who's speaking
    // and associate streams with participants as they speak

    // Create a generic audio capture for this stream
    // We'll use a unique ID for each stream
    const streamId = `stream-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    captureParticipantAudio(streamId, audioStream);
  });

  // Also set up listeners for any new streams that might be added
  activeCall.on("remoteAudioStreamsUpdated", (e) => {
    console.log(
      `Remote audio streams updated: ${e.added.length} added, ${e.removed.length} removed`
    );

    // Process newly added streams
    e.added.forEach((audioStream) => {
      // We'll create a unique ID for this stream since we don't know which participant it belongs to yet
      const streamId = `stream-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      if (isCapturingAudio) {
        // Capture the audio and wait for the dominant speakers feature to identify the speaker
        captureParticipantAudio(streamId, audioStream);
      }
    });

    // Handle removed streams
    e.removed.forEach((audioStream) => {
      // Find any entries in remoteParticipantsAudio that have this stream and remove them
      for (const [id, data] of remoteParticipantsAudio.entries()) {
        if (data.stream === audioStream) {
          console.log(
            `Removing audio stream for participant ${
              data.participantName || id
            }`
          );

          // Clean up the audio element
          if (data.audioElement) {
            document.body.removeChild(data.audioElement);
          }

          // Clean up the speech recognizer
          if (speechRecognizers.has(id)) {
            speechRecognizers.get(id).close();
            speechRecognizers.delete(id);
          }

          remoteParticipantsAudio.delete(id);
          break;
        }
      }
    });
  });

  console.log("Started capturing audio from all participants");
};

// Function to stop capturing audio
window.stopCapturingAudio = function () {
  if (!isCapturingAudio) {
    return;
  }

  isCapturingAudio = false;
  document.getElementById("captureStatus").textContent = "Capturing: Inactive";

  // Close all speech recognizers (local microphone - not needed)
  // if (speechRecognizer) {
  //   speechRecognizer.close();
  //   speechRecognizer = null;
  // }

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
function captureParticipantAudio(participantId, stream, participant = null) {
  console.log(`Capturing audio from participant ${participantId}`);
  if (!isCapturingAudio) return;

  try {
    console.log(`Starting to capture audio from participant ${participantId}`);

    // Get the participant's display name from the active call or from the participant object
    let participantName = "Unknown";
    if (participant) {
      participantName =
        participant.displayName || participantId.substring(0, 8);
    } else if (activeCall) {
      const foundParticipant = activeCall.remoteParticipants.find(
        (p) => p.identifier.communicationUserId === participantId
      );
      if (foundParticipant) {
        participantName =
          foundParticipant.displayName || participantId.substring(0, 8);
      }
    }

    // Create an HTML audio element to play the stream
    const audioElement = document.createElement("audio");
    audioElement.id = `participant-audio-${participantId}`;
    audioElement.autoplay = true;
    audioElement.muted = false; // We want to hear the audio
    document.body.appendChild(audioElement);

    // Subscribe to the stream - handle both RemoteAudioStream and other stream types
    if (stream && typeof stream.getMediaStream === "function") {
      // This is a RemoteAudioStream
      console.log("Using getMediaStream for RemoteAudioStream");
      stream
        .getMediaStream()
        .then((mediaStream) => {
          audioElement.srcObject = mediaStream;
          audioElement
            .play()
            .catch((err) => console.error("Error playing audio:", err));
        })
        .catch((err) => {
          console.error("Error getting media stream:", err);
        });
    } else if (stream && typeof stream.subscribe === "function") {
      // This is the stream from streamAdded event
      console.log("Using subscribe method for stream");
      stream.subscribe({
        audioElement: audioElement,
      });
    } else {
      console.error("Unknown stream type:", stream);
    }

    // Log that we're receiving audio
    console.log(
      `Successfully capturing audio from participant ${participantName}`
    );

    // Store the audio element and stream for cleanup and later use
    remoteParticipantsAudio.set(participantId, {
      stream,
      audioElement,
      participantName,
    });

    // Update the transcription area
    const transcriptionArea = document.getElementById("transcriptionArea");
    const timestamp = new Date().toLocaleTimeString();
    transcriptionArea.value += `[${timestamp}] Started capturing audio from participant ${participantName}\n`;
    transcriptionArea.scrollTop = transcriptionArea.scrollHeight;

    // Set up speech recognition for this participant if they're speaking
    if (participant && participant.isSpeaking) {
      setupSpeechRecognizerForParticipant(participantId, participantName);
    }
  } catch (error) {
    console.error(
      `Error capturing audio from participant ${participantId}:`,
      error
    );
  }
}

// Function to set up speech recognition for a specific participant
function setupSpeechRecognizerForParticipant(participantId, participantName) {
  try {
    console.log(
      `Setting up speech recognizer for participant ${participantName}`
    );

    // Get the audio element for this participant
    const data = remoteParticipantsAudio.get(participantId);
    if (!data || !data.audioElement) {
      console.error(
        `No audio element found for participant ${participantName}`
      );
      return;
    }

    const audioElement = data.audioElement;

    // Set up speech recognition
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      speechKey,
      region
    );
    speechConfig.speechRecognitionLanguage = "en-US";

    // Try to get the audio directly from the audio element
    let audioConfig;

    try {
      // First, try to get the MediaStream directly from the audio element
      if (
        audioElement.srcObject &&
        audioElement.srcObject instanceof MediaStream
      ) {
        console.log("Using srcObject MediaStream for speech recognition");
        audioConfig = SpeechSDK.AudioConfig.fromStreamInput(
          audioElement.srcObject
        );
      } else {
        // If that doesn't work, try to create a new audio context and capture the audio
        console.log("Creating new AudioContext for speech recognition");
        const audioCtx = new AudioContext();

        // Create a MediaStreamAudioSourceNode from the audio element
        const source = audioCtx.createMediaElementSource(audioElement);

        // Create a MediaStreamDestination to get a MediaStream
        const destination = audioCtx.createMediaStreamDestination();

        // Connect the source to both the destination and the audio context destination
        source.connect(destination);
        source.connect(audioCtx.destination); // So we can still hear it

        // Use the MediaStream from the destination for speech recognition
        audioConfig = SpeechSDK.AudioConfig.fromStreamInput(destination.stream);
      }
    } catch (error) {
      console.error("Error setting up audio for speech recognition:", error);

      // As a fallback, try to use the default microphone
      console.log("Falling back to default microphone for speech recognition");
      audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    }

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
      console.log("Speech recognition event received:", e);

      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const transcript = e.result.text;
        if (transcript && transcript.trim() !== "") {
          // Use the current speaker if available, otherwise use the participant name
          let speakerName = participantName;

          // Check if we have a current speaker
          if (window.currentSpeaker && window.currentSpeaker.speakerName) {
            speakerName = window.currentSpeaker.speakerName;
            console.log(`Using current speaker: ${speakerName} for transcript`);
          }

          console.log(`Recognized speech from ${speakerName}: ${transcript}`);

          ws.send(
            JSON.stringify({
              meetingId: "demo123",
              transcriptText: transcript,
            })
          );

          // Add the transcript to the transcription area with speaker name
          const transcriptionArea =
            document.getElementById("transcriptionArea");
          const timestamp = new Date().toLocaleTimeString();

          transcriptionArea.value += `[${timestamp}] ${speakerName}: ${transcript}\n`;
          transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
        }
      } else {
        console.log(`Speech recognition event with reason: ${e.result.reason}`);

        // Check for other result reasons
        if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
          console.log("No speech could be recognized");
        }
      }
    };

    // Also add an event handler for recognizing (partial results)
    participantRecognizer.recognizing = (s, e) => {
      console.log("Speech recognizing event received:", e);

      if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
        const transcript = e.result.text;
        if (transcript && transcript.trim() !== "") {
          // console.log(
          //   `Recognizing speech from ${participantName}: ${transcript}`
          // );
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
}

// Function to set up speech recognition for local microphone (not needed)
// function setupSpeechRecognition() {
//   try {
//     const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
//       speechKey,
//       region
//     );
//     speechConfig.speechRecognitionLanguage = "en-US";

//     // Create audio config for the recognizer
//     const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

//     // Create the speech recognizer
//     speechRecognizer = new SpeechSDK.SpeechRecognizer(
//       speechConfig,
//       audioConfig
//     );

//     // Start continuous recognition
//     speechRecognizer.startContinuousRecognitionAsync(
//       () => {
//         console.log("Speech recognition started for local microphone");
//       },
//       (err) => {
//         console.error("Error starting speech recognition:", err);
//         speechRecognizer = null;
//       }
//     );

//     // Event for recognized speech
//     speechRecognizer.recognized = (s, e) => {
//       console.log("Recognized speech from local microphone:", e.result);
//       if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
//         const transcript = e.result.text;
//         if (transcript && transcript.trim() !== "") {
//           console.log(`Recognized speech from local microphone: ${transcript}`);
//           ws.send(
//             JSON.stringify({
//               meetingId: "demo123",
//               transcriptText: transcript,
//             })
//           );

//           // Add the transcript to the transcription area with "Local" label
//           const transcriptionArea =
//             document.getElementById("transcriptionArea");
//           const timestamp = new Date().toLocaleTimeString();

//           // Format with CSS classes (note: we can't use HTML in textarea, but we'll keep the format consistent)
//           transcriptionArea.value += `[${timestamp}] Local: ${transcript}\n`;
//           transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
//         }
//       }
//     };
//   } catch (error) {
//     console.error("Error setting up speech recognition:", error);
//   }
// }
