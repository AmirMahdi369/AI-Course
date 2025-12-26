# length_router.py
# This module is responsible for making a lightweight routing decision based on token length.
# It determines whether a given Persian text should be processed by the direct summarization pipeline or the chunk-based one.


from preprocess import normalize_persian_text


def is_long_text(text, tokenizer, threshold_tokens=450):
    """

    Parameters
    ----------
    text : str
        The original Persian input text.
    tokenizer : object
        The tokenizer associated with the summarization model,
        used to count tokens accurately.
    threshold_tokens : int, optional (default=450)
        The token length above which the text is labeled as "long".

    Returns
    -------
    bool
        True  -> if text is longer than the threshold.
        False -> otherwise.
    """

    # Step 1. Normalize text before tokenization
    text = normalize_persian_text(text)

    # Step 2. Count tokens using the model's tokenizer
    token_count = len(tokenizer.encode(text))

    # Step 3. Return routing decision
    # If the token count exceeds 450 (by default), the system routes the text to the chunk-based summarizer.
    return token_count > threshold_tokens
