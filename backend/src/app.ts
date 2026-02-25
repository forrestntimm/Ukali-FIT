import "express-async-errors";
import express from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { errorHandler } from "./middleware/error";
import { config } from "./utils/config";

const app = express();

app.use(helmet());
const corsOptions: CorsOptions = {
  credentials: true,
  origin: (origin, callback) => {
    // Allow server-to-server and health-check requests with no origin header.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (config.corsOrigins.includes("*") || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  }
};

app.use(cors(corsOptions));
app.use(morgan("combined"));

// Stripe webhooks require raw body
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api", routes);

app.use(errorHandler);

export default app;
