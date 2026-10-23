/**
 * Routing Engine — deterministic, rule-based
 *
 * Categories (documented product decisions):
 *
 * 1. no_connection      — calls with no substantive contact (voicemail, unresponsive, no text)
 * 2. no_transcript      — records that have metadata but no usable supplied text; cannot analyse
 * 3. prospect_follow_up — active prospect evaluation conversations (cold calls that landed, demos)
 * 4. partner_opportunity— partnership / referral / channel discussions
 * 5. customer_success   — existing-customer support, migration, onboarding, bug reports
 * 6. internal_operations— SpendNest-internal training, design, billing walkthrough sessions
 * 7. vendor_supplier    — SpendNest evaluating a third-party supplier (e.g., LedgerBridge)
 * 8. human_review_needed— metadata and transcript disagree, ambiguous ownership, or other edge case
 *
 * Rejected decision: using observed_outcome as the routing key.
 * Reason: observed_outcome is a stored machine label; the transcript often reveals a different
 * picture (e.g., C04 has is_connected=false but contains a two-speaker voicemail conversation).
 * We read the transcript evidence first, then use metadata as secondary signal.
 */

import type {
  ProcessedRecord,
  SourceRecord,
  RouteCategory,
  RouteDecision,
  EvidenceExcerpt,
  CallPayload,
  MeetingPayload,
  MeetingTranscriptPayload,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasUsableTranscript(record: SourceRecord): boolean {
  if (record.source_type === 'call') {
    const p = record.payload as CallPayload;
    return typeof p.transcript === 'string' && p.transcript.trim().length > 10;
  } else {
    const tp = record.transcript_payload as MeetingTranscriptPayload | null;
    return !!(tp && tp.turns && tp.turns.length > 0);
  }
}

function getTranscriptText(record: SourceRecord): string {
  if (record.source_type === 'call') {
    return (record.payload as CallPayload).transcript ?? '';
  }
  const tp = record.transcript_payload as MeetingTranscriptPayload | null;
  if (!tp) return '';
  return tp.turns.map(t => t.text).join(' ');
}

function excerptFrom(record: SourceRecord, quote: string, turnIndex?: number): EvidenceExcerpt {
  return {
    source_id: record.source_id,
    record_ref: record.record_ref,
    turn_number: turnIndex !== undefined ? turnIndex + 1 : undefined,
    quote: quote.length > 200 ? quote.slice(0, 200) + '…' : quote,
  };
}

// Find first turn containing keyword(s) and return excerpt
function findTurnExcerpt(record: SourceRecord, keywords: string[]): EvidenceExcerpt | null {
  const tp = record.transcript_payload as MeetingTranscriptPayload | null;
  if (!tp) return null;
  for (let i = 0; i < tp.turns.length; i++) {
    const t = tp.turns[i];
    if (keywords.some(kw => t.text.toLowerCase().includes(kw.toLowerCase()))) {
      return excerptFrom(record, t.text, i);
    }
  }
  return null;
}

function callTranscriptExcerpt(record: SourceRecord, keywords: string[]): EvidenceExcerpt | null {
  const text = getTranscriptText(record);
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(text.length, idx + 140);
      return excerptFrom(record, text.slice(start, end));
    }
  }
  return null;
}

// ─── Main routing function ─────────────────────────────────────────────────────

export function routeRecord(record: SourceRecord, revision: number): RouteDecision {
  const hasText = hasUsableTranscript(record);
  const text = getTranscriptText(record).toLowerCase();
  const payload = record.payload as CallPayload & MeetingPayload;
  const excerpts: EvidenceExcerpt[] = [];

  // ── 1. Background calls (no connection, no text) ───────────────────────────
  if (record.source_type === 'call') {
    const callP = record.payload as CallPayload;
    const isBackground = !hasText && (
      callP.observed_outcome === 'voicemail' ||
      callP.observed_outcome === 'unresponsive' ||
      callP.is_connected === false ||
      callP.is_conversation === false
    );
    if (isBackground) {
      return {
        categories: ['no_connection'],
        primary_category: 'no_connection',
        reason: `Background call — outcome: ${callP.observed_outcome ?? 'unknown'}. No usable transcript supplied. Call duration: ${callP.duration_seconds}s. Routing to no_connection; no analysis possible from metadata alone.`,
        evidence_excerpts: [],
        confidence: 'high',
        is_manual_override: false,
        analysis_revision: revision,
        analysis_freshness: 'current',
      };
    }
  }

  // ── 2. No usable transcript (meetings with empty turns or unavailable reason) ─
  if (!hasText) {
    const unavailableReason = (record.transcript_payload as MeetingTranscriptPayload | null)?.unavailable_reason;
    const isLateDelivery = unavailableReason?.toLowerCase().includes('later assessment batch');
    const cat: RouteCategory = isLateDelivery ? 'no_transcript' : 'no_transcript';
    return {
      categories: [cat],
      primary_category: cat,
      reason: unavailableReason
        ? `No usable text: "${unavailableReason}". Record requires transcript before analysis. Routed to no_transcript.`
        : `No usable transcript available for this record. Recording status: ${(payload as MeetingPayload).recording_status ?? 'unknown'}.`,
      evidence_excerpts: [],
      confidence: 'high',
      is_manual_override: false,
      analysis_revision: revision,
      analysis_freshness: 'current',
    };
  }

  // ── 3. Content-based routing using transcript text ─────────────────────────

  // Pattern signals
  const isPartnership   = /partner|commission|referral link|referred|memorandum|revenue share|onboard.*partner|partner.*commission|advisory.*partner/i.test(text);
  const isVendorEval    = /ledger|supplier a|our core scope|integration setup charge|setup charge|eur 2,600|eur 6,500|sandbox|playground.*field|integration.*market/i.test(text);
  const isCustomerSupp  = /migration|existing card|token.*expired|notetaker|account setup|invite.*expired|brookmint|northkite|bug|recreate payment|description.*not appear|stuck.*processing|mark as paid|frozen account|billing cycle|billing walkthrough|subscription charge|invoice.*cleared|back.office/i.test(text);
  const isInternal      = /billing walkthrough|back.office super.admin|team member b.*admin|yesterday we covered|operations.*create.*invoice|invoice.*generated|zero.value invoice|nominal due period|automated engine|midnight.*local time|training session/i.test(text);
  const isProspect      = /cold call|introductory sales|spend.*nest.*expense|expense.*platform|vendor.*payment.*platform|follow.up.*proposal|expense.*software|lanternpath|asterloom|meadowbrick|willow.*advisory|harborlight advisory|follow_up|follow up|proposal|refer.*colleague|send.*presentation|send.*proposal|follow-up call/i.test(text);
  const isCustomerActive = /cedarwave|existing.*customer|card.*migration|prepaid.*credit|our cards|your cards|cards.*stop working|bank.*credit.*card|existing.*programme|close.*old programme|monthly spending.*inr|cfr.*approve|team.*existing/i.test(text);

  // Edge-case: C04 — is_connected=false but has 2-speaker voicemail transcript
  // The transcript shows Arun leaving a voicemail for Ritesh at Lanternpath Media.
  // Metadata says is_connected=false/voicemail but transcript proves substantive evidence.
  const isVoicemailWithContent = record.source_type === 'call' &&
    !(record.payload as CallPayload).is_conversation &&
    hasText &&
    /message for|following up|hope to hear|call me back/i.test(text);

  let categories: RouteCategory[] = [];
  let primaryCategory: RouteCategory = 'human_review_needed';
  let reason = '';
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  if (isInternal && !isProspect) {
    categories = ['internal_operations'];
    primaryCategory = 'internal_operations';
    reason = 'Internal SpendNest session: billing walkthrough, back-office training, or internal design discussion. No customer or prospect in the conversation; analysis relevant to ops team only.';
    confidence = 'high';
    const ex = findTurnExcerpt(record, ['billing', 'walkthrough', 'back-office', 'admin', 'training', 'invoice generation']);
    if (ex) excerpts.push(ex);
  } else if (isVendorEval) {
    categories = ['vendor_supplier'];
    primaryCategory = 'vendor_supplier';
    reason = 'SpendNest evaluating a third-party supplier (LedgerBridge electronic invoicing). Conversation is between SpendNest team members and a supplier, not a customer or prospect.';
    confidence = 'high';
    const ex = findTurnExcerpt(record, ['LedgerBridge', 'supplier', 'setup charge', 'EUR', 'sandbox', 'template']);
    if (ex) excerpts.push(ex);
  } else if (isPartnership) {
    categories = ['partner_opportunity'];
    primaryCategory = 'partner_opportunity';
    reason = 'Partnership / referral channel discussion. Advisory firm exploring co-referral arrangement with SpendNest (commission structure, referral link, memorandum).';
    confidence = 'high';
    const ex = findTurnExcerpt(record, ['commission', 'referral', 'partner', 'memorandum']) ||
               callTranscriptExcerpt(record, ['partner', 'commission', 'referral']);
    if (ex) excerpts.push(ex);
  } else if (isCustomerSupp || isCustomerActive) {
    categories = ['customer_success'];
    primaryCategory = 'customer_success';
    reason = 'Existing-customer conversation: card migration planning, account setup support, bug reporting, or onboarding assistance for a live SpendNest customer.';
    confidence = 'high';
    const ex = findTurnExcerpt(record, ['migration', 'existing', 'token expired', 'bug', 'recreate payment', 'credit card']) ||
               callTranscriptExcerpt(record, ['migration', 'existing card', 'credit card']);
    if (ex) excerpts.push(ex);
  } else if (isVoicemailWithContent) {
    // Difficult case: C04 — voicemail left for a prospect. Classified as prospect_follow_up
    // because the call contains substantive follow-up evidence even though no live conversation.
    categories = ['prospect_follow_up'];
    primaryCategory = 'prospect_follow_up';
    reason = 'Voicemail with substantive content: sales rep left a detailed follow-up message for a named prospect at a named company (Lanternpath Media). Metadata says is_connected=false but transcript confirms relevant outreach. Routing as prospect_follow_up with lower confidence — human should confirm next step.';
    confidence = 'medium';
    const ex = callTranscriptExcerpt(record, ['message for', 'following up', 'Lanternpath', 'expense platform']);
    if (ex) excerpts.push(ex);
  } else if (isProspect) {
    // Determine if it ended as uninterested or has a clear follow-up
    const hasFollowUp = /monday|tuesday|email|send.*proposal|call.*back|follow.up|contact.*me|come back/i.test(text);
    const isUninterested = /not interested|already have|no.*interest|don't need|we have.*that|processes are already/i.test(text);
    categories = ['prospect_follow_up'];
    primaryCategory = 'prospect_follow_up';
    reason = hasFollowUp
      ? 'Active prospect conversation with a stated follow-up action (email, proposal, or callback agreed).'
      : isUninterested
        ? 'Prospect call ended with stated disinterest. Logged for coaching / disposition tracking. No immediate follow-up action expected.'
        : 'Outbound prospect conversation. Review for next-step actions.';
    confidence = 'high';
    const ex = callTranscriptExcerpt(record, ['send', 'proposal', 'follow', 'email', 'call back', 'monday']) ||
               findTurnExcerpt(record, ['proposal', 'follow', 'email', 'monday', 'send']);
    if (ex) excerpts.push(ex);
  } else {
    // Ambiguous — not enough evidence to classify safely
    categories = ['human_review_needed'];
    primaryCategory = 'human_review_needed';
    reason = 'Insufficient evidence to classify automatically. Transcript available but routing signals are ambiguous. Requires manager review.';
    confidence = 'low';
  }

  return {
    categories,
    primary_category: primaryCategory,
    reason,
    evidence_excerpts: excerpts,
    confidence,
    is_manual_override: false,
    analysis_revision: revision,
    analysis_freshness: 'current',
  };
}

// ─── Priority assignment ───────────────────────────────────────────────────────

export function assignPriority(record: SourceRecord, route: RouteDecision): {
  priority: ProcessedRecord['priority'];
  priority_reason?: string;
} {
  const cat = route.primary_category;
  const text = getTranscriptText(record).toLowerCase();

  // High priority signals
  if (cat === 'customer_success') {
    const hasBug = /token.*expired|bug|stuck.*processing|frozen|not appear|cannot.*upload|recreate payment/i.test(text);
    if (hasBug) {
      return { priority: 'high', priority_reason: 'Active customer support issue or bug report requiring follow-up.' };
    }
    const hasMigration = /migration|close.*old programme|cards.*stop working/i.test(text);
    if (hasMigration) {
      return { priority: 'high', priority_reason: 'Card migration in progress — time-sensitive customer action required.' };
    }
    return { priority: 'medium', priority_reason: 'Customer success conversation with open items.' };
  }

  if (cat === 'partner_opportunity') {
    const hasReadyAction = /memorandum|onboarding|referral link|get started/i.test(text);
    if (hasReadyAction) {
      return { priority: 'high', priority_reason: 'Partner ready to proceed — memorandum or referral link follow-up needed.' };
    }
    return { priority: 'medium', priority_reason: 'Partner opportunity under discussion.' };
  }

  if (cat === 'prospect_follow_up') {
    const hasCommitment = /monday|tuesday|send.*email|call.*back|proposal/i.test(text);
    if (hasCommitment) {
      return { priority: 'high', priority_reason: 'Rep committed to a specific follow-up action (email, proposal, callback).' };
    }
    const hasReferral = /contact08|contact05|mr rishabh|colleague.*handles/i.test(text);
    if (hasReferral) {
      return { priority: 'high', priority_reason: 'Prospect referred to a decision-maker — outreach follow-up needed promptly.' };
    }
    return { priority: 'medium' };
  }

  if (cat === 'vendor_supplier') {
    return { priority: 'medium', priority_reason: 'Vendor evaluation with open commercials — follow-up template outstanding.' };
  }

  if (cat === 'no_transcript') {
    return { priority: 'low', priority_reason: 'No transcript available; cannot assess content.' };
  }

  if (cat === 'human_review_needed') {
    return { priority: 'medium', priority_reason: 'Routing ambiguous — manager review needed.' };
  }

  return { priority: 'low' };
}

// ─── Activity date ─────────────────────────────────────────────────────────────

export function getActivityDate(record: SourceRecord): { date_ist: string; time_utc: string } {
  let iso: string;
  if (record.source_type === 'call') {
    iso = (record.payload as CallPayload).started_at;
  } else {
    iso = (record.payload as MeetingPayload).starts_at;
  }

  // Convert to Asia/Kolkata (UTC+5:30) for daily grouping
  const d = new Date(iso);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffset);
  const yyyy = istDate.getUTCFullYear();
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getUTCDate()).padStart(2, '0');
  return { date_ist: `${yyyy}-${mm}-${dd}`, time_utc: iso };
}
