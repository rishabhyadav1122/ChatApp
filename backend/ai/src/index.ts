import "dotenv/config";
import { pathToFileURL } from "node:url";
import { app } from "./app.js";
import connectDb from "./config/db.js";

export { app };

export const startServer = async () => {
  await connectDb();
  const port = Number(process.env.PORT) || 5003;
  return new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`AI Service running on port ${port}`);
      resolve(server);
    });
    server.once("error", reject);
  });
};

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  startServer().catch((error) => {
    console.error("AI service failed to start", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  });
}
