from __future__ import annotations

import io
import re
import zipfile
from typing import Any
from xml.etree import ElementTree

from pydantic import BaseModel, Field

try:
    import pdfplumber
except ImportError:  # pragma: no cover - production installs requirements.txt
    pdfplumber = None

try:
    from docx import Document
except ImportError:  # pragma: no cover - production installs requirements.txt
    Document = None


MAX_ENTRY_LENGTH = 2_000


class EducationItem(BaseModel):
    details: str = Field(default="", max_length=MAX_ENTRY_LENGTH)


class ExperienceItem(BaseModel):
    details: str = Field(default="", max_length=MAX_ENTRY_LENGTH)


class ProjectItem(BaseModel):
    details: str = Field(default="", max_length=MAX_ENTRY_LENGTH)


class ParsedResume(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    city: str = ""
    education: list[EducationItem] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""
    rawText: str = ""


SKILL_DICTIONARY = (
    "JavaScript", "TypeScript", "React", "React.js", "Node.js", "Express.js",
    "PostgreSQL", "Supabase", "Redis", "Docker", "REST API", "JWT", "Python",
    "FastAPI", "RAG", "AI/ML", "HTML", "CSS", "Next.js", "Vue", "Angular",
    "Java", "C++", "Go", "AWS", "Azure", "GCP", "Git", "Linux", "Figma",
    "GraphQL", "Prisma", "SQL", "NoSQL", "Pandas", "NumPy", "scikit-learn",
    "TensorFlow", "PyTorch", "Kubernetes", "Terraform", "CI/CD", "Jest",
)

SECTION_ALIASES = {
    "education": {"education", "academic background", "academic qualifications", "qualifications"},
    "experience": {
        "experience", "work experience", "employment", "professional experience", "employment history",
        "internship", "internships", "internship experience", "training", "training experience",
        "internship training experience", "internships training", "internships and training",
        "internship and training experience", "training and internships", "internship and training",
        "work internship experience", "work experience and internships",
    },
    "projects": {"projects", "personal projects", "selected projects", "academic projects", "technical projects"},
    "ignored": {
        "summary", "objective", "career objective", "professional summary", "profile", "about me",
        "skills", "technical skills", "core skills", "skills and tools", "competencies",
        "certifications", "certificates", "achievements", "awards", "awards and achievements",
        "professional achievements", "professional achievements insights", "highlights", "insights",
        "publication", "publications", "languages", "interests", "hobbies", "volunteering",
        "declaration", "references", "links", "contact", "contact information",
    },
}
SECTION_BY_HEADING = {heading: section for section, headings in SECTION_ALIASES.items() for heading in headings}

BULLET = re.compile(r"^(?:[•●▪◦‣∙·]|[-–—*]\s+|\d+[.)]\s+)")
MONTH = r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
DATE = rf"(?:{MONTH}\.?\s+)?(?:19|20)\d{{2}}"
DATED_END = re.compile(rf"\b(?:expected\s+)?{DATE}(?:\s*(?:[-–—]|to)\s*(?:{DATE}|present|current|now))?$", re.I)
EDUCATION_START = re.compile(
    r"^(?:bachelors?|masters?|doctorate|doctoral|diploma|intermediate|high school|senior secondary|secondary school|"
    r"ph\.?d|(?:b|m)\.?\s*(?:tech|sc|eng|ca|ba|com)|mba)\b", re.I,
)


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\x00", " ")).strip()


def _extract_pdf(data: bytes) -> str:
    if pdfplumber is None:
        raise ValueError("PDF parsing dependencies are not installed")
    with pdfplumber.open(io.BytesIO(data)) as document:
        return "\n".join(page.extract_text() or "" for page in document.pages)


def _extract_docx(data: bytes) -> str:
    if Document is not None:
        document = Document(io.BytesIO(data))
        return "\n".join(paragraph.text for paragraph in document.paragraphs)
    # Safe fallback for environments that only need a smoke test. The XML is
    # parsed without executing macros or opening embedded relationships.
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        xml = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml)
    return "\n".join(node.text or "" for node in root.iter() if node.tag.endswith("}t"))


def extract_text(data: bytes, file_name: str, content_type: str) -> str:
    lower_name = file_name.lower()
    if content_type == "application/pdf" or lower_name.endswith(".pdf"):
        return _extract_pdf(data)
    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or lower_name.endswith(".docx"):
        return _extract_docx(data)
    raise ValueError("Only PDF and DOCX resumes are supported")


def _lines(text: str) -> list[str]:
    return [line for line in (_clean_text(item) for item in text.splitlines()) if line]


def _section_blocks(text: str) -> dict[str, list[list[str]]]:
    sections: dict[str, list[list[str]]] = {key: [] for key in ("education", "experience", "projects")}
    current: list[str] | None = None
    for raw_line in text.splitlines():
        line = _clean_text(raw_line)
        label, separator, inline = line.partition(":")
        key = re.sub(r"[\W_]+", " ", label.casefold()).strip()
        section = None if BULLET.match(line) else SECTION_BY_HEADING.get(key)
        if section is not None:
            current = [] if section in sections else None
            if current is not None:
                sections[section].append(current)
                if separator and inline.strip():
                    current.append(inline.strip())
        elif current is not None:
            current.append(line)
    return sections


def _starts_entry(line: str, following: str, entry: list[str], section: str, separated: bool) -> bool:
    date = DATED_END.search(line)
    if date:
        if date.start() == 0:
            return False
        if line[0].isupper():
            return True
    if section == "education" and EDUCATION_START.match(line):
        return any(EDUCATION_START.match(part) for part in entry) or separated
    looks_like_title = len(line) <= 120 and line[0].isupper() and not line.endswith((".", ",", ":", ";", "?", "!"))
    stack_follows = section == "projects" and (" | " in following or following.casefold().startswith(("tech stack:", "stack:", "technologies:")))
    return looks_like_title and (separated or stack_follows)


def _bounded_entry(lines: list[str]) -> str:
    # The TypeScript onboarding validator counts UTF-16 units in project details.
    encoded = "\n".join(lines).encode("utf-16-le", errors="replace")
    return encoded[:MAX_ENTRY_LENGTH * 2].decode("utf-16-le", errors="ignore").rstrip()


def _section_entries(blocks: list[list[str]], section: str) -> list[str]:
    entries: list[str] = []
    for lines in blocks:
        entry: list[str] = []
        separated = False
        for index, line in enumerate(lines):
            if not line:
                separated = True
                continue
            if re.fullmatch(r"https?://\S+", line, re.I):
                continue
            bullet = BULLET.match(line)
            if entry and not bullet and _starts_entry(line, lines[index + 1] if index + 1 < len(lines) else "", entry, section, separated):
                entries.append(_bounded_entry(entry))
                entry = []
            if entry and not bullet and not separated and BULLET.match(entry[-1]):
                entry[-1] += f" {line}"
            else:
                entry.append(line)
            separated = False
        if entry:
            entries.append(_bounded_entry(entry))
    return entries[:20]


def _extract_links(text: str, provider: str) -> str:
    pattern = rf"https?://(?:www\.)?{provider}\.com/[^\s)]+"
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(0).rstrip(".,") if match else ""


def parse_text(text: str) -> ParsedResume:
    normalized = _clean_text(text)
    lines = _lines(text)
    sections = _section_blocks(text)
    email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", normalized)
    phone_match = re.search(r"(?:\+?\d[\d\s().-]{7,}\d)", normalized)
    city_match = re.search(r"(?:city|location|based in)\s*[:\-]\s*([A-Za-z .'-]{2,60})", text, re.IGNORECASE)

    name = ""
    for line in lines[:8]:
        if "@" not in line and not re.search(r"https?://|\d{5,}", line) and line.lower() not in {"resume", "curriculum vitae", "cv"}:
            name = line[:120]
            break

    skills = []
    lowered = normalized.lower()
    for skill in SKILL_DICTIONARY:
        if re.search(rf"(?<!\w){re.escape(skill.lower())}(?!\w)", lowered) and skill not in skills:
            skills.append(skill)

    return ParsedResume(
        name=name,
        email=email_match.group(0) if email_match else "",
        phone=_clean_text(phone_match.group(0)) if phone_match else "",
        city=_clean_text(city_match.group(1)) if city_match else "",
        education=[EducationItem(details=entry) for entry in _section_entries(sections["education"], "education")],
        skills=skills,
        experience=[ExperienceItem(details=entry) for entry in _section_entries(sections["experience"], "experience")],
        projects=[ProjectItem(details=entry) for entry in _section_entries(sections["projects"], "projects")],
        linkedin=_extract_links(normalized, "linkedin"),
        github=_extract_links(normalized, "github"),
        portfolio=(next((url.rstrip(".,") for url in re.findall(r"https?://[^\s)]+", normalized) if "linkedin.com" not in url.lower() and "github.com" not in url.lower()), "")),
        rawText=text[:200_000],
    )


def parse_resume_bytes(data: bytes, file_name: str, content_type: str) -> ParsedResume:
    if not data:
        raise ValueError("Resume file is empty")
    text = extract_text(data, file_name, content_type)
    if not text.strip():
        raise ValueError("No readable text could be extracted from this resume")
    return parse_text(text)
