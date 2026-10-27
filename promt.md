## Security Review: Prompt Injection and AI Workflow Guardrails

Review my existing Content-to-Campaign Pipeline for prompt-injection vulnerabilities and basic application security risks.

**Important:** This is an existing portfolio project. Do not rebuild the architecture, introduce unnecessary services, or change working functionality without a clear reason.

### Review the actual implementation

Inspect the FastAPI backend, LLM prompt construction and generation flow, source-content handling, draft and revision persistence, approval workflow, Sent integration, environment configuration, and deployed API routes.

### 1. Prompt-injection protection

- Treat all source documents, pasted text, URLs, and user-supplied content as untrusted data.
- Review whether malicious instructions embedded in source content could override the intended content-generation task.
- Recommend clear separation between trusted application instructions and untrusted source material.
- Do not rely on prompt wording alone as a security boundary.
- Ensure the model cannot use source content to authorize actions or change application permissions.

### 2. Workflow and output integrity

- Confirm that the model cannot independently approve drafts or bypass the existing human approval workflow.
- Ensure external messaging or publishing actions are controlled by backend business logic, not model-generated instructions.
- Validate model output before storing or using it.
- Handle empty, malformed, unexpected, or excessively long responses safely.
- Preserve existing revision and approval behavior.

### 3. Secrets and API security

- Check that API keys and environment variables are not exposed to the frontend, prompts, logs, or API responses.
- Review authentication, authorization, rate limiting, input validation, CORS, and publicly accessible routes appropriate to the current deployment.
- Check that secrets and local database files are excluded from Git.
- Do not assume CORS or a hidden frontend URL provides access control.

### 4. Testing

Add focused tests for relevant risks, including:

- Source content containing prompt-injection instructions.
- Malformed model responses.
- Attempts to bypass approval through generated content.
- Oversized or invalid inputs.
- Regression tests confirming normal generation, saving revisions, approval, and Sent sandbox notifications still work.

Tests must not send real SMS messages or publish real content.

### Constraints

- Start by reporting findings and classifying them by severity.
- Distinguish confirmed vulnerabilities from potential risks.
- Propose the smallest practical fixes.
- Do not claim that prompt injection can be completely eliminated.
- Do not modify working code until you summarize the proposed changes and identify any behavior that could change.
- Keep the project suitable for a recruiter-facing portfolio demo.
