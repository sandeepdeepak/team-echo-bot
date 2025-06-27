import {
  CallClient,
  TeamsMeetingLinkLocator,
  LocalAudioStream,
  AudioOptions,
} from "@azure/communication-calling";

const token =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6IkRCQTFENTczNEY1MzM4QkRENjRGNjA4NjE2QTQ5NzFCOTEwNjU5QjAiLCJ4NXQiOiIyNkhWYzA5VE9MM1dUMkNHRnFTWEc1RUdXYkEiLCJ0eXAiOiJKV1QifQ.eyJza3lwZWlkIjoiYWNzOjBjM2U1OGJlLTRkNGQtNDM5Yy1iOGY4LTYyNDcwNzE3N2UzN18wMDAwMDAyOC01MTZmLTQ1YjYtN2RmNy0zYTNhMGQwMDUwOWUiLCJzY3AiOjE3OTIsImNzaSI6IjE3NTEwMzA1MzgiLCJleHAiOjE3NTExMTY5MzgsInJnbiI6ImFtZXIiLCJhY3NTY29wZSI6ImNoYXQsdm9pcCIsInJlc291cmNlSWQiOiIwYzNlNThiZS00ZDRkLTQzOWMtYjhmOC02MjQ3MDcxNzdlMzciLCJyZXNvdXJjZUxvY2F0aW9uIjoidW5pdGVkc3RhdGVzIiwiaWF0IjoxNzUxMDMwNTM4fQ.PKGnxJjjHbizZvGvwL99NlUPE7Nc3SCSpS4sgvO0B7g6Ix9p1iPGILE4VmeNNy8iENW3ST8tUqWPU_U05k3loanw_KgV9OzspxN6ml0o_1z8bW5lNQEUuh-j2C5Hd2z-Zn310fMloYEJfKU2s8KU45t5VHPg_Ktp4kne69cgTFizEByu6bDC61xL2FLfMZEq7r9d82nZgV9vw9xsxLI_feq7ruaX6ppy70wfxcUBtjoqUWL8by2_3mDUqPagz5BcO_pZEqxZqtcW8tDN3bAvzEuoVsNyCFxAwfPzgsqpwdp3vQvvXPLj3LQolWjYSu1IqKpKsy2sTI_qBqYaAosxdg"; // from server or portal
const meetingLink =
  "https://teams.microsoft.com/l/meetup-join/19%3ameeting_NmM0MzQ3MjAtOWYwMC00MjkwLTgzMjctM2M0MWQ4ZWE1ZGY5%40thread.v2/0?context=%7b%22Tid%22%3a%227f7268a4-7179-4a42-9837-40255b1c21e5%22%2c%22Oid%22%3a%22c9abdca6-7134-45d2-aae6-618a47cad1ff%22%7d"; // full URL

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
  const callAgent = await callClient.createCallAgent(tokenCredential, {
    displayName: "EchoBot",
  });

  const audioElement = document.getElementById("audioElement");
  await audioElement.play(); // start buffering

  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaElementSource(audioElement);
  const destination = audioContext.createMediaStreamDestination();
  sourceNode.connect(destination);
  sourceNode.connect(audioContext.destination); // optional: play locally too

  const localStream = new LocalAudioStream(destination.stream);
  const audioOptions = { localAudioStreams: [localStream] };

  const locator = { meetingLink };
  const call = await callAgent.join(locator, { audioOptions });

  console.log("Joined Teams call and streaming audio...");
}
