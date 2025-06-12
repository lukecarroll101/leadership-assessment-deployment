import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { Pool } from "pg";
import { EncryptionService } from "./utils/encryption";
import crypto from "crypto";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Custom logging middleware
const requestLogger = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - Query:`, req.query);
  next();
};

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// Apply request logging middleware
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());

console.log("DATABASE_URL", process.env.DATABASE_URL);

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize encryption service
const encryption = new EncryptionService(process.env.ENCRYPTION_KEY!);

// Middleware to validate encrypted token
const validateToken = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const token = req.query.token as string;

  if (!token) {
    return res.status(400).json({ error: "Missing token parameter" });
  }

  try {
    const decrypted = encryption.decrypt(token);
    req.body.decryptedToken = decrypted;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Admin middleware to protect data viewing endpoints
const adminAuth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Helper function to create deterministic hash of leader data
const createLeaderHash = (leaderData: any): string => {
  const sortedData = JSON.stringify(leaderData, Object.keys(leaderData).sort());
  return crypto.createHash("sha256").update(sortedData).digest("hex");
};

// Routes
app.post("/api/assessment/start", validateToken, async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting new assessment`);
  console.log("req.body", req.body);

  try {
    const { role } = req.body.decryptedToken;
    const { encrypted_leader_identifier, encrypted_rater_identifier } =
      req.body;

    // Decrypt leader data to create hash
    const leaderData = encryption.decrypt(encrypted_leader_identifier);
    const leaderHash = createLeaderHash(leaderData);

    console.log(`[${timestamp}] Creating assessment for role: ${role}`);

    const result = await pool.query(
      "INSERT INTO assessments (encrypted_leader_identifier, encrypted_rater_identifier, leader_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
      [
        encrypted_leader_identifier,
        encrypted_rater_identifier,
        leaderHash,
        role,
      ]
    );

    res.json({ assessmentId: result.rows[0].id });
  } catch (error) {
    console.error(`[${timestamp}] Error starting assessment:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/assessment/submit", validateToken, async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Submitting assessment responses`);

  try {
    const { assessmentId, responses } = req.body;

    // Start a transaction
    const client = await pool.connect();
    try {
      console.log(`[${timestamp}] Starting database transaction`);
      await client.query("BEGIN");

      // Update assessment completion
      await client.query(
        "UPDATE assessments SET completed_at = CURRENT_TIMESTAMP WHERE id = $1",
        [assessmentId]
      );

      // Insert responses
      console.log(`[${timestamp}] Inserting ${responses.length} responses`);
      for (const response of responses) {
        // Encrypt open-ended responses
        let responseValue = response.response;
        if (response.questionId.startsWith("open_")) {
          responseValue = encryption.encrypt(response.response);
        }

        await client.query(
          "INSERT INTO assessment_responses (assessment_id, question_id, response) VALUES ($1, $2, $3)",
          [assessmentId, response.questionId, responseValue]
        );
      }

      await client.query("COMMIT");
      console.log(`[${timestamp}] Transaction committed successfully`);
      res.json({ success: true });
    } catch (error) {
      console.error(`[${timestamp}] Error in transaction:`, error);
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[${timestamp}] Error submitting assessment:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Routes for viewing assessment data
app.get("/api/admin/assessments", adminAuth, async (req, res) => {
  const timestamp = new Date().toISOString();

  try {
    const result = await pool.query(`
      SELECT 
        a.id,
        a.encrypted_leader_identifier,
        a.encrypted_rater_identifier,
        a.leader_hash,
        a.role,
        a.created_at,
        a.updated_at,
        a.completed_at,
        json_agg(
          json_build_object(
            'question_id', ar.question_id,
            'response', ar.response,
            'created_at', ar.created_at
          )
        ) as responses
      FROM assessments a
      LEFT JOIN assessment_responses ar ON a.id = ar.assessment_id
      GROUP BY a.id, a.encrypted_leader_identifier, a.encrypted_rater_identifier, a.leader_hash, a.role, a.created_at, a.updated_at, a.completed_at
      ORDER BY a.created_at DESC
    `);

    // Transform the response to handle null responses array and decrypt identifiers
    const transformedResult = result.rows.map((row) => {
      let decryptedLeaderIdentifier;
      let decryptedRaterIdentifier;
      try {
        decryptedLeaderIdentifier = encryption.decrypt(
          row.encrypted_leader_identifier
        );
        decryptedRaterIdentifier = encryption.decrypt(
          row.encrypted_rater_identifier
        );
      } catch (error) {
        console.error(
          `[${timestamp}] Error decrypting identifiers for assessment ${row.id}:`,
          error
        );
        decryptedLeaderIdentifier = "DECRYPTION_ERROR";
        decryptedRaterIdentifier = "DECRYPTION_ERROR";
      }

      // Process responses to decrypt open-ended responses
      const processedResponses =
        row.responses[0] === null
          ? []
          : row.responses.map((response: any) => {
              if (
                response.question_id &&
                response.question_id.startsWith("open_")
              ) {
                try {
                  return {
                    ...response,
                    response: encryption.decrypt(response.response),
                  };
                } catch (error) {
                  console.error(
                    `[${timestamp}] Error decrypting response for question ${response.question_id}:`,
                    error
                  );
                  return {
                    ...response,
                    response: "DECRYPTION_ERROR",
                  };
                }
              }
              return response;
            });

      return {
        ...row,
        encrypted_leader_identifier: decryptedLeaderIdentifier,
        encrypted_rater_identifier: decryptedRaterIdentifier,
        responses: processedResponses,
      };
    });

    res.json(transformedResult);
  } catch (error) {
    console.error(`[${timestamp}] Error fetching assessments:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/admin/assessments/:id", adminAuth, async (req, res) => {
  const timestamp = new Date().toISOString();
  const assessmentId = req.params.id;
  console.log(`[${timestamp}] Fetching assessment ${assessmentId}`);

  try {
    // Get assessment details
    const assessmentResult = await pool.query(
      "SELECT * FROM assessments WHERE id = $1",
      [assessmentId]
    );

    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Get assessment responses
    const responsesResult = await pool.query(
      "SELECT * FROM assessment_responses WHERE assessment_id = $1 ORDER BY question_id",
      [assessmentId]
    );

    const assessment = assessmentResult.rows[0];

    // Process responses to decrypt open-ended responses
    assessment.responses = responsesResult.rows.map((response: any) => {
      if (response.question_id && response.question_id.startsWith("open_")) {
        try {
          return {
            ...response,
            response: encryption.decrypt(response.response),
          };
        } catch (error) {
          console.error(
            `[${timestamp}] Error decrypting response for question ${response.question_id}:`,
            error
          );
          return {
            ...response,
            response: "DECRYPTION_ERROR",
          };
        }
      }
      return response;
    });

    console.log(
      `[${timestamp}] Successfully fetched assessment ${assessmentId}`
    );
    res.json(assessment);
  } catch (error) {
    console.error(`[${timestamp}] Error fetching assessment:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/admin/statistics", adminAuth, async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Fetching assessment statistics`);

  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_assessments,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_assessments,
        COUNT(CASE WHEN role = 'leader' THEN 1 END) as leader_assessments,
        COUNT(CASE WHEN role = 'rater' THEN 1 END) as rater_assessments,
        AVG(CASE WHEN role = 'leader' THEN 1 ELSE 0 END) * 100 as leader_percentage,
        AVG(CASE WHEN role = 'rater' THEN 1 ELSE 0 END) * 100 as rater_percentage
      FROM assessments
    `);

    const responseStats = await pool.query(`
      SELECT 
        question_id,
        AVG(CAST(response AS FLOAT)) as average_rating,
        COUNT(*) as response_count
      FROM assessment_responses
      GROUP BY question_id
      ORDER BY question_id
    `);

    console.log(`[${timestamp}] Successfully fetched statistics`);
    res.json({
      assessment_stats: stats.rows[0],
      response_stats: responseStats.rows,
    });
  } catch (error) {
    console.error(`[${timestamp}] Error fetching statistics:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get(
  "/api/admin/leader-assessments/:leader",
  adminAuth,
  async (req, res) => {
    const timestamp = new Date().toISOString();
    const leaderToken = req.params.leader;
    console.log(`[${timestamp}] Fetching assessments for leader`);

    try {
      // Decrypt leader data and create hash for efficient querying
      // console.log("leader token decrypting");
      const leaderData = encryption.decrypt(leaderToken);
      // console.log("leaderData", leaderData);
      const leaderHash = createLeaderHash(leaderData);
      // console.log("leaderHash", leaderHash);

      // Query assessments using leader hash for efficiency
      console.log("querying assessments");
      const result = await pool.query(
        `
      SELECT 
        a.id,
        a.encrypted_leader_identifier,
        a.encrypted_rater_identifier,
        a.leader_hash,
        a.role,
        a.created_at,
        a.updated_at,
        a.completed_at,
        json_agg(
          json_build_object(
            'question_id', ar.question_id,
            'response', ar.response,
            'created_at', ar.created_at
          )
        ) as responses
      FROM assessments a
      LEFT JOIN assessment_responses ar ON a.id = ar.assessment_id
      WHERE a.leader_hash = $1
      GROUP BY a.id, a.encrypted_leader_identifier, a.encrypted_rater_identifier, a.leader_hash, a.role, a.created_at, a.updated_at, a.completed_at
      ORDER BY a.created_at DESC
    `,
        [leaderHash]
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "No assessments found for this leader" });
      }

      // Transform the response to decrypt identifiers and responses
      const transformedResult = result.rows.map((row) => {
        let decryptedLeaderIdentifier;
        let decryptedRaterIdentifier;
        try {
          decryptedLeaderIdentifier = encryption.decrypt(
            row.encrypted_leader_identifier
          );
          decryptedRaterIdentifier = encryption.decrypt(
            row.encrypted_rater_identifier
          );
        } catch (error) {
          console.error(
            `[${timestamp}] Error decrypting identifiers for assessment ${row.id}:`,
            error
          );
          decryptedLeaderIdentifier = "DECRYPTION_ERROR";
          decryptedRaterIdentifier = "DECRYPTION_ERROR";
        }

        // Process responses to decrypt open-ended responses
        const processedResponses =
          row.responses[0] === null
            ? []
            : row.responses.map((response: any) => {
                if (
                  response.question_id &&
                  response.question_id.startsWith("open_")
                ) {
                  try {
                    return {
                      ...response,
                      response: encryption.decrypt(response.response),
                    };
                  } catch (error) {
                    console.error(
                      `[${timestamp}] Error decrypting response for question ${response.question_id}:`,
                      error
                    );
                    return {
                      ...response,
                      response: "DECRYPTION_ERROR",
                    };
                  }
                }
                return response;
              });

        return {
          ...row,
          leader_info: decryptedLeaderIdentifier,
          rater_info: decryptedRaterIdentifier,
          responses: processedResponses,
        };
      });

      console.log(
        `[${timestamp}] Successfully fetched ${result.rows.length} assessments for leader`
      );
      // console.log("transformedResult", transformedResult);
      res.json(transformedResult);
    } catch (error) {
      console.error(`[${timestamp}] Error fetching leader assessments:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Health check endpoint
app.get("/health", (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Health check requested`);
  res.json({ status: "healthy" });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Server started on port ${PORT}`);
});
