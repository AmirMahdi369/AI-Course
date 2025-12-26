
# model.py
# This module loads the Persian summarization model and tokenizer.
# It serves as the central NLP backbone shared across all other modules.
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM


# Define the model to use for Persian text summarization.
# Model: "m3hrdadfi/bert2bert-fa-wiki-summary"
# This transformer model is trained specifically on Persian Wikipedia data and designed for sequence‑to‑sequence summarization tasks.
MODEL_NAME = "m3hrdadfi/bert2bert-fa-wiki-summary"


# Load the tokenizer and model from Hugging Face Transformers.
# The tokenizer converts input Persian text into tokens usable by the model.
# The model generates the summarization output sequence.
# They are loaded here once and imported by other modules,
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
