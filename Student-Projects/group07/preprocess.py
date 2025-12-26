
# preprocess.py
# This module provides text normalization utilities specifically
# designed for Persian text.
# The goal of preprocessing is to reduce noise and inconsistencies before the text is passed to the summarization model.


import re

def normalize_persian_text(text, remove_half_space=True, remove_symbols=True):
    """
    Parameters
    ----------
    text : str    
    remove_half_space : bool, optional (default=True)
        If True, removes the Zero Width Non-Joiner character (\u200c),
        replacing it with a regular space.
        This helps avoid tokenization inconsistencies.
    remove_symbols : bool, optional (default=True)
        If True, removes unnecessary symbols while preserving
        sentence‑level punctuation such as periods and question marks.

    Returns
    -------
    str
        The normalized Persian text.
    """

    # 1. Remove Zero Width Non-Joiner (half‑space)
    if remove_half_space:
        text = text.replace('\u200c', ' ')

    # 2. Normalize Arabic characters to their Persian equivalents
    replacements = {
        'ي': 'ی',
        'ك': 'ک',
        'ة': 'ه',
        'ؤ': 'و',
        'إ': 'ا',
        'أ': 'ا'
    }
    for src, tgt in replacements.items():
        text = text.replace(src, tgt)

    # 3. Remove unnecessary symbols (keep '.' and '?')
    if remove_symbols:
        text = re.sub(r'[\"\'\(\)\[\]\{\}\*_,;:«»]', '', text)

    # 4. Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    return text
