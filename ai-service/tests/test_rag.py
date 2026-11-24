from __future__ import annotations

import json

import httpx
import pytest
from pydantic import ValidationError

from app.rag import (
    EmbeddingResponse,
    ProviderConfigurationError,
    RagDocument,
    RoadmapGenerationRequest,
    RoadmapPlan,
    RoadmapTask,
    create_embedding,
    generate_roadmap,
)


def test_roadmap_task_preserves_skill_and_accepts_older_payloads() -> None:
    task = {"title": "Practice SQL", "description": "Build a small SQL exercise."}

    assert RoadmapTask.model_validate(task).skill is None
    assert RoadmapTask.model_validate({**task, "skill": "PostgreSQL"}).skill == "PostgreSQL"


def test_embedding_response_requires_configured_dimension() -> None:
    response = EmbeddingResponse(embedding=[0.0] * 1536, model="embedding-test")
    assert len(response.embedding) == 1536

    with pytest.raises(ValidationError):
        EmbeddingResponse(embedding=[0.0] * 3, model="wrong-dimension")


def test_roadmap_plan_requires_sequential_weeks() -> None:
    with pytest.raises(ValidationError):
        RoadmapPlan.model_validate({
            "title": "Backend Roadmap",
            "description": "A grounded plan.",
            "duration_weeks": 1,
            "weeks": [{
                "week_number": 2,
                "title": "Week 2",
                "description": "Invalid first week number.",
                "tasks": [{
                    "title": "Practice APIs",
                    "description": "Build a small API exercise.",
                    "resource_document_ids": ["doc-1"],
                }],
            }],
        })


def test_embedding_generation_fails_closed_without_provider_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EMBEDDING_API_KEY", raising=False)
    monkeypatch.setenv("EMBEDDING_MODEL", "embedding-test")
    with pytest.raises(ProviderConfigurationError):
        create_embedding("Target role: Backend Engineer")


@pytest.mark.parametrize(("base_url", "model"), [
    ("https://generativelanguage.googleapis.com/v1beta", "gemini-embedding-2"),
    ("https://generativelanguage.googleapis.com/v1beta/openai/", "models/gemini-embedding-2"),
])
def test_gemini_embedding_requests_database_dimension(
    monkeypatch: pytest.MonkeyPatch, base_url: str, model: str,
) -> None:
    monkeypatch.setenv("EMBEDDING_BASE_URL", base_url)
    monkeypatch.setenv("EMBEDDING_API_KEY", "gemini-test-key")
    monkeypatch.setenv("EMBEDDING_MODEL", model)
    text = "Target role: Backend Engineer"

    def embed(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert str(request.url) == "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent"
        assert request.headers["x-goog-api-key"] == "gemini-test-key"
        assert "authorization" not in request.headers
        assert json.loads(request.content) == {
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": 1536,
        }
        return httpx.Response(200, json={"embedding": {"values": [0.25] * 1536}})

    mock_client = httpx.Client(transport=httpx.MockTransport(embed))
    monkeypatch.setattr("app.rag.httpx.Client", lambda **_: mock_client)

    result = create_embedding(text)
    assert result.embedding == [0.25] * 1536
    assert result.model == model


def test_openai_compatible_embedding_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EMBEDDING_BASE_URL", "https://provider.example.test/v1/")
    monkeypatch.setenv("EMBEDDING_API_KEY", "openai-test-key")
    monkeypatch.setenv("EMBEDDING_MODEL", "embedding-test")
    text = "Target role: Backend Engineer"

    def embed(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://provider.example.test/v1/embeddings"
        assert request.headers["authorization"] == "Bearer openai-test-key"
        assert "x-goog-api-key" not in request.headers
        assert json.loads(request.content) == {"model": "embedding-test", "input": text}
        return httpx.Response(200, json={"data": [{"embedding": [0.5] * 1536}], "model": "provider-embedding"})

    mock_client = httpx.Client(transport=httpx.MockTransport(embed))
    monkeypatch.setattr("app.rag.httpx.Client", lambda **_: mock_client)

    result = create_embedding(text)
    assert result.embedding == [0.5] * 1536
    assert result.model == "provider-embedding"


def test_roadmap_generation_fails_closed_without_llm_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.setenv("LLM_MODEL", "llm-test")
    request = RoadmapGenerationRequest(
        target_role="Backend Engineer",
        current_skills=["JavaScript"],
        missing_skills=["PostgreSQL"],
        documents=[RagDocument(
            id="doc-1",
            title="PostgreSQL fundamentals",
            category="database",
            content="Practice relational modelling and SQL queries.",
        )],
    )
    with pytest.raises(ProviderConfigurationError):
        generate_roadmap(request)
