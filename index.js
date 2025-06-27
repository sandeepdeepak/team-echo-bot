require("dotenv").config();
const express = require("express");
const {
  CallAutomationClient,
  FileSource,
} = require("@azure/communication-call-automation");
const {
  CommunicationIdentityClient,
} = require("@azure/communication-identity");

const app = express();
app.use(express.json());

const { ACS_CONNECTION_STRING, TEAMS_MEETING_LINK, CALLBACK_URL, AUDIO_URL } =
  process.env;

const port = process.env.PORT || 3000;

const callClient = new CallAutomationClient(ACS_CONNECTION_STRING);

// Endpoint to trigger call + audio play
app.post("/start", async (req, res) => {
  try {
    const identityClient = new CommunicationIdentityClient(
      ACS_CONNECTION_STRING
    );
    const user = await identityClient.createUser();

    const joinOptions = {
      sourceIdentity: user.communicationUserId,
      meetingLink: TEAMS_MEETING_LINK,
      callbackUri: CALLBACK_URL,
    };

    const joinResult = await callClient.joinCallWithMeetingLink(joinOptions);
    const callConnection = joinResult.callConnection;

    console.log("Joined call:", callConnection.callConnectionId);

    setTimeout(async () => {
      try {
        await callConnection.playAudio({
          audioFileUri: AUDIO_URL,
          loop: false,
        });
        console.log("Playing audio into Teams meeting");
      } catch (audioError) {
        console.error("Error during audio play:", audioError);
      }
    }, 8000);

    res.status(200).send("Bot joined and audio will play");
  } catch (joinError) {
    console.error("Join error:", joinError);
    res.status(500).send("Failed to join or play audio");
  }
});

// Dummy callback endpoint for ACS events
app.post("/events", (req, res) => {
  console.log("ACS Event:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// Serve audio file
app.use("/public", express.static("public"));

app.listen(port, () => {
  console.log(`Bot running at http://localhost:${port}`);
});
