
import os
import logging
from pathlib import Path

import httpx
from dotenv import load_dotenv
from openai import OpenAI
from models import MAX_DRAFT_CONTENT_LENGTH


logger = logging.getLogger(__name__)


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


class ModelResponseError(ValueError):
    """The configured provider returned an unusable response."""


def validate_generated_text(content: object) -> str:
    if not isinstance(content, str):
        raise ModelResponseError("model output was not text")

    if not content.strip():
        raise ModelResponseError("model output was empty")

    if len(content) > MAX_DRAFT_CONTENT_LENGTH:
        raise ModelResponseError("model output exceeded the maximum length")

    if "\x00" in content or any(
        ord(character) < 32 and character not in "\n\r\t"
        for character in content
    ):
        raise ModelResponseError("model output contained invalid control characters")

    return content.strip()


def generate_text(instructions: str, reference_material: str) -> str:
    """Generate text from trusted instructions and untrusted reference data."""

    if AI_PROVIDER == "ollama":
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": (
                f"{instructions}\n\n"
                "<untrusted_reference_material>\n"
                f"{reference_material}\n"
                "</untrusted_reference_material>"
            ),
            "stream": False,
        }

        response = httpx.post(
            OLLAMA_URL,
            json=payload,
            timeout=180.0,
        )
        response.raise_for_status()

        result = response.json()
        if not isinstance(result, dict) or "response" not in result:
            raise ModelResponseError("provider response had an unexpected shape")
        return validate_generated_text(result["response"])

    if AI_PROVIDER == "openai":
        client = OpenAI()
        response = client.responses.create(
            model=OPENAI_MODEL,
            instructions=instructions,
            input=reference_material,
        )
        return validate_generated_text(getattr(response, "output_text", None))

    raise ValueError(
        f"Unsupported AI_PROVIDER: {AI_PROVIDER!r}. "
        "Choose 'ollama' or 'openai'."
    )
