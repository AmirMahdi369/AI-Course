
# chunk_summarizer.py

# Handles long-text summarization using  two-stage
# chunk-based approach:
#   1) Summarize each chunk
#   2) Re-summarize merged chunk summaries


from model import tokenizer, model
from preprocess import normalize_persian_text
import math


# Split text into overlapping token chunks
def split_to_chunks(text, max_tokens=450, overlap=50):
    # Tokenize full text
    tokens = tokenizer.encode(text)
    chunks = []

    # Sliding window over tokens
    start = 0
    while start < len(tokens):
        end = start + max_tokens
        chunk_tokens = tokens[start:end]

        # Decode tokens back to text for the model
        chunk_text = tokenizer.decode(chunk_tokens, skip_special_tokens=True)
        chunks.append(chunk_text)

        # Move window with overlap
        start += max_tokens - overlap

    return chunks


# Output length controller for different modes
def get_chunk_lengths(mode, input_len=None):
    """
    Returns:
    (chunk_min, chunk_max), (final_min, final_max)
    """

    if mode == "short":
        return (40, 80), (60, 120)

    elif mode == "medium":
        return (60, 120), (80, 180)

    elif mode == "long":
        return (80, 160), (120, 240)

    elif mode == "auto":
        # Auto mode scales summary length relative to input size
        if input_len is None:
            raise ValueError("input_len is required for auto mode")

        ratio = 0.25
        final_max = max(100, int(math.ceil(input_len * ratio)))
        final_min = max(60, int(final_max * 0.6))

        chunk_max = max(80, int(final_max / 2))
        chunk_min = max(40, int(chunk_max * 0.6))

        return (chunk_min, chunk_max), (final_min, final_max)

    else:
        raise ValueError("Invalid mode")


# Two-stage chunk-based summarization

def summarize_chunked(text, mode):
    """
    Stage 1: Summarize each chunk separately
    Stage 2: Summarize all chunk summaries into final output

    """

    # Normalize Persian text
    text = normalize_persian_text(text)

    # Split text into chunks
    chunks = split_to_chunks(text)

    intermediate_summaries = []

    # Total token count for auto mode
    total_tokens = len(tokenizer.encode(text))

    (chunk_min, chunk_max), (final_min, final_max) = get_chunk_lengths(
        mode, input_len=total_tokens
    )

    # -------- Stage 1: Chunk summaries --------
    for chunk in chunks:
        inputs = tokenizer(
            chunk,
            return_tensors="pt",
            truncation=True,
            max_length=512
        )

        summary_ids = model.generate(
            inputs["input_ids"],
            attention_mask=inputs["attention_mask"],
            min_length=chunk_min,
            max_length=chunk_max,
            num_beams=4,
            no_repeat_ngram_size=3,
            early_stopping=True
        )

        intermediate_summaries.append(
            tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        )

    # -------- Stage 2: Final summary --------
    merged_text = " ".join(intermediate_summaries)

    inputs = tokenizer(
        merged_text,
        return_tensors="pt",
        truncation=True,
        max_length=512
    )

    final_ids = model.generate(
        inputs["input_ids"],
        attention_mask=inputs["attention_mask"],
        min_length=final_min,
        max_length=final_max,
        num_beams=5,
        no_repeat_ngram_size=3,
        early_stopping=True
    )

    return tokenizer.decode(final_ids[0], skip_special_tokens=True)
