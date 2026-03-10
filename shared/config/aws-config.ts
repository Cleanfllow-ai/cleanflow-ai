const getRequiredEnv = (name: string, value: string | undefined) => {
  if (!value) {
    if (typeof window === "undefined") {
      // During build time or SSR, we return an empty string to avoid breaking the build.
      // Next.js will bake the value into the static pages if it's NEXT_PUBLIC_
      // Warning: If this is missing in Vercel, auth will still fail at runtime.
      console.warn(`[Build Warning] Missing required environment variable: ${name}`);
      return "";
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const normalizeApiBaseUrl = (value: string | undefined) => {
  if (!value) return value
  return value.trim().replace(/\/+$/, "")
}

// AWS Configuration for CleanFlowAI
export const AWS_CONFIG = {
  // API Gateway
  API_BASE_URL: normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL),

  // AWS Cognito
  COGNITO: {
    USER_POOL_ID: getRequiredEnv(
      "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
    ),
    CLIENT_ID: getRequiredEnv(
      "NEXT_PUBLIC_COGNITO_CLIENT_ID",
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
    ),
    REGION: "ap-south-1",
  },

  // S3 Configuration
  S3: {
    BUCKET_NAME: process.env.NEXT_PUBLIC_S3_BUCKET_NAME,
    REGION: "ap-south-1",
  },

  // AWS Region
  AWS_REGION: "ap-south-1",

  // API Endpoints (matching backend exactly)
  ENDPOINTS: {
    // Authentication
    AUTH: "/auth",

    // Upload Management
    UPLOADS: "/uploads", // POST to init upload, GET to list uploads

    // File Processing
    FILES_PROCESS: (id: string) => `/files/${id}/process`, // POST to start processing
    FILES_STATUS: (id: string) => `/files/${id}/status`, // GET status
    FILES_EXPORT: (id: string, type: string, data: string) =>
      `/files/${id}/export?type=${type}&data=${data}`, // GET download
  },
};

// Demo mode configuration
export const DEMO_CONFIG = {
  ENABLED: false, // DISABLED - Connect to real AWS APIs
  DEMO_USERS: [
    { email: "demo@cleanflowai.com", password: "demo123" },
    { email: "test@example.com", password: "test123" },
  ],
};
