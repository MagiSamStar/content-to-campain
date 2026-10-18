
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from openai import OpenAI


# Load the backend's local .env before reading configuration.
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_PATH)

AI_PROVIDER = os.getenv("AI_PROVIDER", "ollama").lower()

OLLAMA_URL = os.getenv(
    "OLLAMA_URL",
    "http://localhost:11434/api/generate",
)
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:e4b")

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini")


def generate_text(prompt: str) -> str:
    """Generate text using the configured AI provider."""

    if AI_PROVIDER == "ollama":
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
        }

        response = httpx.post(
            OLLAMA_URL,
            json=payload,
            timeout=180.0,
        )
        response.raise_for_status()

        result = response.json()
        return result["response"].strip()

    if AI_PROVIDER == "openai":
        client = OpenAI()
        response = client.responses.create(
            model=OPENAI_MODEL,
            input=prompt,
        )
        return response.output_text.strip()

    raise ValueError(
        f"Unsupported AI_PROVIDER: {AI_PROVIDER!r}. "
        "Choose 'ollama' or 'openai'."
    )
