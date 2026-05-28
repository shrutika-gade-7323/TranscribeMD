import re
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

# Lexical patterns that strongly indicate a new patient dictation is starting
BOUNDARY_PATTERNS = [
    # Explicit transitions
    r"(?i)\bnext\s+(?:patient|dictation|report|case)\b",
    r"(?i)\bend\s+(?:of\s+)?(?:report|dictation)\b",
    r"(?i)\bbeginning\s+(?:of\s+)?(?:new\s+)?(?:report|dictation)\b",
    r"(?i)\bthis\s+is\s+(?:a\s+new|the\s+next)\s+(?:patient|report|dictation)\b",
    # Doctor opening: "This is Dr. Smith dictating for..."
    r"(?i)\bthis\s+is\s+dr\.?\s+\w+\s+dictating\b",
    # Patient introduction
    r"(?i)\bpatient(?:\s+name)?(?:\s+is)?\s+[A-Z][a-z]+\s+[A-Z][a-z]+",
    r"(?i)\bMRN\s*[:#]?\s*\d+",
    r"(?i)\bmedical\s+record\s+(?:number\s+)?(?:#|number)?\s*\d+",
    r"(?i)\bdate\s+of\s+birth\s*[:#]",
    r"(?i)\bpatient\s+(?:D\.?O\.?B\.?|date\s+of\s+birth)\s*[:#]?",
]

COMPILED_PATTERNS = [re.compile(p) for p in BOUNDARY_PATTERNS]


def extract_patient_info(text: str) -> Dict:
    """Try to extract patient name and MRN from a text snippet."""
    result = {"name": None, "mrn": None}

    # MRN
    mrn_match = re.search(r"(?i)MRN\s*[:#]?\s*(\d+)", text)
    if mrn_match:
        result["mrn"] = mrn_match.group(1)

    # Patient name: "patient [name]" or "dictating for [name]"
    name_patterns = [
        r"(?i)patient(?:\s+name)?(?:\s+is)?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
        r"(?i)dictating\s+(?:for|on)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
        r"(?i)this\s+is\s+(?:for\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),",
    ]
    for pat in name_patterns:
        m = re.search(pat, text)
        if m:
            result["name"] = m.group(1)
            break

    return result


def detect_boundaries(transcript: str) -> List[Dict]:
    """
    Detect patient boundaries in a transcript using lexical signals.
    Returns list of boundary candidates with character index and confidence.
    """
    if not transcript or len(transcript) < 100:
        return []

    candidates = []

    for pattern in COMPILED_PATTERNS:
        for match in pattern.finditer(transcript):
            char_idx = match.start()
            # Skip boundaries too close to the start (< 200 chars in)
            if char_idx < 200:
                continue

            # Look at surrounding context for patient info
            context_start = max(0, char_idx - 50)
            context_end = min(len(transcript), char_idx + 200)
            context = transcript[context_start:context_end]
            patient_info = extract_patient_info(context)

            candidates.append({
                "character_index": char_idx,
                "confidence": 0.75,
                "evidence": match.group(0),
                "extracted_patient_name": patient_info["name"],
                "extracted_mrn": patient_info["mrn"],
            })

    if not candidates:
        return []

    # Merge candidates that are within 100 chars of each other
    merged = []
    candidates.sort(key=lambda x: x["character_index"])
    for c in candidates:
        if merged and abs(c["character_index"] - merged[-1]["character_index"]) < 100:
            # Keep the one with higher confidence
            if c["confidence"] > merged[-1]["confidence"]:
                merged[-1] = c
        else:
            merged.append(c)

    logger.info(f"Detected {len(merged)} patient boundaries in {len(transcript)} char transcript")
    return merged
