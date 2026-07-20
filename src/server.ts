import app from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`Serveur demarre sur http://localhost:${env.port}`);
});
