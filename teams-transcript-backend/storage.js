import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({ region: "us-east-1" });
const bucketName = "innovation-sprint26";

export async function storeAudioToS3(meetingId, audioBuffer) {
  const key = `speech-${meetingId}-${uuidv4()}.wav`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: audioBuffer,
    ContentType: "audio/wav",
  });

  await s3.send(command);
  return `https://${bucketName}.s3.amazonaws.com/${key}`;
}
