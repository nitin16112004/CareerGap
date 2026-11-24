from __future__ import annotations

import asyncio
import sys
import unittest
from pathlib import Path

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import MAX_RESUME_FILE_SIZE, parse_resume
from app.parser import parse_text


class MemoryUpload:
    def __init__(self, content: bytes, filename: str, content_type: str) -> None:
        self.content = content
        self.filename = filename
        self.content_type = content_type

    async def read(self) -> bytes:
        return self.content


class ResumeParserTests(unittest.TestCase):
    def test_extracts_structured_profile_data_from_text(self) -> None:
        parsed = parse_text(
            "Ava Stone\n"
            "ava@example.com | +91 98765 43210\n"
            "Location: Bengaluru\n"
            "Skills\nTypeScript, React, Python\n"
            "Education\nB.Tech Computer Science\n"
            "Experience\nSoftware Engineer at CareerGuid\n"
            "Projects\nAI career profile platform\n"
            "https://linkedin.com/in/ava\nhttps://github.com/ava\nhttps://ava.example"
        )

        self.assertEqual(parsed.name, "Ava Stone")
        self.assertEqual(parsed.email, "ava@example.com")
        self.assertEqual(parsed.city, "Bengaluru")
        self.assertIn("TypeScript", parsed.skills)
        self.assertEqual(parsed.education[0].details, "B.Tech Computer Science")
        self.assertEqual(parsed.experience[0].details, "Software Engineer at CareerGuid")
        self.assertEqual(parsed.projects[0].details, "AI career profile platform")
        self.assertEqual(parsed.linkedin, "https://linkedin.com/in/ava")
        self.assertEqual(parsed.github, "https://github.com/ava")
        self.assertEqual(parsed.portfolio, "https://ava.example")

    def test_groups_training_under_experience_and_keeps_education_separate(self) -> None:
        parsed = parse_text(
            "Riley Morgan\n"
            "Education\n"
            "B.Sc. Computer Science, Example College Expected June 2027\n"
            "Senior Secondary, Sample School May 2023\n"
            "Secondary, Sample School May 2021\n"
            "INTERNSHIP / TRAINING EXPERIENCE\n"
            "Cloud Development Program, Example College June 2025 - July 2025\n"
            "Software Development Trainee\n"
            "• Built a small dashboard with React and connected it to\n"
            "a JSON API.\n"
            "• Added automated checks for release builds.\n"
            "Technical Skills\n"
            "React, Git, Python\n"
        )

        self.assertEqual(
            [entry.details for entry in parsed.education],
            [
                "B.Sc. Computer Science, Example College Expected June 2027",
                "Senior Secondary, Sample School May 2023",
                "Secondary, Sample School May 2021",
            ],
        )
        self.assertEqual(len(parsed.experience), 1)
        experience = parsed.experience[0].details
        self.assertIn("Cloud Development Program, Example College June 2025 - July 2025", experience)
        self.assertIn("Software Development Trainee", experience)
        self.assertIn("connected it to a JSON API.", experience)
        self.assertRegex(experience, r"API\.\n(?:•\s*)?Added automated checks")
        self.assertNotIn("Technical Skills", experience)

    def test_keeps_each_project_with_its_stack_and_wrapped_bullets(self) -> None:
        parsed = parse_text(
            "Riley Morgan\n"
            "Selected Projects:\n"
            "Transit Atlas March 2026 – May 2026\n"
            "React | Node.js | PostgreSQL\n"
            "• Built a route planner for commuters with\n"
            "frequent service updates.\n"
            "• Added an accessible map legend.\n"
            "Reading Notes June 2026 – July 2026\n"
            "Python | FastAPI | Redis\n"
            "• Built a book catalog that synchronizes\n"
            "reading lists from a shared workspace.\n"
            "Certifications\n"
            "Example Cloud Certificate\n"
            "Achievements\n"
            "First place in a college challenge\n"
        )

        self.assertEqual(len(parsed.projects), 2)
        atlas, notes = [entry.details for entry in parsed.projects]
        self.assertIn("Transit Atlas", atlas)
        self.assertIn("March 2026", atlas)
        self.assertIn("May 2026", atlas)
        self.assertIn("React | Node.js | PostgreSQL", atlas)
        self.assertIn("commuters with frequent service updates.", atlas)
        self.assertRegex(atlas, r"updates\.\n(?:•\s*)?Added an accessible map legend")
        self.assertIn("Reading Notes", notes)
        self.assertIn("June 2026", notes)
        self.assertIn("July 2026", notes)
        self.assertIn("Python | FastAPI | Redis", notes)
        self.assertIn("synchronizes reading lists from a shared workspace.", notes)
        self.assertNotIn("Reading Notes", atlas)
        self.assertNotIn("map legend", notes)
        self.assertNotIn("Example Cloud Certificate", notes)
        self.assertNotIn("college challenge", notes)

    def test_unlabelled_resume_keeps_contact_and_skills_without_inventing_sections(self) -> None:
        parsed = parse_text(
            "Riley Morgan\n"
            "riley@example.com\n"
            "Built dashboards with Python and React."
        )

        self.assertEqual(parsed.name, "Riley Morgan")
        self.assertEqual(parsed.email, "riley@example.com")
        self.assertIn("Python", parsed.skills)
        self.assertEqual(parsed.education, [])
        self.assertEqual(parsed.experience, [])
        self.assertEqual(parsed.projects, [])

    def test_endpoint_rejects_files_with_an_invalid_signature(self) -> None:
        upload = MemoryUpload(b"not a PDF", "candidate.pdf", "application/pdf")

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(parse_resume(file=upload))

        self.assertEqual(raised.exception.status_code, 422)
        self.assertIn("Only valid PDF and DOCX", str(raised.exception.detail))

    def test_endpoint_rejects_files_larger_than_five_megabytes(self) -> None:
        upload = MemoryUpload(b"%PDF-" + (b"x" * MAX_RESUME_FILE_SIZE), "candidate.pdf", "application/pdf")

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(parse_resume(file=upload))

        self.assertEqual(raised.exception.status_code, 422)
        self.assertIn("5 MB", str(raised.exception.detail))


if __name__ == "__main__":
    unittest.main()
