"""
AI Service Abstraction Layer — Grahak / Nexus AI

Architecture:
  AIService
  ├── GroqProvider (active)
  ├── OpenAIProvider (future)
  └── LocalProvider (future)

This layer ensures Nexus AI can swap LLM providers without rewriting the application.
"""

import json
import re
import time
from abc import ABC, abstractmethod
from typing import Optional
from datetime import datetime
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# ──────────────────────────── SCHEMAS ─────────────────────────────

class AIAnalysisResult:
    """Structured result from AI message analysis."""
    
    def __init__(self, data: dict):
        self.intent = data.get("intent", "other")
        self.priority = data.get("priority", "medium")
        self.summary = data.get("summary", "")
        self.customer_name = data.get("customer_name")
        self.service = data.get("service")
        self.budget = data.get("budget")
        self.date = data.get("date")
        self.location = data.get("location")
        self.suggested_action = data.get("suggested_action", "Review conversation")
        self.needs_followup = data.get("needs_followup", False)
        self.followup_hours = data.get("followup_hours")
        self.raw = data

    def to_dict(self) -> dict:
        return {
            "intent": self.intent,
            "priority": self.priority,
            "summary": self.summary,
            "customer_name": self.customer_name,
            "service": self.service,
            "budget": self.budget,
            "date": self.date,
            "location": self.location,
            "suggested_action": self.suggested_action,
            "needs_followup": self.needs_followup,
            "followup_hours": self.followup_hours,
        }


# ──────────────────────────── PROVIDER INTERFACE ─────────────────────────────

class AIProvider(ABC):
    @abstractmethod
    async def analyze_message(
        self,
        message: str,
        conversation_history: Optional[list] = None,
        business_category: Optional[str] = None,
    ) -> AIAnalysisResult:
        pass

    @abstractmethod
    async def generate_summary(
        self,
        messages: list[str],
        existing_summary: Optional[str] = None,
    ) -> str:
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        pass


# ──────────────────────────── GROQ PROVIDER ─────────────────────────────

ANALYSIS_SYSTEM_PROMPT = """You are an AI assistant for Grahak, an AI-powered WhatsApp CRM for small Indian businesses.

Your job is to analyze customer WhatsApp messages and extract business intelligence.

You MUST respond with ONLY a valid JSON object. No markdown, no explanation, no code blocks.

JSON Schema:
{
  "intent": "new_lead" | "returning_customer" | "question" | "complaint" | "spam" | "support" | "purchase_intent" | "other",
  "priority": "low" | "medium" | "high",
  "summary": "One sentence summary of what the customer wants",
  "customer_name": "Extracted name or null",
  "service": "Product or service mentioned or null",
  "budget": number_in_rupees_or_null,
  "date": "YYYY-MM-DD if mentioned or null",
  "location": "City or area if mentioned or null",
  "suggested_action": "Brief action for the business owner",
  "needs_followup": true | false,
  "followup_hours": hours_as_number_or_null
}

Rules:
- Be concise. Summary must be under 100 characters.
- Extract budget as a number (rupees), not a string.
- If the customer mentions a date, convert it to YYYY-MM-DD format using the current year if not specified.
- For simple messages like "ok", "thanks", "yes" — set intent to "other" and priority to "low".
- High priority: complaints, urgent requests, price inquiries with specific dates.
- Always respond ONLY with the JSON object.
"""


class GroqProvider(AIProvider):
    def __init__(self):
        self._client = None
        self._available = bool(settings.GROQ_API_KEY)
        self._retry_after = 0.0

    def _get_client(self):
        if not self._available:
            return None
        if self._client is None:
            try:
                from groq import AsyncGroq
                self._client = AsyncGroq(api_key=settings.GROQ_API_KEY, timeout=15, max_retries=1)
            except Exception as e:
                logger.error(f"Failed to initialize Groq client: {e}")
                self._available = False
        return self._client

    @property
    def provider_name(self) -> str:
        return "groq"

    @property
    def model_name(self) -> str:
        return settings.GROQ_MODEL

    async def analyze_message(
        self,
        message: str,
        conversation_history: Optional[list] = None,
        business_category: Optional[str] = None,
    ) -> AIAnalysisResult:
        if time.monotonic() < self._retry_after:
            return self._fallback_analysis(message)
        client = self._get_client()
        if not client:
            logger.warning("Groq not configured — returning fallback analysis")
            return self._fallback_analysis(message)

        user_prompt = f"Customer WhatsApp message: \"{message}\""
        if business_category:
            user_prompt = f"Business type: {business_category}\n{user_prompt}"
        if conversation_history:
            history_text = "\n".join(
                f"{'Customer' if m.get('direction') == 'inbound' else 'Business'}: {m.get('body', '')}"
                for m in conversation_history[-5:]  # Last 5 messages for context
            )
            user_prompt = f"Conversation history:\n{history_text}\n\nLatest message: \"{message}\""

        try:
            response = await client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=settings.AI_MAX_TOKENS,
                temperature=settings.AI_TEMPERATURE,
            )
            raw_content = response.choices[0].message.content.strip()
            parsed = self._parse_json_response(raw_content)
            
            # Track token usage
            usage = response.usage
            self._log_usage(usage)
            
            return AIAnalysisResult(parsed)

        except Exception as e:
            logger.error(f"Groq API error: {e}")
            self._retry_after = time.monotonic() + 60
            return self._fallback_analysis(message)

    async def generate_summary(
        self,
        messages: list[str],
        existing_summary: Optional[str] = None,
    ) -> str:
        client = self._get_client()
        if not client:
            return existing_summary or "AI summary not available — Groq API not configured."

        conversation = "\n".join(messages[-10:])  # Last 10 messages
        prompt = f"Summarize this WhatsApp business conversation in 2-3 concise sentences. Focus on: what the customer wants, any dates/budget mentioned, and current status.\n\nConversation:\n{conversation}"
        
        if existing_summary:
            prompt = f"Update this existing summary with new information:\nExisting: {existing_summary}\n\nNew messages:\n{conversation}\n\nProvide an updated 2-3 sentence summary."

        try:
            response = await client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.3,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Groq summary error: {e}")
            return existing_summary or "Summary generation failed."

    def _parse_json_response(self, content: str) -> dict:
        """Safely parse JSON from LLM response."""
        # Try direct parse
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        
        # Try extracting JSON from markdown code blocks
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Try finding raw JSON object
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        
        logger.warning(f"Could not parse AI JSON response: {content[:200]}")
        return {}

    def _fallback_analysis(self, message: str) -> AIAnalysisResult:
        """Rule-based fallback when AI is unavailable."""
        msg_lower = message.lower()
        
        # Simple keyword detection
        intent = "other"
        priority = "medium"
        
        if any(word in msg_lower for word in ["price", "cost", "kitne", "rate", "package", "charges"]):
            intent = "new_lead"
            priority = "high"
        elif any(word in msg_lower for word in ["complaint", "problem", "issue", "wrong", "bad"]):
            intent = "complaint"
            priority = "high"
        elif any(word in msg_lower for word in ["ok", "thanks", "thx", "haan", "okay", "yes", "no"]):
            intent = "other"
            priority = "low"
        elif any(word in msg_lower for word in ["book", "confirm", "order", "buy"]):
            intent = "purchase_intent"
            priority = "high"
        elif "?" in message:
            intent = "question"
            priority = "medium"
        
        return AIAnalysisResult({
            "intent": intent,
            "priority": priority,
            "summary": f"Customer message: {message[:80]}...",
            "customer_name": None,
            "service": None,
            "budget": None,
            "date": None,
            "location": None,
            "suggested_action": "Review conversation",
            "needs_followup": priority == "high",
            "followup_hours": 24 if priority == "high" else None,
        })

    def _log_usage(self, usage):
        """Log token usage for cost tracking."""
        if usage:
            logger.debug(
                f"Groq usage: input={usage.prompt_tokens}, "
                f"output={usage.completion_tokens}"
            )


# ──────────────────────────── SHOULD-PROCESS CHECK ─────────────────────────────

SKIP_AI_PATTERNS = [
    r"^(ok|okay|haan|yes|no|thanks|thx|thank you|shukriya|ji|nahi|nope|yep|sure|👍|👌|🙏)$",
    r"^\s*$",
]


def should_process_with_ai(message: str) -> bool:
    """
    Avoids unnecessary LLM calls for trivial messages.
    Returns False for very short/simple ack messages.
    """
    msg_stripped = message.strip().lower()
    
    # Too short (under 5 chars) — likely an ack
    if len(msg_stripped) < 5:
        return False
    
    # Match simple patterns
    for pattern in SKIP_AI_PATTERNS:
        if re.match(pattern, msg_stripped, re.IGNORECASE):
            return False
    
    return True


# ──────────────────────────── AI SERVICE ─────────────────────────────

class AIService:
    """
    Main AI service entry point.
    Selects provider based on configuration.
    """
    
    def __init__(self):
        self._provider: AIProvider = GroqProvider()
        logger.info(f"AI Service initialized with provider: {self._provider.provider_name}")

    @property
    def provider(self) -> AIProvider:
        return self._provider

    async def analyze_message(
        self,
        message: str,
        conversation_history: Optional[list] = None,
        business_category: Optional[str] = None,
    ) -> Optional[AIAnalysisResult]:
        """
        Analyze a customer message.
        Returns None if AI processing should be skipped.
        """
        if not should_process_with_ai(message):
            logger.debug("Skipping AI for a trivial message")
            return None
        
        return await self._provider.analyze_message(
            message=message,
            conversation_history=conversation_history,
            business_category=business_category,
        )

    async def generate_summary(
        self,
        messages: list[str],
        existing_summary: Optional[str] = None,
    ) -> str:
        return await self._provider.generate_summary(messages, existing_summary)

    def get_status(self) -> dict:
        return {
            "available": isinstance(self._provider, GroqProvider) and bool(settings.GROQ_API_KEY),
            "provider": self._provider.provider_name,
            "model": self._provider.model_name,
        }


# Singleton instance
ai_service = AIService()
