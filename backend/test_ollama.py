from ollama_service import generate_text


prompt = """
Write a short LinkedIn post about a developer experimenting
with a local AI model. Keep it under 80 words.

Use natural language. Do not include placeholders, instructions,
or bracketed text. Do not invent specific project details.
"""

try:
    result = generate_text(prompt)
    print("\n--- Generated Content ---\n")
    print(result)
except Exception as error:
    print(f"Generation failed: {error}")
