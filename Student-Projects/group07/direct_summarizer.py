# direct_summarizer.py

# Single-pass summarization for short Persian texts.

# This module handles: Direct (non-chunked) summarization
# Routing logic (short vs long) is handled

import math
# Import shared model and tokenizer (loaded once globally)
from model import tokenizer, model
# Import Persian preprocessing utilities
from preprocess import normalize_persian_text


# Direct (Single‑Pass) Summarization Function
def summarize_direct(text, mode):
    """
    Perform direct summarization for short texts.

    Parameters
    ----------
    text : str
        Input Persian text.
    mode : str
        Controls the output summary length:
            - "short"  : very concise summary
            - "medium" : balanced summary
            - "long"   : more detailed summary
            - "auto"   : summary length determined adaptively based on input size

    """

#  Persian preprocessing
    text = normalize_persian_text(text)

    # Tokenization
    # The input is truncated to 512 tokens to match the model limit.
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512
    )

    input_len = inputs["input_ids"].shape[1]

    # Summary length configuration based on mode
    if mode == "short":
        min_len, max_len = 40, 80

    elif mode == "medium":
        min_len, max_len = 70, 160

    elif mode == "long":
        min_len, max_len = 120, 220

    elif mode == "auto":
        # Generate a summary approximately 25% of the input length
        ratio = 0.25
        max_len = max(60, int(math.ceil(input_len * ratio)))
        min_len = max(30, int(max_len * 0.6))

    else:
        raise ValueError("Invalid mode! Choose: short | medium | long | auto")

    # Summary generation using beam search decoding
    summary_ids = model.generate(
        inputs["input_ids"],
        attention_mask=inputs["attention_mask"],
        min_length=min_len,
        max_length=max_len,
        num_beams=5,
        no_repeat_ngram_size=3,
        early_stopping=True
    )

    # Decode token IDs into readable Persian text
    summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
    return summary
