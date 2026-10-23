/**
 * Dashboard Metrics Calculator
 *
 * All calculations documented with denominators per DATA_DICTIONARY.md guidance.
 * Source-reported metrics are labelled as such.
 */

import type {
  ProcessedRecord,
  DashboardMetrics,
  RepActivity,
  CallPayload,
  MeetingPayload,
  RouteCategory,
} from './types';

export function computeMetrics(records: ProcessedRecord[]): DashboardMetrics {
  const calls = records.filter(r => r.source_type === 'call');
  const meetings = records.filter(r => r.source_type === 'meeting');

  const withUsable = records.filter(r => r.has_usable_transcript);
  const withoutUsable = records.filter(r => !r.has_usable_transcript);

  const callWithUsable = calls.filter(r => r.has_usable_transcript);
  const meetingWithUsable = meetings.filter(r => r.has_usable_transcript);

  // Source-reported connection rate (denominator: calls with non-null is_connected)
  const callsWithKnownConnection = calls.filter(r => (r.payload as CallPayload).is_connected !== null);
  const connectedCalls = calls.filter(r => (r.payload as CallPayload).is_connected === true);
  const connectedCallUnknownCount = calls.length - callsWithKnownConnection.length;

  // Source-reported conversations (is_conversation=true)
  const conversations = calls.filter(r => (r.payload as CallPayload).is_conversation === true);

  const awaitingReview = records.filter(r => r.review_status === 'pending');
  const highPriority = records.filter(r => r.priority === 'high');

  // Routing distribution
  const routingDist = {} as Record<RouteCategory, number>;
  for (const r of records) {
    const cat = r.route.primary_category;
    routingDist[cat] = (routingDist[cat] ?? 0) + 1;
  }

  // Rep activity
  const repMap = new Map<string, RepActivity>();

  // Calls
  for (const r of calls) {
    const p = r.payload as CallPayload;
    const email = p.rep_email ?? 'unknown';
    const name = p.rep_name ?? email;
    if (!repMap.has(email)) {
      repMap.set(email, {
        rep_email: email,
        rep_name: name,
        call_count: 0,
        meeting_organizer_count: 0,
        connected_calls: 0,
        transcript_calls: 0,
        routes: {},
      });
    }
    const rep = repMap.get(email)!;
    rep.call_count++;
    if (p.is_connected === true) rep.connected_calls++;
    if (r.has_usable_transcript) rep.transcript_calls++;
    const cat = r.route.primary_category;
    rep.routes[cat] = (rep.routes[cat] ?? 0) + 1;
  }

  // Meetings — organizer is NOT automatically a salesperson
  for (const r of meetings) {
    const p = r.payload as MeetingPayload;
    const email = p.organizer_email ?? 'unknown';
    if (email && email !== 'unknown') {
      if (!repMap.has(email)) {
        repMap.set(email, {
          rep_email: email,
          rep_name: email, // no name available for meeting organizers
          call_count: 0,
          meeting_organizer_count: 0,
          connected_calls: 0,
          transcript_calls: 0,
          routes: {},
        });
      }
      const rep = repMap.get(email)!;
      rep.meeting_organizer_count++;
      const cat = r.route.primary_category;
      rep.routes[cat] = (rep.routes[cat] ?? 0) + 1;
    }
  }

  const repActivity = Array.from(repMap.values())
    .sort((a, b) => (b.call_count + b.meeting_organizer_count) - (a.call_count + a.meeting_organizer_count));

  return {
    total_records: records.length,
    total_calls: calls.length,
    total_meetings: meetings.length,
    records_with_usable_transcript: withUsable.length,
    records_without_usable_transcript: withoutUsable.length,
    transcript_coverage_pct: records.length > 0
      ? Math.round((withUsable.length / records.length) * 100)
      : 0,
    call_transcript_coverage_pct: calls.length > 0
      ? Math.round((callWithUsable.length / calls.length) * 100)
      : 0,
    meeting_transcript_coverage_pct: meetings.length > 0
      ? Math.round((meetingWithUsable.length / meetings.length) * 100)
      : 0,
    connected_calls: connectedCalls.length,
    connected_call_rate_pct: callsWithKnownConnection.length > 0
      ? Math.round((connectedCalls.length / callsWithKnownConnection.length) * 100)
      : 0,
    connected_call_unknown_count: connectedCallUnknownCount,
    conversations: conversations.length,
    awaiting_review: awaitingReview.length,
    routing_distribution: routingDist,
    rep_activity: repActivity,
    high_priority_count: highPriority.length,
  };
}
