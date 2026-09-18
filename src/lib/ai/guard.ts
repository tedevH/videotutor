import { HarmBlockThreshold, HarmCategory, type SafetySetting } from "@google/genai";
import type { TutorResponse } from "@/lib/tutor/schema";

/**
 * Google's own content filters on every Gemini call. Medium-and-above blocks real harm while
 * leaving room for school topics that sound alarming out of context (a chemistry reaction, a war in history).
 */
export const SAFETY_SETTINGS: SafetySetting[] = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }));

export type GuardVerdict = { ok: true } | { ok: false; reason: "secrets" | "prompt_injection" | "harmful"; reply: string };

// Asking for OUR secrets. "What is an API key?" is a fine CS question; "give me your API key" isn't.
const SECRET_REQUEST =
  /\b(your|the (app'?s?|site'?s?|server'?s?|backend'?s?|system'?s?|admin)|lumo'?s?|lumotutor'?s?)\s+(own\s+)?(api[\s_-]?keys?|secret(s| keys?)?|tokens?|passwords?|credentials|env(ironment)?( variables?| vars?)?|\.env|service[\s_-]?role|database (url|password)|stripe keys?|gemini keys?|private keys?)\b/i;
const SECRET_DUMP = /\b(print|dump|show|list|reveal|leak|output|cat|echo)\b.{0,30}(\.env|process\.env|env(ironment)? variables?|secrets?|api[\s_-]?keys?)\b/i;

// Attempts to override or extract the instructions.
const INJECTION = [
  /\bignore\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier|system|original)\s+(instructions|prompts?|rules|messages)/i,
  /\b(disregard|forget|override|bypass)\s+(all\s+|your\s+|the\s+)?(instructions|rules|guidelines|guardrails|restrictions|system prompt)/i,
  /\b(reveal|show|print|repeat|output|tell me|what (is|are))\s+(me\s+)?(your|the)\s+(system|hidden|original|initial|developer)\s+(prompt|instructions|message|rules)/i,
  /\byour\s+(system\s+prompt|instructions verbatim|prompt verbatim)\b/i,
  /\b(developer|dev|god|jailbreak|unrestricted|DAN)\s+mode\b/i,
  /\bpretend\s+(you('| a)re|to be)\s+(an?\s+)?(unrestricted|unfiltered|evil|different)\b/i,
  /\byou are (now )?(no longer|not) (a )?tutor\b/i,
  /<\/?(system|instructions?)>|\[\/?INST\]|###\s*system/i,
];

// Clear requests to cause real-world harm. Education about these topics stays open; how-to doesn't.
const HARMFUL = [
  // "bomb calorimeter" is lab equipment, not a weapon.
  /\b(how (do|can|would) (i|you|someone)|steps to|instructions (for|to)|help me)\b.{0,40}\b(make|build|synthesi[sz]e|cook|brew|manufacture|assemble)\b.{0,30}\b(bomb(?! calorimeter)|explosive device|pipe bomb|nerve agent|sarin|ricin|meth(amphetamine)?|fentanyl|napalm|bioweapon|chemical weapon|ghost gun|silencer)\b/i,
  // Intent to hurt a real person, in the first person. Literature and history questions don't match.
  /\b(i (want|am going|'m going|plan) to|help me|how (do|can) i)\s+(kill|hurt|poison|stab|shoot|beat up)\s+(someone|somebody|a person|my \w+|him|her|them)\b/i,
  /\b(help me|how (do|can) i|i want to)\s+(hack|break|get)\s+into\b.{0,40}\b(account|email|instagram|snap(chat)?|school('s)? (system|portal|network)|grade(s| system)|canvas|blackboard|powerschool|teacher'?s)\b/i,
  /\b(change|edit|alter|hack)\s+my\s+grades?\b/i,
];

// First person only: "Durkheim's theory of suicide" is a sociology question.
const SELF_HARM = /\b(kill myself|killing myself|want to die|wanna die|end my life|ending my life|i'?m suicidal|i am suicidal|feel(ing)? suicidal|hurt myself|hurting myself|cut myself|cutting myself)\b/i;

const MAX_QUESTION_CHARS = 4000;

/**
 * Screens a student's message before any AI call. Cheap and deterministic: it catches the obvious
 * attacks outright, and the model's own rules and Google's filters handle the subtle cases.
 */
export function screenQuestion(text: string): GuardVerdict {
  const q = text.slice(0, MAX_QUESTION_CHARS);
  if (SELF_HARM.test(q)) {
    return {
      ok: false,
      reason: "harmful",
      reply:
        "I'm really glad you said something. I'm a study tutor, so I'm not the right help for this, but you deserve real support right now. In the US you can call or text **988** (Suicide & Crisis Lifeline) any time, or text **HOME** to **741741**. Outside the US, [findahelpline.com](https://findahelpline.com) lists free lines near you. If you're in danger, call your local emergency number. I'm here for schoolwork whenever you want to come back.",
    };
  }
  if (SECRET_REQUEST.test(q) || SECRET_DUMP.test(q)) {
    return {
      ok: false,
      reason: "secrets",
      reply: "I can't share keys, passwords or anything about how LumoTutor is set up. I'm here to help you learn, though: what are you working on?",
    };
  }
  if (INJECTION.some((r) => r.test(q))) {
    return {
      ok: false,
      reason: "prompt_injection",
      reply: "I'll stick to being your tutor. Ask me about a lecture, a problem you're stuck on, or a concept you want explained.",
    };
  }
  if (HARMFUL.some((r) => r.test(q))) {
    return {
      ok: false,
      reason: "harmful",
      reply:
        "I can't help with that. If it's for a class, I'm happy to cover the underlying science, history or ethics instead. Tell me what you're studying.",
    };
  }
  return { ok: true };
}

/** A refusal shaped like any other tutor reply, so the chat renders it normally. */
export function refusalResponse(reply: string): TutorResponse {
  return {
    plan: { on_screen: "", about_screen: false, question_type: "off_topic", visual: "none", why: "Declined by the safety guard." },
    move: "wrap_up",
    awaiting_student: false,
    resolved: false,
    assessment: { result: "not_applicable", diagnosis: "" },
    observations: [],
    misconception: "",
    blocks: [{ type: "text", md: reply }],
    rewatch_from: null,
  } as TutorResponse;
}

/** Thrown when Google's filters block a prompt or reply; the route turns it into a normal refusal. */
export class SafetyBlockedError extends Error {
  constructor(reason: string) {
    super(`Blocked by safety filters: ${reason}`);
    this.name = "SafetyBlockedError";
  }
}

const BLOCKED_FINISH = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"]);

export function assertNotBlocked(res: { promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string }[] }) {
  const prompt = res.promptFeedback?.blockReason;
  if (prompt) throw new SafetyBlockedError(String(prompt));
  const finish = res.candidates?.[0]?.finishReason;
  if (finish && BLOCKED_FINISH.has(String(finish))) throw new SafetyBlockedError(String(finish));
}

export const SAFETY_REFUSAL =
  "I can't help with that one. I'm here for schoolwork and learning: ask me about a lecture, a problem you're stuck on, or a concept you want explained.";
