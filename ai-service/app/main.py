from __future__ import annotations

import os
import secrets

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

from .parser import ParsedResume, parse_resume_bytes, parse_text
from .rag import (
    EmbeddingRequest,
    EmbeddingResponse,
    ProviderConfigurationError,
    ProviderResponseError,
    ProviderTimeoutError,
    RoadmapGenerationRequest,
    RoadmapGenerationResponse,
    create_embedding,
    generate_roadmap,
    rag_provider_status,
)

hosted = os.getenv("RENDER") == "true"
service_token = os.getenv("AI_SERVICE_TOKEN", "")
if hosted and len(service_token) < 32:
    raise RuntimeError("AI_SERVICE_TOKEN must contain at least 32 characters on Render")

app = FastAPI(
    title="CareerGuid AI Service",
    version="0.2.0",
    docs_url=None if hosted else "/docs",
    redoc_url=None if hosted else "/redoc",
    openapi_url=None if hosted else "/openapi.json",
)


@app.middleware("http")
async def protect_ai_service(request: Request, call_next):
    if service_token and not (request.method == "GET" and request.url.path == "/health"):
        expected = f"Bearer {service_token}".encode()
        supplied = request.headers.get("authorization", "").encode()
        if not secrets.compare_digest(supplied, expected):
            return JSONResponse(status_code=401, content={"detail": "Service authentication required"})
    return await call_next(request)

MAX_RESUME_FILE_SIZE = 5 * 1024 * 1024
PDF_MIME_TYPE = "application/pdf"
DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def validate_uploaded_resume(content: bytes, file_name: str, content_type: str) -> None:
    extension = file_name.lower().rsplit(".", maxsplit=1)[-1] if "." in file_name else ""
    if not content:
        raise ValueError("Resume file is empty")
    if len(content) > MAX_RESUME_FILE_SIZE:
        raise ValueError("Resume file must be 5 MB or smaller")
    if extension == "pdf" and content_type == PDF_MIME_TYPE and content.startswith(b"%PDF-"):
        return
    if extension == "docx" and content_type == DOCX_MIME_TYPE and content.startswith(b"PK\x03\x04"):
        return
    raise ValueError("Only valid PDF and DOCX resumes are supported")


class ParseResponse(BaseModel):
    success: bool = True
    data: ParsedResume


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "careerguid-ai"}


@app.get("/rag/readiness")
def rag_readiness() -> dict[str, bool]:
    return rag_provider_status()


@app.post("/parse-resume", response_model=ParseResponse)
async def parse_resume(file: UploadFile | None = File(default=None), text: str | None = Form(default=None)) -> ParseResponse:
    try:
        if file is not None:
            content = await file.read()
            file_name = file.filename or "resume"
            content_type = file.content_type or ""
            validate_uploaded_resume(content, file_name, content_type)
            parsed = parse_resume_bytes(content, file_name, content_type)
        elif text:
            parsed = parse_text(text)
        else:
            raise HTTPException(status_code=400, detail="Provide a PDF/DOCX file or resume text")
        return ParseResponse(data=parsed)
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Resume parsing failed") from error


@app.post("/embeddings", response_model=EmbeddingResponse)
def embeddings(request: EmbeddingRequest) -> EmbeddingResponse:
    try:
        return create_embedding(request.input)
    except ProviderConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ProviderResponseError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except ValidationError as error:
        raise HTTPException(status_code=502, detail="Embedding provider response failed validation") from error


@app.post("/generate-roadmap", response_model=RoadmapGenerationResponse)
def generate_rag_roadmap(request: RoadmapGenerationRequest) -> RoadmapGenerationResponse:
    try:
        return generate_roadmap(request)
    except ProviderConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ProviderTimeoutError as error:
        raise HTTPException(status_code=504, detail=str(error)) from error
    except ProviderResponseError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except ValidationError as error:
        raise HTTPException(status_code=502, detail="Generated roadmap failed structured validation") from error
