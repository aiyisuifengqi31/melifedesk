#!/usr/bin/env python3
"""
Parse 粉笔行测5000题 PDFs into a JSON question bank.

The input zip must contain two top-level folders:
  - 题目/  (question PDFs, "上册")
  - 答案/  (answer PDFs, "下册")

Files are matched by subject keyword, e.g.:
  题目/26最新版 常识上.pdf  <=>  答案/26常识下册.pdf

Run:
  python scripts/parse-exam-pdfs.py --zip "../01_inputs/答案.zip" --out assets/questionBank.json --subject 常识 --max-pages 50

Requirements (install first):
  pip install pymupdf rapidocr-onnxruntime
"""

import argparse
import io
import json
import re
import sys
import zipfile
from pathlib import Path

import fitz
from rapidocr_onnxruntime import RapidOCR

SUBJECTS = {
    "common": {"label": "常识判断", "keywords": ["常识"], "quizSubject": "common"},
    "language": {"label": "言语理解与表达", "keywords": ["言语"], "quizSubject": "language"},
    "quantitative": {"label": "数量关系", "keywords": ["数量关系"], "quizSubject": "quantitative"},
    "data": {"label": "资料分析", "keywords": ["资料分析"], "quizSubject": "data"},
    "reasoning": {"label": "判断推理", "keywords": ["判断推理"], "quizSubject": "reasoning"},
}


def find_pdf(z: zipfile.ZipFile, folder: str, keywords: list[str]) -> str | None:
    for name in z.namelist():
        if not name.startswith(folder + "/") or not name.lower().endswith(".pdf"):
            continue
        if all(k in name for k in keywords):
            return name
    return None


def ocr_pdf_pages(z: zipfile.ZipFile, pdf_name: str, start: int, end: int, engine: RapidOCR, dpi: int = 144):
    """Return list of OCR texts for pages [start, end) (1-based)."""
    texts = []
    with z.open(pdf_name) as f:
        doc = fitz.open(stream=f.read(), filetype="pdf")
        scale = dpi / 72
        matrix = fitz.Matrix(scale, scale)
        for i in range(start - 1, min(end, len(doc))):
            page = doc[i]
            pix = page.get_pixmap(matrix=matrix)
            img_bytes = pix.tobytes("png")
            result = engine(img_bytes)
            if result and result[0]:
                lines = [line[1] for line in result[0]]
                texts.append("\n".join(lines))
            else:
                texts.append("")
    return texts


def normalize_ocr_text(text: str) -> str:
    """Clean common OCR noise."""
    # Fix broken punctuation
    text = text.replace("一一", "——")
    text = text.replace("【】", "【】")
    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    return text


def parse_question_blocks(text: str, subject_label: str) -> list[dict]:
    """Parse question text into blocks. Returns list of {num, question, options, source}."""
    blocks = []
    # Question starts with:  N.  or  N.(2024辽宁18)  etc.
    # Split by question number at line start
    pattern = re.compile(r"(?:^|\n)\s*(\d+)\s*[\.．]\s*[（(]([^）)\n]*)[）)]", re.MULTILINE)
    matches = list(pattern.finditer(text))

    for i, m in enumerate(matches):
        num = int(m.group(1))
        source = m.group(2).strip()
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[start:end]

        # Extract options A/B/C/D
        options = []
        for opt_letter in ["A", "B", "C", "D"]:
            opt_match = re.search(rf"\n\s*{opt_letter}[\.．、]\s*([^\n]+)", chunk)
            if opt_match:
                options.append(f"{opt_letter}. {opt_match.group(1).strip()}")

        if len(options) < 2:
            continue

        # Question text is from after source until first option
        q_start = m.end()
        first_opt = re.search(r"\n\s*A[\.．、]", chunk)
        q_end = first_opt.start() if first_opt else len(chunk)
        question_text = chunk[q_start:q_end].strip()
        # Remove trailing "本部分题目解析见下册..."
        question_text = re.sub(r"本部分题目解析见下册.*", "", question_text).strip()

        if question_text and len(question_text) > 10:
            blocks.append({
                "num": num,
                "source": source,
                "question": question_text,
                "options": options,
                "subjectLabel": subject_label,
            })

    return blocks


def parse_answer_blocks(text: str) -> list[dict]:
    """Parse answer text into blocks. Returns list of {num, answer, explanation}."""
    blocks = []
    # Answer starts with:  N.【答案】X。
    pattern = re.compile(r"(?:^|\n)\s*(\d+)\s*[\.．]\s*【答案】\s*([A-Da-d])", re.MULTILINE)
    matches = list(pattern.finditer(text))

    for i, m in enumerate(matches):
        num = int(m.group(1))
        answer = m.group(2).upper()
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[start:end]

        # Explanation is between 【解析】 and 故正确答案为X。
        exp_match = re.search(r"【解析】\s*(.*?)\s*故正确答案为[：:]?\s*[A-Da-d]。", chunk, re.DOTALL)
        explanation = ""
        if exp_match:
            explanation = exp_match.group(1).strip()
        else:
            # Fallback: take everything after answer line until end
            lines = chunk.split("\n")
            if len(lines) > 1:
                explanation = "\n".join(lines[1:]).strip()
                explanation = re.sub(r"故正确答案为[：:]?\s*[A-Da-d]。", "", explanation).strip()

        blocks.append({
            "num": num,
            "answer": answer,
            "explanation": explanation,
        })

    return blocks


def match_questions_answers(q_blocks: list[dict], a_blocks: list[dict]) -> list[dict]:
    """Match question and answer blocks by sequential number within the same section."""
    answers_by_num = {a["num"]: a for a in a_blocks}
    matched = []
    for q in q_blocks:
        a = answers_by_num.get(q["num"])
        if not a:
            continue
        matched.append({
            "id": f"{q['subjectLabel']}-{q['num']}-{hash(q['question']) & 0xFFFFFF:06x}",
            "subject": None,  # filled later
            "subjectLabel": q["subjectLabel"],
            "question": q["question"],
            "options": q["options"],
            "answer": a["answer"],
            "explanation": a["explanation"],
            "source": q["source"],
        })
    return matched


def main():
    parser = argparse.ArgumentParser(description="Parse exam PDFs to JSON question bank")
    parser.add_argument("--zip", required=True, help="Path to the zip file containing 题目/ and 答案/")
    parser.add_argument("--out", required=True, help="Output JSON path")
    parser.add_argument("--subject", required=True, choices=list(SUBJECTS.keys()), help="Subject to parse")
    parser.add_argument("--q-start", type=int, default=1, help="Question PDF start page (1-based)")
    parser.add_argument("--q-end", type=int, default=50, help="Question PDF end page (1-based, exclusive)")
    parser.add_argument("--a-start", type=int, default=1, help="Answer PDF start page (1-based)")
    parser.add_argument("--a-end", type=int, default=50, help="Answer PDF end page (1-based, exclusive)")
    parser.add_argument("--dpi", type=int, default=144, help="DPI for rendering PDF pages")
    args = parser.parse_args()

    subject_cfg = SUBJECTS[args.subject]
    subject_label = subject_cfg["label"]
    quiz_subject = subject_cfg["quizSubject"]

    zip_path = Path(args.zip)
    if not zip_path.exists():
        print(f"Zip not found: {zip_path}", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Parsing subject: {subject_label} ({quiz_subject})")
    print(f"Opening zip: {zip_path}")

    with zipfile.ZipFile(zip_path) as z:
        q_pdf = find_pdf(z, "题目", subject_cfg["keywords"])
        a_pdf = find_pdf(z, "答案", subject_cfg["keywords"])

        if not q_pdf or not a_pdf:
            print(f"Could not find PDFs for subject {args.subject}", file=sys.stderr)
            print(f"  Question candidates: {[n for n in z.namelist() if n.startswith('题目/')]}", file=sys.stderr)
            print(f"  Answer candidates: {[n for n in z.namelist() if n.startswith('答案/')]}", file=sys.stderr)
            sys.exit(1)

        print(f"Question PDF: {q_pdf}")
        print(f"Answer PDF: {a_pdf}")

        engine = RapidOCR()
        print("OCRing question pages...")
        q_texts = ocr_pdf_pages(z, q_pdf, args.q_start, args.q_end, engine, args.dpi)
        print("OCRing answer pages...")
        a_texts = ocr_pdf_pages(z, a_pdf, args.a_start, args.a_end, engine, args.dpi)

    q_text = normalize_ocr_text("\n".join(q_texts))
    a_text = normalize_ocr_text("\n".join(a_texts))

    print("Parsing question blocks...")
    q_blocks = parse_question_blocks(q_text, subject_label)
    print(f"  Found {len(q_blocks)} question blocks")

    print("Parsing answer blocks...")
    a_blocks = parse_answer_blocks(a_text)
    print(f"  Found {len(a_blocks)} answer blocks")

    print("Matching questions and answers...")
    matched = match_questions_answers(q_blocks, a_blocks)
    for q in matched:
        q["subject"] = quiz_subject
    print(f"  Matched {len(matched)} questions")

    # Merge with existing JSON if present
    existing = []
    if out_path.exists():
        with open(out_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
        # Remove old questions of same subject
        existing = [q for q in existing if q.get("subject") != quiz_subject]

    combined = existing + matched

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(combined)} total questions to {out_path}")


if __name__ == "__main__":
    main()
