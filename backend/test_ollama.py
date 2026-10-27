import unittest
from types import SimpleNamespace
from unittest.mock import patch

import ollama_service
from ollama_service import ModelResponseError, generate_text, validate_generated_text


class OpenAIProviderTests(unittest.TestCase):
    @patch.object(ollama_service, "AI_PROVIDER", "openai")
    @patch.object(ollama_service, "OPENAI_MODEL", "test-model")
    @patch.object(ollama_service, "OpenAI")
    def test_openai_responses_api_is_parsed_without_network(self, openai_class):
        response = SimpleNamespace(output_text="A safe draft")
        openai_class.return_value.responses.create.return_value = response

        result = generate_text("trusted instructions", '{"source": "reference"}')

        self.assertEqual(result, "A safe draft")
        openai_class.return_value.responses.create.assert_called_once_with(
            model="test-model",
            instructions="trusted instructions",
            input='{"source": "reference"}',
        )

    @patch.object(ollama_service, "AI_PROVIDER", "openai")
    @patch.object(ollama_service, "OpenAI")
    def test_malformed_openai_output_is_rejected(self, openai_class):
        openai_class.return_value.responses.create.return_value = SimpleNamespace(
            output_text=None
        )

        with self.assertRaises(ModelResponseError):
            generate_text("trusted instructions", "reference")

    def test_invalid_text_is_rejected(self):
        with self.assertRaises(ModelResponseError):
            validate_generated_text("bad\x00content")


if __name__ == "__main__":
    unittest.main()
